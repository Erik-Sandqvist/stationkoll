import type { jsPDF } from "jspdf";
import {
  buildPlanningPdf,
  planningPdfFileName,
  type PlanningPdfInput,
} from "./planningPdf";

/**
 * Attrapp för jsPDF som bara antecknar vad som skrivs ut.
 *
 * Ett riktigt jsPDF-dokument går bara att granska som binär PDF, vilket inte
 * säger något om innehållet hamnade rätt. Här kan vi i stället fråga vilken
 * text som ritades på vilken sida — det är det som faktiskt kan gå sönder när
 * layouten ändras.
 */
const fakeDoc = () => {
  const drawn: { text: string; page: number }[] = [];
  let page = 1;
  let pages = 1;

  const doc = {
    setFont: () => doc,
    setFontSize: () => doc,
    setTextColor: () => doc,
    setFillColor: () => doc,
    setDrawColor: () => doc,
    setLineWidth: () => doc,
    roundedRect: () => doc,
    line: () => doc,
    text: (value: string | string[]) => {
      for (const line of Array.isArray(value) ? value : [value]) {
        drawn.push({ text: line, page });
      }
      return doc;
    },
    // Linjär bredd räcker för att fit()/nameForWidth() ska bete sig som i
    // verkligheten: långa namn får inte plats, korta gör det
    getTextWidth: (value: string) => value.length * 1.8,
    splitTextToSize: (value: string) => [value],
    addPage: () => {
      pages += 1;
      page = pages;
      return doc;
    },
    getNumberOfPages: () => pages,
    setPage: (target: number) => {
      page = target;
      return doc;
    },
  };

  return {
    doc: doc as unknown as jsPDF,
    drawn,
    texts: () => drawn.map((item) => item.text),
    pageCount: () => pages,
  };
};

interface StationSpec {
  name: string;
  slots?: number;
  parent?: string;
  manual?: boolean;
}

const makeInput = (
  stations: StationSpec[],
  assignments: Record<string, string[]>,
  overrides: Partial<PlanningPdfInput> = {}
): PlanningPdfInput => ({
  date: "2026-08-06",
  shift: "Skift 1",
  stationNames: stations.map((s) => s.name),
  topLevelStationNames: stations.filter((s) => !s.parent).map((s) => s.name),
  getSubStationNames: (name) =>
    stations.filter((s) => s.parent === name).map((s) => s.name),
  getLayout: (name) =>
    stations.find((s) => s.name === name)?.slots ? "grid" : "list",
  getSlots: (name) => stations.find((s) => s.name === name)?.slots ?? null,
  manualStationName: stations.find((s) => s.manual)?.name ?? null,
  assignments,
  stationNeeds: {},
  // Medarbetarna heter samma sak som sitt id om inget annat anges
  employeeName: (id) => id,
  unassignedIds: [],
  organizationName: "Demofabriken",
  ...overrides,
});

describe("planningPdfFileName", () => {
  test("innehåller datum och skift", () => {
    expect(planningPdfFileName({ date: "2026-08-06", shift: "Skift 1" })).toBe(
      "Bemanning 2026-08-06 Skift 1.pdf"
    );
  });

  test("byter ut tecken som inte får finnas i ett filnamn", () => {
    // Ett skift som heter "Natt/Helg" skulle annars tolkas som en mappsökväg
    expect(planningPdfFileName({ date: "2026-08-06", shift: "Natt/Helg" })).toBe(
      "Bemanning 2026-08-06 Natt-Helg.pdf"
    );
    expect(
      planningPdfFileName({ date: "2026-08-06", shift: 'Skift: "A"' })
    ).toBe("Bemanning 2026-08-06 Skift- -A-.pdf");
  });
});

