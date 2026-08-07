import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, EyeOff, LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Station } from "@/hooks/useStations";

/** Som Station, men här visas även avstängda stationer */
interface ManagedStation extends Station {
  is_active: boolean;
}

/** Rimligt tak — fler platser än så får ändå inte plats på ett stationskort */
const MAX_SLOTS = 40;
const DEFAULT_SLOTS = 8;
/** Seeden numrerar i steg om tio, så nya stationer läggs sist med samma steg */
const SORT_ORDER_STEP = 10;

/**
 * Lägger upp och stänger av anläggningens stationer.
 *
 * Stationerna låg tidigare bara i databasen och krävde SQL för att ändras. Här
 * väljs det som styr hur stationen ritas: numrerade platser (layout_type 'grid'
 * med ett antal) eller en enkel namnlista.
 */
const StationManagement = () => {
  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [name, setName] = useState("");
  const [numbered, setNumbered] = useState(false);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [loading, setLoading] = useState(false);
  // Stationen ligger kvar när dialogen stängs, annars hinner rubriken renderas
  // utan namn medan dialogen animeras bort
  const [pendingDelete, setPendingDelete] = useState<ManagedStation | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStations = async () => {
    const { data, error } = await supabase
      .from("stations")
      .select("id, name, sort_order, layout_type, slots, parent_station_id, manual_only, is_active")
      .order("sort_order");

    if (error) {
      toast({
        title: "Fel",
        description: `Kunde inte hämta stationer: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    setStations((data as ManagedStation[]) || []);
  };

  const addStation = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      toast({
        title: "Namn krävs",
        description: "Ange ett namn för stationen",
        variant: "destructive",
      });
      return;
    }

    // Namnet är unikt i databasen, men ett tydligt meddelande är bättre än ett
    // rått constraint-fel — och namnet kopplar ihop planering och historik
    if (stations.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: "Stationen finns redan",
        description: `Det finns redan en station som heter ${trimmed}`,
        variant: "destructive",
      });
      return;
    }

    if (numbered && (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS)) {
      toast({
        title: "Ogiltigt antal platser",
        description: `Ange mellan 1 och ${MAX_SLOTS} platser`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const lastSortOrder = stations.reduce((max, s) => Math.max(max, s.sort_order), 0);
    const { error } = await supabase.from("stations").insert([
      {
        name: trimmed,
        layout_type: numbered ? "grid" : "list",
        slots: numbered ? slots : null,
        sort_order: lastSortOrder + SORT_ORDER_STEP,
      },
    ]);

    setLoading(false);

    if (error) {
      toast({
        title: "Kunde inte lägga till stationen",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Tillagd!",
      description: numbered
        ? `${trimmed} har lagts till med ${slots} numrerade platser`
        : `${trimmed} har lagts till`,
    });

    setName("");
    setNumbered(false);
    setSlots(DEFAULT_SLOTS);
    fetchStations();
  };

  const toggleActive = async (station: ManagedStation) => {
    const { error } = await supabase
      .from("stations")
      .update({ is_active: !station.is_active })
      .eq("id", station.id);

    if (error) {
      toast({
        title: "Fel",
        description: `Kunde inte uppdatera stationen: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: station.is_active ? "Avstängd" : "Aktiverad",
      description: station.is_active
        ? `${station.name} går inte längre att planera på`
        : `${station.name} går att planera på igen`,
    });
    fetchStations();
  };

  const deleteStation = async (station: ManagedStation) => {
    setConfirmOpen(false);

    const { error } = await supabase.from("stations").delete().eq("id", station.id);

    if (error) {
      toast({
        title: "Fel",
        description: `Kunde inte ta bort stationen: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Borttagen!",
      description: `${station.name} har tagits bort`,
    });
    fetchStations();
  };

  const parentName = (station: ManagedStation) =>
    stations.find((s) => s.id === station.parent_station_id)?.name;

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-6 w-6" />
          Stationer
        </CardTitle>
        <CardDescription>
          Lägg upp anläggningens stationer. Med numrerade platser får stationen
          fasta platser som medarbetarna placeras på (1, 2, 3 …), annars visas de
          som en enkel lista.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="station-name">Namn på station</Label>
            <Input
              id="station-name"
              className="bg-sidebar-input"
              placeholder="T.ex. Emballering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStation()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="station-numbered">Numrerade platser</Label>
            <div className="flex h-10 items-center gap-3">
              <Switch
                id="station-numbered"
                checked={numbered}
                onCheckedChange={setNumbered}
              />
              <span className="text-sm text-muted-foreground">
                {numbered ? "Ja" : "Nej"}
              </span>
            </div>
          </div>

          {numbered && (
            <div className="w-36 space-y-2">
              <Label htmlFor="station-slots">Antal platser</Label>
              <Input
                id="station-slots"
                type="number"
                min={1}
                max={MAX_SLOTS}
                value={slots}
                onChange={(e) => setSlots(parseInt(e.target.value, 10) || 0)}
                onKeyDown={(e) => e.key === "Enter" && addStation()}
                className="bg-sidebar-input large-spinner text-center font-semibold"
              />
            </div>
          )}

          <Button
            onClick={addStation}
            disabled={loading}
            className="gap-2 bg-gradient-to-r from-primary to-secondary transition-opacity hover:opacity-80"
          >
            <Plus className="h-4 w-4" />
            Lägg till
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Stationer ({stations.filter((s) => s.is_active).length} aktiva av{" "}
            {stations.length})
          </h3>

          <div className="grid gap-2">
            {stations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Inga stationer än. Lägg till din första station ovan.
              </p>
            ) : (
              stations.map((station) => (
                <Card
                  key={station.id}
                  className={`flex items-center justify-between p-4 transition-shadow hover:shadow-md ${
                    station.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{station.name}</span>

                    <Badge variant="outline" className="gap-1">
                      {station.layout_type === "grid" ? (
                        <>
                          <LayoutGrid className="h-3 w-3" />
                          {station.slots} numrerade platser
                        </>
                      ) : (
                        <>
                          <List className="h-3 w-3" />
                          Lista
                        </>
                      )}
                    </Badge>

                    {station.manual_only && <Badge variant="secondary">Bemannas för hand</Badge>}

                    {parentName(station) && (
                      <Badge variant="secondary">Under {parentName(station)}</Badge>
                    )}

                    {!station.is_active && <Badge variant="secondary">Avstängd</Badge>}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(station)}
                      className="gap-2"
                    >
                      {station.is_active ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          Stäng av
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Aktivera
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setPendingDelete(station);
                        setConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stationen försvinner ur planeringen. Sparad historik och tidigare
              fördelningar ligger kvar på stationens namn, så statistiken påverkas
              inte. Vill du bara pausa stationen är "Stäng av" ett bättre val — då
              går den att ta tillbaka.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteStation(pendingDelete)}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default StationManagement;
