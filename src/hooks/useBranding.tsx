import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyBranding,
  brandings,
  readBrandKey,
  storeBrandKey,
  type Branding,
  type BrandKey,
} from "@/config/branding";

interface BrandingContextValue {
  brand: BrandKey;
  branding: Branding;
  setBrand: (key: BrandKey) => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/**
 * Håller den aktiva kundprofilen.
 *
 * Profilen låg tidigare som en konstant i branding.ts, vilket innebar en
 * ombyggnad för att byta. Här ligger den i state så att växlaren kan byta färger
 * och namn mitt under en demo. Färgerna skrivs som CSS-variabler, så allt som
 * använder --primary följer med utan att komponenterna vet om något.
 */
export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [brand, setBrandState] = useState<BrandKey>(readBrandKey);

  const setBrand = useCallback((key: BrandKey) => {
    applyBranding(brandings[key]);
    storeBrandKey(key);
    setBrandState(key);
  }, []);

  const value = useMemo(
    () => ({ brand, branding: brandings[brand], setBrand }),
    [brand, setBrand]
  );

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextValue => {
  const value = useContext(BrandingContext);

  if (!value) {
    throw new Error("useBranding måste användas inuti en BrandingProvider");
  }

  return value;
};
