import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

/** Behovet väljs med knappar — 0 betyder "ingen behövs här". Större antal skrivs i fältet sist. */
const NEED_CHOICES = Array.from({ length: 11 }, (_, i) => i);

interface StationNeedsCardProps {
  stations: string[];
  /** Stationen som bemannas för hand — behov anges inte för den */
  manualStationName?: string | null;
  stationNeeds: { [key: string]: number };
  onUpdateNeed: (station: string, count: number) => void;
  onSave: () => void;
  loading: boolean;
  hasUnsavedChanges?: boolean;
}

export const StationNeedsCard = ({
  stations,
  manualStationName = null,
  stationNeeds,
  onUpdateNeed,
  onSave,
  loading,
  hasUnsavedChanges = false,
}: StationNeedsCardProps) => {
  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          Personalbehov
        </CardTitle>
        <CardDescription>
          Ange hur många personer som behövs på varje station det valda datumet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
          {stations.map((station) => {
            const current = stationNeeds[station] || 0;
            const disabled = station === manualStationName;

            return (
              <div key={station} className="space-y-2">
                <Label id={`station-${station}-label`} className="text-sm font-medium">
                  {station}
                </Label>
                {disabled ? (
                  <p className="flex h-8 items-center text-sm text-muted-foreground">
                    Bemannas för hand
                  </p>
                ) : (
                  <div
                    role="group"
                    aria-labelledby={`station-${station}-label`}
                    className="flex flex-wrap gap-1"
                  >
                    {NEED_CHOICES.map((count) => {
                      const selected = current === count;

                      return (
                        <Button
                          key={count}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="icon"
                          aria-pressed={selected}
                          aria-label={`${count} personer på ${station}`}
                          onClick={() => onUpdateNeed(station, count)}
                          className={`h-8 w-8 text-sm ${
                            selected ? "font-semibold" : "bg-sidebar-input font-normal"
                          }`}
                        >
                          {count}
                        </Button>
                      );
                    })}
                    {/* Behövs fler än tio skrivs antalet in för hand */}
                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={current}
                      onChange={(e) => onUpdateNeed(station, parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      aria-label={`Eget antal på ${station}`}
                      title="Skriv ett eget antal"
                      className={`no-spinner ml-1 h-8 w-14 bg-sidebar-input px-1 text-center text-sm ${
                        NEED_CHOICES.includes(current) ? "" : "border-primary font-semibold"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasUnsavedChanges && (
          <p className="text-center text-sm text-muted-foreground mb-3">
            Du har ändringar som inte är sparade
          </p>
        )}
        <div className="flex justify-center">
          <Button
            onClick={onSave}
            disabled={loading}
            className="w-3/5 h-12 bg-gradient-to-r from-primary to-white backdrop-blur-lg border
              shadow-2xl hover:from-primary/70 hover:to-secondary/70 hover:shadow-3xl
              transition-all duration-300 hover:scale-[1.02] text-xl z-0"
          >
            Spara behov
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};