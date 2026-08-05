import { distributeEmployees, type DistributableEmployee } from "./distribution";

const employee = (
  id: string,
  competencies: string[],
  options: {
    lastStation?: string | null;
    history?: Record<string, number>;
  } = {}
): DistributableEmployee => ({
  id,
  competencies: new Set(competencies),
  history: options.history ?? {},
  lastStation: options.lastStation ?? null,
});

/** Slår ihop alla stationers listor till en platt lista av medarbetar-id */
const allAssigned = (assignments: Record<string, string[]>) =>
  Object.values(assignments).flat();

describe("distributeEmployees", () => {
  describe("kompetens är ett hårt krav", () => {
    test("placerar bara medarbetare på stationer de är upplärda på", () => {
      const { assignments } = distributeEmployees({
        employees: [
          employee("a", ["Plock"]),
          employee("b", ["Pack"]),
        ],
        stations: ["Plock", "Pack"],
        stationNeeds: { Plock: 1, Pack: 1 },
      });

      expect(assignments["Plock"]).toEqual(["a"]);
      expect(assignments["Pack"]).toEqual(["b"]);
    });

    test("lämnar platsen tom hellre än att placera någon utan kompetens", () => {
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [employee("a", ["Plock"])],
        stations: ["Plock", "Pack"],
        stationNeeds: { Plock: 0, Pack: 2 },
      });

      expect(assignments["Pack"]).toEqual([]);
      expect(unassignedIds).toEqual(["a"]);
    });

    test("kompetenskravet gäller även i andra passet", () => {
      // Enda kandidaten stod på Pack senast, men saknar kompetens för Plock.
      // Rotationsregeln släpps i andra passet — kompetenskravet gör det inte.
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [employee("a", ["Pack"], { lastStation: "Pack" })],
        stations: ["Plock"],
        stationNeeds: { Plock: 1 },
      });

      expect(assignments["Plock"]).toEqual([]);
      expect(unassignedIds).toEqual(["a"]);
    });
  });

  describe("rotationsregeln", () => {
    test("undviker stationen medarbetaren stod på senast när alternativ finns", () => {
      const { assignments } = distributeEmployees({
        employees: [
          employee("a", ["Plock", "Pack"], { lastStation: "Plock" }),
          employee("b", ["Plock", "Pack"], { lastStation: "Pack" }),
        ],
        stations: ["Plock", "Pack"],
        stationNeeds: { Plock: 1, Pack: 1 },
      });

      expect(assignments["Plock"]).toEqual(["b"]);
      expect(assignments["Pack"]).toEqual(["a"]);
    });

    test("bryter regeln hellre än att lämna en plats tom", () => {
      // Enda kandidaten stod på Plock senast, och Plock är enda stationen
      const { assignments } = distributeEmployees({
        employees: [employee("a", ["Plock"], { lastStation: "Plock" })],
        stations: ["Plock"],
        stationNeeds: { Plock: 1 },
      });

      expect(assignments["Plock"]).toEqual(["a"]);
    });

    test("fyller först alla platser som går utan att bryta regeln", () => {
      const { assignments } = distributeEmployees({
        employees: [
          employee("a", ["Plock"], { lastStation: "Plock" }),
          employee("b", ["Plock"], { lastStation: "Pack" }),
        ],
        stations: ["Plock"],
        stationNeeds: { Plock: 2 },
      });

      // b placeras i första passet, a i andra — båda får plats
      expect(assignments["Plock"]).toEqual(["b", "a"]);
    });
  });

  describe("historik avgör mellan likvärdiga kandidater", () => {
    test("väljer den som varit på stationen minst antal gånger", () => {
      const { assignments } = distributeEmployees({
        employees: [
          employee("ofta", ["Plock"], { history: { Plock: 12 } }),
          employee("sällan", ["Plock"], { history: { Plock: 2 } }),
        ],
        stations: ["Plock"],
        stationNeeds: { Plock: 1 },
      });

      expect(assignments["Plock"]).toEqual(["sällan"]);
    });

    test("kompetensbredd väger tyngre än historik", () => {
      // Den smalare medarbetaren går först trots mer tid på stationen,
      // eftersom hen inte kan placeras någon annanstans
      const { assignments } = distributeEmployees({
        employees: [
          employee("smal", ["Plock"], { history: { Plock: 20 } }),
          employee("bred", ["Plock", "Pack", "KM"], { history: { Plock: 0 } }),
        ],
        stations: ["Plock"],
        stationNeeds: { Plock: 1 },
      });

      expect(assignments["Plock"]).toEqual(["smal"]);
    });
  });

  describe("maximerar antalet placeringar", () => {
    test("offrar inte en specialist genom att fylla en station som andra klarar", () => {
      // Naiv fördelning skulle kunna sätta "bred" på Plock och lämna Pack tom,
      // eftersom "specialist" bara kan Pack.
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [
          employee("bred", ["Plock", "Pack"]),
          employee("specialist", ["Pack"]),
        ],
        stations: ["Plock", "Pack"],
        stationNeeds: { Plock: 1, Pack: 1 },
      });

      expect(assignments["Plock"]).toEqual(["bred"]);
      expect(assignments["Pack"]).toEqual(["specialist"]);
      expect(unassignedIds).toEqual([]);
    });

    test("ingen medarbetare placeras på mer än en station", () => {
      const { assignments } = distributeEmployees({
        employees: [employee("a", ["Plock", "Pack", "KM"])],
        stations: ["Plock", "Pack", "KM"],
        stationNeeds: { Plock: 1, Pack: 1, KM: 1 },
      });

      expect(allAssigned(assignments)).toEqual(["a"]);
    });

    test("placerar aldrig fler än behovet", () => {
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [
          employee("a", ["Plock"]),
          employee("b", ["Plock"]),
          employee("c", ["Plock"]),
        ],
        stations: ["Plock"],
        stationNeeds: { Plock: 2 },
      });

      expect(assignments["Plock"]).toHaveLength(2);
      expect(unassignedIds).toHaveLength(1);
    });
  });

  describe("gränsfall", () => {
    test("hanterar inga medarbetare", () => {
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [],
        stations: ["Plock"],
        stationNeeds: { Plock: 3 },
      });

      expect(assignments["Plock"]).toEqual([]);
      expect(unassignedIds).toEqual([]);
    });

    test("stationer utan behov får inga medarbetare", () => {
      const { assignments, unassignedIds } = distributeEmployees({
        employees: [employee("a", ["Plock", "Pack"])],
        stations: ["Plock", "Pack"],
        stationNeeds: { Plock: 0, Pack: 0 },
      });

      expect(assignments["Plock"]).toBeUndefined();
      expect(assignments["Pack"]).toBeUndefined();
      expect(unassignedIds).toEqual(["a"]);
    });

    test("terminerar när behovet inte kan fyllas", () => {
      const { assignments } = distributeEmployees({
        employees: [employee("a", ["Plock"])],
        stations: ["Plock"],
        stationNeeds: { Plock: 50 },
      });

      expect(assignments["Plock"]).toEqual(["a"]);
    });
  });

  describe("realistiskt scenario", () => {
    test("fördelar ett helt skift med blandade kompetenser och historik", () => {
      const employees = [
        employee("anna", ["Montering", "Kontroll"], { lastStation: "Montering" }),
        employee("bo", ["Montering"], { lastStation: "Montering", history: { Montering: 30 } }),
        employee("cem", ["Kontroll", "Logistik"], { lastStation: "Kontroll" }),
        employee("dina", ["Logistik"], { lastStation: "Logistik" }),
        employee("erik", ["Montering", "Kontroll", "Logistik"], { lastStation: null }),
      ];

      const { assignments, assignedIds, unassignedIds } = distributeEmployees({
        employees,
        stations: ["Montering", "Kontroll", "Logistik"],
        stationNeeds: { Montering: 2, Kontroll: 1, Logistik: 1 },
      });

      // Alla fyra platser fylls
      expect(allAssigned(assignments)).toHaveLength(4);
      expect(assignedIds.size).toBe(4);
      expect(unassignedIds).toHaveLength(1);

      // Ingen dubbelbokad
      expect(new Set(allAssigned(assignments)).size).toBe(4);

      // Alla placeringar respekterar kompetens
      Object.entries(assignments).forEach(([station, ids]) => {
        ids.forEach((id) => {
          const emp = employees.find((e) => e.id === id)!;
          expect(emp.competencies.has(station)).toBe(true);
        });
      });
    });
  });
});
