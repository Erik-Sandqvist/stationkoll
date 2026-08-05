/**
 * Anläggningens skift. Byt listan här för en kund med annan skiftindelning.
 *
 * Värdena sparas som text i employees.shift samt i planeringstabellernas
 * shift-kolumn, så ändra bara namn om befintlig data migreras samtidigt.
 */
export const SHIFTS = [
  "Skift 1",
  "Skift 2",
  "Natt",
  "Bemanningsföretag",
] as const;

export type Shift = (typeof SHIFTS)[number];

export const DEFAULT_SHIFT: Shift = SHIFTS[0];

/** Alternativet "visa alla skift" i filter (aldrig ett värde som sparas) */
export const ALL_SHIFTS = "Alla" as const;
