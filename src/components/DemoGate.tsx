import { useState, type FormEvent, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

/**
 * Enkel lösenordsspärr framför appen under demoperioden.
 *
 * OBS: detta döljer gränssnittet, inte data. Supabase-nyckeln ligger kvar i
 * klienten och RLS-policyerna släpper igenom alla anrop, så den som öppnar
 * utvecklarverktygen når fortfarande API:et. Riktigt skydd kräver Supabase Auth
 * och omskrivna policyer.
 *
 * Är VITE_DEMO_PASSWORD inte satt är spärren avstängd, så lokal utveckling och
 * testkörningar inte behöver känna till något lösenord.
 */

const STORAGE_KEY = "stationkoll-demo-upplast";

const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

/** Upplåsningen sparas i localStorage — en omladdning mitt i en demo ska inte låsa ute någon */
const alreadyUnlocked = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "ja";
  } catch {
    // Privat läge kan blockera localStorage. Då får man logga in igen.
    return false;
  }
};

export const DemoGate = ({ children }: { children: ReactNode }) => {
  const { branding } = useBranding();
  const [unlocked, setUnlocked] = useState(() => !demoPassword || alreadyUnlocked());
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (password !== demoPassword) {
      setFailed(true);
      setPassword("");
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, "ja");
    } catch {
      // Går det inte att spara får man låsa upp igen efter omladdning
    }
    setUnlocked(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background/50 to-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {branding.appTitle}
          </CardTitle>
          <CardDescription>
            Ange lösenordet för att öppna demon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-password">Lösenord</Label>
              <Input
                id="demo-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFailed(false);
                }}
                className="bg-sidebar-input"
              />
              {failed && (
                <p className="text-sm text-destructive">Fel lösenord, försök igen.</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Öppna
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
