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

export const branding: Branding = {
  organizationName: "IKEA",
  appTitle: "Arbetsplatsplanering",
  logoSrc: ikeaLogo,
  logoAlt: "IKEA",
  // Standardtemat i index.css är redan IKEA-blått och gult, så ingen
  // överskrivning behövs här. Se demoprofilerna nedan för hur det används.
};

/**
 * Färdiga profiler att växla till vid demo. Sätt `branding` ovan till en av
 * dessa (eller kopiera och anpassa) för att visa appen i kundens färger.
 */
export const demoBrandings: Record<string, Branding> = {
  neutral: {
    organizationName: "Demofabriken",
    appTitle: "Arbetsplatsplanering",
    logoSrc: "",
    logoAlt: "",
    theme: {
      light: {
        primary: "215 45% 28%",
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
 * ljust och mörkt läge kan sättas och temaväxlingen fortsätter fungera.
 * Anropas en gång vid uppstart; gör ingenting om profilen saknar färger.
 */
export const applyBranding = (profile: Branding = branding): void => {
  document.title = profile.appTitle;

  const css = [
    toCssBlock(":root", profile.theme?.light),
    toCssBlock(".dark", profile.theme?.dark),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!css) return;

  const styleId = "branding-theme";
  const existing = document.getElementById(styleId);
  const style = existing ?? document.createElement("style");

  style.id = styleId;
  style.textContent = css;

  if (!existing) {
    document.head.appendChild(style);
  }
};
