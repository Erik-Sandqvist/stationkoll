import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { fromDateKey, monthsBefore, toDateKey, todayKey } from "./date";

describe("datumnycklar", () => {
  describe("toDateKey", () => {
    test("formaterar med nollor så nycklarna går att jämföra som text", () => {
      // Databasfrågorna använder gte/lt på strängar, så "2026-1-5" hade
      // sorterat fel mot "2026-11-05"
      assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
      assert.equal(toDateKey(new Date(2026, 10, 5)), "2026-11-05");
    });

    test("använder lokal tid, inte UTC", () => {
      // Koden använde tidigare toISOString(), som ger UTC-datumet. Efter kl 22
      // svensk sommartid pekade det på nästa dag och planeringen hamnade på fel
      // datum. Assertionen håller i alla tidszoner: den beskriver de lokala
      // datumkomponenterna.
      assert.equal(toDateKey(new Date(2026, 7, 6, 23, 30)), "2026-08-06");
      assert.equal(toDateKey(new Date(2026, 7, 6, 0, 15)), "2026-08-06");
    });

    test("todayKey ger dagens lokala datum", () => {
      assert.equal(todayKey(), toDateKey(new Date()));
    });
  });

  describe("fromDateKey", () => {
    test("tolkar nyckeln som lokal midnatt", () => {
      const date = fromDateKey("2026-08-06");

      assert.equal(date.getFullYear(), 2026);
      assert.equal(date.getMonth(), 7);
      assert.equal(date.getDate(), 6);
      assert.equal(date.getHours(), 0);
    });

    test("är motsatsen till toDateKey", () => {
      // Nyckeln skickas fram och tillbaka mellan kalendern, url:en och
      // databasen — den får inte glida en dag på vägen
      for (const key of ["2026-01-01", "2026-02-28", "2026-03-29", "2026-12-31"]) {
        assert.equal(toDateKey(fromDateKey(key)), key);
      }
    });
  });

  describe("monthsBefore", () => {
    test("räknar bakåt över årsskiftet", () => {
      assert.equal(monthsBefore("2026-02-15", 6), "2025-08-15");
      assert.equal(monthsBefore("2026-01-31", 1), "2025-12-31");
    });

    test("klipper dagen när målmånaden är kortare", () => {
      // Utan klippningen svämmade setMonth över: 31 mars minus en månad gav
      // 3 mars, ett datum senare än det man räknade från
      assert.equal(monthsBefore("2026-03-31", 1), "2026-02-28");
      assert.equal(monthsBefore("2026-05-31", 1), "2026-04-30");
      assert.equal(monthsBefore("2026-03-31", 6), "2025-09-30");
    });

    test("hittar rätt i skottår", () => {
      assert.equal(monthsBefore("2028-03-31", 1), "2028-02-29");
    });

    test("resultatet ligger alltid före utgångsdatumet", () => {
      // Invarianten historiken vilar på: fönstret får aldrig peka framåt
      const keys = ["2026-01-31", "2026-03-31", "2026-05-31", "2026-08-15", "2026-12-01"];

      for (const key of keys) {
        for (const months of [1, 2, 3, 6, 12]) {
          assert.equal(monthsBefore(key, months) < key, true);
        }
      }
    });

    test("noll månader lämnar datumet orört", () => {
      assert.equal(monthsBefore("2026-08-06", 0), "2026-08-06");
      assert.equal(monthsBefore("2026-03-31", 0), "2026-03-31");
    });
  });
});
