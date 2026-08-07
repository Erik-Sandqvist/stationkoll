import { fromDateKey, monthsBefore, toDateKey, todayKey } from "./date";

describe("datumnycklar", () => {
  describe("toDateKey", () => {
    test("formaterar med nollor så nycklarna går att jämföra som text", () => {
      // Databasfrågorna använder gte/lt på strängar, så "2026-1-5" hade
      // sorterat fel mot "2026-11-05"
      expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
      expect(toDateKey(new Date(2026, 10, 5))).toBe("2026-11-05");
    });

    test("använder lokal tid, inte UTC", () => {
      // Koden använde tidigare toISOString(), som ger UTC-datumet. Efter kl 22
      // svensk sommartid pekade det på nästa dag och planeringen hamnade på fel
      // datum. Assertionen håller i alla tidszoner: den beskriver de lokala
      // datumkomponenterna.
      expect(toDateKey(new Date(2026, 7, 6, 23, 30))).toBe("2026-08-06");
      expect(toDateKey(new Date(2026, 7, 6, 0, 15))).toBe("2026-08-06");
    });

    test("todayKey ger dagens lokala datum", () => {
      expect(todayKey()).toBe(toDateKey(new Date()));
    });
  });

  describe("fromDateKey", () => {
    test("tolkar nyckeln som lokal midnatt", () => {
      const date = fromDateKey("2026-08-06");

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(7);
      expect(date.getDate()).toBe(6);
      expect(date.getHours()).toBe(0);
    });

    test("är motsatsen till toDateKey", () => {
      // Nyckeln skickas fram och tillbaka mellan kalendern, url:en och
      // databasen — den får inte glida en dag på vägen
      for (const key of ["2026-01-01", "2026-02-28", "2026-03-29", "2026-12-31"]) {
        expect(toDateKey(fromDateKey(key))).toBe(key);
      }
    });
  });

  describe("monthsBefore", () => {
    test("räknar bakåt över årsskiftet", () => {
      expect(monthsBefore("2026-02-15", 6)).toBe("2025-08-15");
      expect(monthsBefore("2026-01-31", 1)).toBe("2025-12-31");
    });

    test("klipper dagen när målmånaden är kortare", () => {
      // Utan klippningen svämmade setMonth över: 31 mars minus en månad gav
      // 3 mars, ett datum senare än det man räknade från
      expect(monthsBefore("2026-03-31", 1)).toBe("2026-02-28");
      expect(monthsBefore("2026-05-31", 1)).toBe("2026-04-30");
      expect(monthsBefore("2026-03-31", 6)).toBe("2025-09-30");
    });

    test("hittar rätt i skottår", () => {
      expect(monthsBefore("2028-03-31", 1)).toBe("2028-02-29");
    });

    test("resultatet ligger alltid före utgångsdatumet", () => {
      // Invarianten historiken vilar på: fönstret får aldrig peka framåt
      const keys = ["2026-01-31", "2026-03-31", "2026-05-31", "2026-08-15", "2026-12-01"];

      for (const key of keys) {
        for (const months of [1, 2, 3, 6, 12]) {
          expect(monthsBefore(key, months) < key).toBe(true);
        }
      }
    });

    test("noll månader lämnar datumet orört", () => {
      expect(monthsBefore("2026-08-06", 0)).toBe("2026-08-06");
      expect(monthsBefore("2026-03-31", 0)).toBe("2026-03-31");
    });
  });
});
