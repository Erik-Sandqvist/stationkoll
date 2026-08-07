import ikeaLogo from "@/img/ikea.svg";

/**
 * Kundspecifik profil. Byt värdena här för att köra appen mot en annan
 * anläggning — inget annat i koden behöver ändras.
 *
 * Stationerna är inte med här: de ligger i databasens stations-tabell, eftersom
 * de skiljer sig mellan anläggningar hos samma kund.
 */
export interface Branding {
  /** Visas i navbaren bredvid loggan */
  organizationName: string;
  /** Rubrik i navbaren och webbläsarens flik */
  appTitle: string;
  logoSrc: string;
  logoAlt: string;
  /**
   * Färger som HSL-komponenter ("214 100% 36%"), samma format som CSS-variablerna
   * i index.css. Utelämnade värden faller tillbaka på standardtemat.
   */
  theme?: {
    light?: ThemeColors;
    dark?: ThemeColors;
  };
}

export interface ThemeColors {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
}

/**
 * Kundprofilerna appen kan köras i. Vid en riktig installation sätts en av dem
 * som förval och växlaren stängs av; under demo går det att byta live för att
 * visa att appen tar kundens färger.
 */
export const brandings = {
  volvo: {
    organizationName: "Volvo",
    appTitle: "Arbetsplatsplanering",
    // Ingen logotyp: navbaren faller tillbaka på organisationsnamnet. Lägg in
    // kundens egen fil här när du har den — den ska komma från kunden.
    logoSrc: "",
    logoAlt: "",
    theme: {
      light: {
        primary: "205 100% 20%",
        primaryForeground: "0 0% 100%",
        secondary: "205 65% 45%",
        secondaryForeground: "0 0% 100%",
        accent: "205 65% 45%",
        accentForeground: "0 0% 100%",
      },
      dark: {
        primary: "205 65% 55%",
        primaryForeground: "215 45% 12%",
        secondary: "205 40% 35%",
        secondaryForeground: "0 0% 100%",
        accent: "205 65% 55%",
        accentForeground: "215 45% 12%",
      },
    },
  },
  ikea: {
    organizationName: "IKEA",
    appTitle: "Arbetsplatsplanering",
    logoSrc: ikeaLogo,
    logoAlt: "IKEA",
    // Standardtemat i index.css är redan IKEA-blått och gult, så ingen
    // överskrivning behövs här.
  },
} satisfies Record<string, Branding>;

export type BrandKey = keyof typeof brandings;

/** Visningsnamn i växlaren */
export const BRAND_LABELS: Record<BrandKey, string> = {
  volvo: "Volvo",
  ikea: "IKEA",
};

export const DEFAULT_BRAND: BrandKey = "volvo";

/**
 * Växlaren visas bara när VITE_BRAND_SWITCHER=true. En kund som kör appen skarpt
 * ska inte kunna klicka sig till en annan kunds profil.
 */
export const brandSwitcherEnabled =
  import.meta.env.VITE_BRAND_SWITCHER === "true";

const STORAGE_KEY = "stationkoll-brand";

const isBrandKey = (value: string | null): value is BrandKey =>
  value !== null && value in brandings;

/**
 * Vilken profil appen ska starta i. Utan växlare används alltid förvalet, så att
 * ett gammalt värde i localStorage inte kan följa med in i en skarp installation.
 */
export const readBrandKey = (): BrandKey => {
  if (!brandSwitcherEnabled) return DEFAULT_BRAND;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isBrandKey(stored) ? stored : DEFAULT_BRAND;
  } catch {
    // Privat läge kan blockera localStorage
    return DEFAULT_BRAND;
  }
};

export const storeBrandKey = (key: BrandKey): void => {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Går det inte att spara återgår appen till förvalet vid omladdning
  }
};

const CSS_VARIABLE_NAMES: Record<keyof ThemeColors, string> = {
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
};

const toCssBlock = (selector: string, colors?: ThemeColors): string => {
  if (!colors) return "";

  const declarations = Object.entries(colors)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `  ${CSS_VARIABLE_NAMES[key as keyof ThemeColors]}: ${value};`)
    .join("\n");

  return declarations ? `${selector} {\n${declarations}\n}` : "";
};

/**
 * Skriver över temafärgerna från index.css med kundens färger.
 *
 * Injiceras som en style-tagg istället för inline-stilar på :root, så att både
 * ljust och mörkt läge kan sättas och ljus/mörk-växlingen fortsätter fungera.
 *
 * Saknar profilen färger töms taggen istället för att lämnas orörd — annars
 * skulle föregående profils färger ligga kvar när man växlar till en profil som
 * kör standardtemat.
 */
export const applyBranding = (profile: Branding): void => {
  document.title = profile.appTitle;

  const css = [
    toCssBlock(":root", profile.theme?.light),
    toCssBlock(".dark", profile.theme?.dark),
  ]
    .filter(Boolean)
    .join("\n\n");

  const styleId = "branding-theme";
  const existing = document.getElementById(styleId);

  if (!existing && !css) return;

  const style = existing ?? document.createElement("style");
  style.id = styleId;
  style.textContent = css;

  if (!existing) {
    document.head.appendChild(style);
  }
};
