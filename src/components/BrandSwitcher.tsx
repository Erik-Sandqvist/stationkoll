import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette } from "lucide-react";
import {
  BRAND_LABELS,
  brandSwitcherEnabled,
  brandings,
  type BrandKey,
} from "@/config/branding";
import { useBranding } from "@/hooks/useBranding";

/**
 * Byter kundprofil live. Finns bara i demoläge (VITE_BRAND_SWITCHER=true) —
 * poängen är att kunna visa samma app i kundens färger mitt under ett möte.
 */
export const BrandSwitcher = () => {
  const { brand, setBrand } = useBranding();

  if (!brandSwitcherEnabled) return null;

  return (
    <Select value={brand} onValueChange={(value) => setBrand(value as BrandKey)}>
      <SelectTrigger className="h-9 w-36 gap-2" aria-label="Byt kundprofil">
        <Palette className="h-4 w-4 shrink-0 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(brandings) as BrandKey[]).map((key) => (
          <SelectItem key={key} value={key}>
            {BRAND_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