describe("buildPlanningPdf", () => {
  describe("sidhuvud", () => {
    test("visar datum på svenska, skift och organisation", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(doc, makeInput([{ name: "Plock" }], { Plock: ["Anna"] }));

      expect(texts()).toContain("Bemanning");
      expect(texts()).toContain("Torsdag 6 augusti 2026  ·  Skift 1");
      expect(texts()).toContain("Demofabriken");
    });

    test("räknar bara medarbetare som faktiskt står på en station", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput(
          [{ name: "Plock" }, { name: "Pack", slots: 8 }],
          // Tomma platser i en grid-station ska inte räknas som bemannade
          { Plock: ["Anna", "Bo"], Pack: ["Cem", "", "", ""] }
        )
      );

      expect(texts()).toContain("3 medarbetare · 2 stationer");
    });
  });

  describe("stationskort", () => {
    test("skriver ut alla tilldelade medarbetare", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput(
          [{ name: "Kaross" }, { name: "Måleri" }],
          { Kaross: ["Anna", "Bo"], "Måleri": ["Cem"] }
        )
      );

      expect(texts()).toEqual(expect.arrayContaining(["Anna", "Bo", "Cem"]));
      expect(texts()).toEqual(expect.arrayContaining(["Kaross", "Måleri"]));
    });

    test("numrerar platserna och markerar de lediga", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput([{ name: "Dörrlinje", slots: 4 }], {
          "Dörrlinje": ["Anna", "", "Cem", ""],
        })
      );

      expect(texts()).toEqual(expect.arrayContaining(["1.", "2.", "3.", "4."]));
      // Två lediga platser ritas som tankstreck
      expect(texts().filter((t) => t === "–")).toHaveLength(2);
    });

    test("visar behovsräknaren som fyllt av behov", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput([{ name: "Chassi" }], { Chassi: ["Anna", "Bo"] }, {
          stationNeeds: { Chassi: 4 },
        })
      );

      expect(texts()).toContain("2/4");
    });

    test("den handbemannade stationen får ingen räknare", () => {
      // Behovet anges inte för den, så "1/0" hade sett ut som ett fel
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput([{ name: "Skiftledare", manual: true }], {
          Skiftledare: ["Anna"],
        })
      );

      expect(texts()).toContain("Skiftledare");
      expect(texts()).toContain("Anna");
      expect(texts()).not.toContain("1/0");
    });

    test("en tom station säger det rakt ut", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(doc, makeInput([{ name: "Rep" }], { Rep: [] }));

      expect(texts()).toContain("Ingen tilldelad");
    });

    test("understationen ritas i förälderns kort med egen räknare", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput(
          [
            { name: "Kvalitetskontroll" },
            { name: "Efterjustering", parent: "Kvalitetskontroll" },
          ],
          { Kvalitetskontroll: ["Anna"], Efterjustering: ["Bo"] },
          { stationNeeds: { Kvalitetskontroll: 1, Efterjustering: 2 } }
        )
      );

      expect(texts()).toEqual(
        expect.arrayContaining(["Kvalitetskontroll", "Anna", "Efterjustering", "Bo"])
      );
      expect(texts()).toContain("1/2");
    });
  });

  describe("namn som inte får plats", () => {
    const longName = "Christina Wallenberg";

    test("behåller hela namnet i en lista", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(doc, makeInput([{ name: "Kaross" }], { Kaross: [longName] }));

      expect(texts()).toContain(longName);
    });

    test("kortar till förnamn och initial i en tvåspaltig platslista", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput([{ name: "Slutmontering", slots: 12 }], {
          Slutmontering: [longName],
        })
      );

      expect(texts()).toContain("Christina W.");
      expect(texts()).not.toContain(longName);
    });
  });

  describe("ofördelade", () => {
    test("listas överst när någon står utan station", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput([{ name: "Kaross" }], { Kaross: ["Anna"] }, {
          unassignedIds: ["Bo", "Cem"],
        })
      );

      expect(texts()).toContain("Ofördelade (2):");
      expect(texts()).toContain("Bo,   Cem");
    });

    test("ingen remsa när alla har en station", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(doc, makeInput([{ name: "Kaross" }], { Kaross: ["Anna"] }));

      expect(texts().some((t) => t.startsWith("Ofördelade"))).toBe(false);
    });
  });

  describe("sidbrytning", () => {
    const manyStations = Array.from({ length: 40 }, (_, i) => ({
      name: `Station ${i + 1}`,
    }));
    const manyAssignments = Object.fromEntries(
      manyStations.map((s, i) => [s.name, [`Medarbetare ${i + 1}`]])
    );

    test("ingen station tappas bort när innehållet flödar över flera sidor", () => {
      const { doc, texts, pageCount } = fakeDoc();

      buildPlanningPdf(doc, makeInput(manyStations, manyAssignments));

      expect(pageCount()).toBeGreaterThan(1);
      for (const station of manyStations) {
        expect(texts()).toContain(station.name);
      }
    });

    test("varje sida får sidhuvud och rätt sidnummer", () => {
      const { doc, drawn, texts, pageCount } = fakeDoc();

      buildPlanningPdf(doc, makeInput(manyStations, manyAssignments));

      const pages = pageCount();
      for (let page = 1; page <= pages; page += 1) {
        expect(texts()).toContain(`Sida ${page} av ${pages}`);
        expect(
          drawn.some((item) => item.page === page && item.text === "Bemanning")
        ).toBe(true);
      }
    });

    test("de ofördelade upprepas inte på följande sidor", () => {
      const { doc, drawn } = fakeDoc();

      buildPlanningPdf(
        doc,
        makeInput(manyStations, manyAssignments, { unassignedIds: ["Bo"] })
      );

      const remsor = drawn.filter((item) => item.text.startsWith("Ofördelade"));

      expect(remsor).toHaveLength(1);
      expect(remsor[0].page).toBe(1);
    });
  });

  describe("gränsfall", () => {
    test("en anläggning utan stationer ger ändå ett dokument", () => {
      const { doc, texts, pageCount } = fakeDoc();

      buildPlanningPdf(doc, makeInput([], {}));

      expect(pageCount()).toBe(1);
      expect(texts()).toContain("Bemanning");
      expect(texts()).toContain("0 medarbetare · 0 stationer");
    });

    test("en station helt utan tilldelningar i objektet kraschar inte", () => {
      const { doc, texts } = fakeDoc();

      buildPlanningPdf(doc, makeInput([{ name: "Kaross" }], {}));

      expect(texts()).toContain("Kaross");
      expect(texts()).toContain("Ingen tilldelad");
    });
  });
});
