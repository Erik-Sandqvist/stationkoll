import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stations.map((station) => (
            <div key={station} className="space-y-2 w-90%">
              <Label htmlFor={`station-${station}`} className="text-sm font-medium">
                {station}
              </Label>
              <Input
                id={`station-${station}`}
                type="number"
                min="0"
                value={stationNeeds[station] || 0}
                onChange={(e) => onUpdateNeed(station, parseInt(e.target.value) || 0)}
                className="text-center font-semibold bg-sidebar-input large-spinner h-10"
                disabled={station === manualStationName}
              />
            </div>
          ))}
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