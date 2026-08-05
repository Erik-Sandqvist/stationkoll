import { canAssignToStation } from "./stationRotation";

export interface DistributableEmployee {
  id: string;
  /** Stationer medarbetaren är upplärd på */
  competencies: Set<string>;
  /** Antal pass per station under historikfönstret */
  history: Record<string, number>;
  /** Stationen medarbetaren stod på senast, eller null */
  lastStation: string | null;
}

export interface DistributionInput {
  employees: DistributableEmployee[];
  /** Stationer som fördelas automatiskt, i visningsordning */
  stations: string[];
  /** Behov per station */
  stationNeeds: Record<string, number>;
}

export interface DistributionResult {
  /** Station -> lista av medarbetar-id */
  assignments: Record<string, string[]>;
  assignedIds: Set<string>;
  /** Medarbetare som inte fick någon plats */
  unassignedIds: string[];
}

/**
 * Fördelar medarbetare till stationer.
 *
 * Tre regler, i prioritetsordning:
 *
 * 1. **Kompetens är ett hårt krav.** En medarbetare placeras aldrig på en
 *    station hen inte är upplärd på — inte heller i andra passet.
 * 2. **Rotation.** Ingen ska stå på samma station två gånger i rad. Regeln
 *    gäller i första passet och släpps i andra, så att den bara bryts när
 *    alternativet är en tom plats.
 * 3. **Historik.** Bland likvärdiga kandidater väljs den som stått på
 *    stationen minst antal gånger.
 *
 * Stationer med få möjliga kandidater fylls först, och bland kandidaterna går
 * den som är upplärd på minst antal stationer först. Den minst flexibla
 * medarbetaren placeras alltså tidigast, vilket maximerar hur många som får
 * en plats totalt. Prioriteringen räknas om efter varje enskild placering.
 */
export const distributeEmployees = ({
  employees,
  stations,
  stationNeeds,
}: DistributionInput): DistributionResult => {
  const assignments: Record<string, string[]> = {};
  const assignedIds = new Set<string>();

  const lastStations = new Map<string, string | null>(
    employees.map((emp) => [emp.id, emp.lastStation])
  );

  const stationsWithNeeds = stations.filter(
    (station) => (stationNeeds[station] || 0) > 0
  );
  stationsWithNeeds.forEach((station) => {
    assignments[station] = [];
  });

  const availableFor = (station: string) =>
    employees.filter(
      (emp) => !assignedIds.has(emp.id) && emp.competencies.has(station)
    );

  const remainingNeed = (station: string) =>
    (stationNeeds[station] || 0) - (assignments[station]?.length || 0);

  /** Minst antal kompetenser först, därefter minst tid på stationen */
  const byPriority = (station: string) => (
    a: DistributableEmployee,
    b: DistributableEmployee
  ) => {
    const competencyDiff = a.competencies.size - b.competencies.size;
    if (competencyDiff !== 0) return competencyDiff;
    return (a.history[station] || 0) - (b.history[station] || 0);
  };

  const runPass = (respectRotation: boolean) => {
    let madeAssignment = true;

    while (madeAssignment) {
      madeAssignment = false;

      // Stationer med minst antal möjliga kandidater först
      const byScarcity = stationsWithNeeds
        .filter((station) => remainingNeed(station) > 0)
        .map((station) => ({
          station,
          availableCount: availableFor(station).length,
        }))
        .filter((entry) => entry.availableCount > 0)
        .sort((a, b) => a.availableCount - b.availableCount);

      for (const { station } of byScarcity) {
        if (remainingNeed(station) <= 0) continue;

        const candidates = availableFor(station)
          .filter(
            (emp) =>
              !respectRotation ||
              canAssignToStation(emp.id, station, lastStations)
          )
          .sort(byPriority(station));

        if (candidates.length > 0) {
          assignments[station].push(candidates[0].id);
          assignedIds.add(candidates[0].id);
          madeAssignment = true;
          break; // Räkna om prioriteringen efter varje placering
        }
      }
    }
  };

  runPass(true);
  // Andra passet fyller resten utan rotationsregeln, men kompetenskravet står kvar
  runPass(false);

  return {
    assignments,
    assignedIds,
    unassignedIds: employees
      .filter((emp) => !assignedIds.has(emp.id))
      .map((emp) => emp.id),
  };
};
