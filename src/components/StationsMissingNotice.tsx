import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface StationsMissingNoticeProps {
  /** Felmeddelande från useStations, om något gick fel vid hämtningen */
  error?: string | null;
}

/**
 * Visas när det inte finns några stationer att planera på. Utan stationer kan
 * varken behov anges eller medarbetare fördelas, så det är bättre att säga vad
 * som är fel än att rendera en tom sida.
 */
export const StationsMissingNotice = ({ error }: StationsMissingNoticeProps) => (
  <Card className="border-destructive/50 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        Inga stationer är upplagda
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p>
        Stationerna hämtas från tabellen <code className="font-mono">stations</code>{" "}
        i databasen. Innan den är ifylld går det inte att ange personalbehov eller
        fördela medarbetare.
      </p>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <p className="font-medium">Så här gör du:</p>
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
          <li>
            Kör migrationerna i <code className="font-mono">supabase/migrations/</code>{" "}
            mot ditt Supabase-projekt (<code className="font-mono">supabase db push</code>,
            eller klistra in dem i SQL-editorn i Supabase-dashboarden).
          </li>
          <li>
            Ladda om sidan. Migrationen lägger upp standarduppsättningen av
            stationer automatiskt.
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
);
