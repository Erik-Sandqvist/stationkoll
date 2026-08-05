import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StationLayout = "list" | "grid";

export interface Station {
  id: string;
  name: string;
  sort_order: number;
  layout_type: StationLayout;
  slots: number | null;
  parent_station_id: string | null;
  manual_only: boolean;
}

/**
 * Hämtar anläggningens stationer från databasen.
 *
 * Stationerna låg tidigare som hårdkodade konstanter i komponenterna, med
 * specialfall per stationsnamn utspridda i renderingen. Allt sådant styrs nu av
 * kolumnerna layout_type, slots, parent_station_id och manual_only, så att en ny
 * kund bara behöver egna rader i stations-tabellen.
 */
export const useStations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("stations")
        .select("id, name, sort_order, layout_type, slots, parent_station_id, manual_only")
        .eq("is_active", true)
        .order("sort_order");

      if (cancelled) return;

      if (queryError) {
        console.error("Kunde inte hämta stationer:", queryError);
        // PGRST205 = tabellen finns inte, dvs. migrationerna är inte körda
        setError(
          queryError.code === "PGRST205"
            ? "Tabellen stations saknas i databasen. Kör migrationerna i supabase/migrations/ (supabase db push)."
            : `Kunde inte hämta stationer: ${queryError.message}`
        );
      }

      setStations((data as Station[]) || []);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const byName = new Map(stations.map((s) => [s.name, s]));
    const byId = new Map(stations.map((s) => [s.id, s]));

    return {
      stations,
      loading,
      error,
      /** Inga stationer att planera på — appen kan inte användas */
      isEmpty: !loading && stations.length === 0,

      /** Alla stationsnamn i visningsordning */
      stationNames: stations.map((s) => s.name),

      /** Stationer som får ett eget kort. Understationer visas i förälderns kort. */
      topLevelStationNames: stations
        .filter((s) => !s.parent_station_id)
        .map((s) => s.name),

      /** Namnen på understationerna till en given station */
      getSubStationNames: (name: string) =>
        stations
          .filter(
            (s) =>
              s.parent_station_id &&
              byId.get(s.parent_station_id)?.name === name
          )
          .map((s) => s.name),

      /** Antal numrerade platser, eller null för listlayout */
      getSlots: (name: string) => byName.get(name)?.slots ?? null,

      getLayout: (name: string): StationLayout =>
        byName.get(name)?.layout_type ?? "list",

      /** Stationer som fördelas automatiskt */
      autoAssignedStationNames: stations
        .filter((s) => !s.manual_only)
        .map((s) => s.name),

      /**
       * Stationen som bemannas för hand istället för av fördelningen (hos IKEA
       * "FL"). Null om anläggningen inte har någon sådan.
       */
      manualStationName: stations.find((s) => s.manual_only)?.name ?? null,
    };
  }, [stations, loading, error]);
};
