/**
 * Datumnyckel (YYYY-MM-DD) i lokal tid.
 *
 * Koden använde tidigare `new Date().toISOString().split("T")[0]`, vilket ger
 * datumet i UTC. Efter klockan 22 (sommartid 23) svensk tid pekade det på
 * nästa dag, så planeringen kunde hamna på fel datum. Den här funktionen
 * använder alltid webbläsarens lokala tid.
 */
export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Dagens datum som datumnyckel */
export const todayKey = (): string => toDateKey(new Date());

/** Tolkar en datumnyckel som ett lokalt Date-objekt (midnatt lokal tid) */
export const fromDateKey = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** Datumnyckel för ett antal månader bakåt från ett givet datum */
export const monthsBefore = (key: string, months: number): string => {
  const date = fromDateKey(key);
  date.setMonth(date.getMonth() - months);
  return toDateKey(date);
};
