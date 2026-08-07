import {
  buildStationColors,
  hexToRgb,
  readableTextColor,
  stationColor,
  tint,
  type Rgb,
} from "./stationColors";

/** Stationer utan understationer — det vanliga fallet */
const flat = (...names: string[]) => buildStationColors(names);

const subStationsOf =
  (map: Record<string, string[]>) =>
  (station: string): string[] =>
    map[station] ?? [];

describe("stationColors", () => {
  describe("hexToRgb", () => {
    test("plockar isär kanalerna", () => {
      expect(hexToRgb("#0057AD")).toEqual({ r: 0, g: 87, b: 173 });
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe("tint", () => {
    const blue: Rgb = { r: 0, g: 87, b: 173 };

    test("0 lämnar färgen orörd och 1 ger vitt", () => {
      expect(tint(blue, 0)).toEqual(blue);
      expect(tint(blue, 1)).toEqual({ r: 255, g: 255, b: 255 });
    });

    test("ljusar upp varje kanal däremellan", () => {
      const lighter = tint(blue, 0.5);

      expect(lighter.r).toBeGreaterThan(blue.r);
      expect(lighter.g).toBeGreaterThan(blue.g);
      expect(lighter.b).toBeGreaterThan(blue.b);
      expect(lighter.b).toBeLessThan(255);
    });
  });

  describe("readableTextColor", () => {
    test("vit text på mörk botten, svart på ljus", () => {
      expect(readableTextColor({ r: 0, g: 87, b: 173 })).toEqual({ r: 255, g: 255, b: 255 });
      expect(readableTextColor({ r: 255, g: 255, b: 255 })).toEqual({ r: 26, g: 26, b: 26 });
    });

    test("gult räknas som ljust trots att det är mättat", () => {
      // Luminansen viktar grönt tungt. En ren RGB-summa hade valt vit text här,
      // vilket är oläsbart på gult.
      expect(readableTextColor({ r: 240, g: 200, b: 0 })).toEqual({ r: 26, g: 26, b: 26 });
    });

    test("varje palettfärg får läsbar text", () => {
      const colors = flat(...Array.from({ length: 12 }, (_, i) => `Station ${i}`));

      for (const color of colors.values()) {
        const text = readableTextColor(color);
        const contrast =
          Math.abs(
            (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) -
            (0.299 * text.r + 0.587 * text.g + 0.114 * text.b)
          ) / 255;

        expect(contrast).toBeGreaterThan(0.4);
      }
    });
  });

  describe("buildStationColors", () => {
    test("ger varje station en egen färg", () => {
      const colors = flat("Plock", "Pack", "KM");
      const unika = new Set([...colors.values()].map((c) => `${c.r},${c.g},${c.b}`));

      expect(colors.size).toBe(3);
      expect(unika.size).toBe(3);
    });

    test("en ny station sist ändrar inte färgen på de befintliga", () => {
      // Färgerna delas ut i sort_order. Lägger man till en station i
      // stationsfliken ska inte hela anläggningens färgkodning kastas om.
      const innan = flat("Plock", "Pack", "KM");
      const efter = flat("Plock", "Pack", "KM", "Emballering");

      for (const station of ["Plock", "Pack", "KM"]) {
        expect(efter.get(station)).toEqual(innan.get(station));
      }
    });

    test("understationer förbrukar ingen egen palettfärg", () => {
      // Rework ligger inuti Decating-kortet och ärver dess färg. Skulle den ta
      // en egen plats i paletten skulle stationen efter byta färg.
      const utan = buildStationColors(["Decating", "In/Ut"]);
      const med = buildStationColors(
        ["Decating", "Rework", "In/Ut"],
        subStationsOf({ Decating: ["Rework"] })
      );

      expect(med.get("In/Ut")).toEqual(utan.get("In/Ut"));
    });

    test("understationen får en ljusare ton av förälderns färg", () => {
      const colors = buildStationColors(
        ["Decating", "Rework"],
        subStationsOf({ Decating: ["Rework"] })
      );

      const parent = colors.get("Decating") as Rgb;
      const sub = colors.get("Rework") as Rgb;

      expect(sub).not.toEqual(parent);
      expect(sub.r).toBeGreaterThan(parent.r);
      expect(sub.g).toBeGreaterThan(parent.g);
      expect(sub.b).toBeGreaterThan(parent.b);
    });

    test("paletten börjar om när stationerna är fler än färgerna", () => {
      const names = Array.from({ length: 13 }, (_, i) => `Station ${i}`);
      const colors = buildStationColors(names);

      expect(colors.size).toBe(13);
      expect(colors.get("Station 12")).toEqual(colors.get("Station 0"));
      expect(colors.get("Station 11")).not.toEqual(colors.get("Station 0"));
    });

    test("hanterar en anläggning utan stationer", () => {
      expect(buildStationColors([]).size).toBe(0);
    });
  });

  describe("stationColor", () => {
    test("faller tillbaka på en neutral färg för okända stationer", () => {
      const colors = flat("Plock");
      const fallback = stationColor(colors, "Finns inte");

      expect(fallback).toEqual(hexToRgb("#5B6470"));
      expect(stationColor(colors, "Plock")).toEqual(colors.get("Plock"));
    });
  });
});
