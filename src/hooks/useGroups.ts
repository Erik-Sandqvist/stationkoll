import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Group {
  id: string;
  name: string;
}

/**
 * Hämtar arbetslagen från databasen.
 *
 * Grupperna ligger i en egen tabell och medarbetaren pekar på den med group_id,
 * så ett lag kan byta namn utan att medarbetarna rörs. Tabellen är ny, så länge
 * migrationen inte är körd returneras ett felmeddelande istället för en tom
 * lista — annars ser det ut som att inga grupper är upplagda.
 */
export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("groups")
      .select("id, name")
      .order("name");

    if (queryError) {
      console.error("Kunde inte hämta grupper:", queryError);
      // PGRST205 = tabellen finns inte, dvs. migrationerna är inte körda
      setError(
        queryError.code === "PGRST205"
          ? "Tabellen groups saknas i databasen. Kör migrationerna i supabase/migrations/ (supabase db push)."
          : `Kunde inte hämta grupper: ${queryError.message}`
      );
    } else {
      setError(null);
    }

    setGroups(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, loading, error, refresh };
};

/** Namnet på en grupp, eller null om medarbetaren saknar grupp */
export const groupName = (groups: Group[], groupId: string | null): string | null =>
  groups.find((group) => group.id === groupId)?.name ?? null;
