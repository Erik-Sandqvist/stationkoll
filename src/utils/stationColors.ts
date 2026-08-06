/**
 * Färgkodning av stationer.
 *
 * Stationerna kommer från databasen och kan heta vad som helst, så färgerna kan
 * inte hårdkodas per namn. Istället delas en fast palett ut i stationernas
 * visningsordning: samma anläggning får samma färg på samma station varje gång,
 * och en ny station längst ner påverkar inte de befintliga.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Tolv färger som går att skilja åt både på skärm och i utskrift. Mörka nog att
 * vit text ligger kvar med god kontrast.
 */
const PALETTE = [
  "#0057AD", // blå
  "#B8860B", // guld
  "#1B7F4B", // grön
  "#B3282D", // röd
  "#5E4B9E", // lila
  "#0E7C8C", // turkos
  "#C25A16", // orange
  "#6E7B1F", // oliv
  "#A63578", // magenta
  "#3B5570", // skiffer
  "#8A5A33", // brun
  "#2F6F6B", // petrol
] as const;

const NEUTRAL = "#5B6470";

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace("#", ""), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

/** Blandar en färg mot vitt. amount 0 = oförändrad, 1 = helvit. */
export const tint = ({ r, g, b }: Rgb, amount: number): Rgb => ({
  r: Math.round(r + (255 - r) * amount),
  g: Math.round(g + (255 - g) * amount),
  b: Math.round(b + (255 - b) * amount),
});

/** Svart eller vit text beroende på hur mörk bakgrunden är */
export const readableTextColor = ({ r, g, b }: Rgb): Rgb => {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? { r: 26, g: 26, b: 26 } : { r: 255, g: 255, b: 255 };
};

/**
 * Bygger en uppslagning från stationsnamn till färg.
 *
 * Understationer ärver förälderns färg i en ljusare ton, så att de syns höra
 * ihop med sitt huvudkort.
 *
 * @param stationNames alla stationer i visningsordning (sort_order)
 * @param getSubStationNames understationerna till en station, om det finns några
 */
export const buildStationColors = (
  stationNames: string[],
  getSubStationNames: (station: string) => string[] = () => []
): Map<string, Rgb> => {
  const colors = new Map<string, Rgb>();
  const subStations = new Set(
    stationNames.flatMap((name) => getSubStationNames(name))
  );

  let index = 0;
  for (const name of stationNames) {
    // Understationer får sin färg av föräldern nedan, inte en egen ur paletten
    if (subStations.has(name)) continue;

    const color = hexToRgb(PALETTE[index % PALETTE.length]);
    colors.set(name, color);
    index += 1;

    for (const sub of getSubStationNames(name)) {
      colors.set(sub, tint(color, 0.45));
    }
  }

  return colors;
};

/** Färgen för en station, med en neutral reserv för okända namn */
export const stationColor = (colors: Map<string, Rgb>, station: string): Rgb =>
  colors.get(station) ?? hexToRgb(NEUTRAL);
