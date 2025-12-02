import { canAssignToStation, getAvailableStationsForEmployee } from './stationRotation';

describe('Station Rotation Logic', () => {
  describe('canAssignToStation', () => {
    test('should return true when employee has no previous assignment', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', null);
      
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
    });

    test('should return false when trying to assign to same station as last time', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
    });

    test('should return true when assigning to different station than last time', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp1', 'KM', lastStationsMap)).toBe(true);
    });

    test('should handle unknown employee (not in map)', () => {
      const lastStationsMap = new Map<string, string | null>();
      
      expect(canAssignToStation('unknown-emp', 'Plock', lastStationsMap)).toBe(true);
    });
  });

  describe('getAvailableStationsForEmployee', () => {
    const allStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];

    test('should return all stations when employee has no previous assignment', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', null);
      
      const available = getAvailableStationsForEmployee('emp1', allStations, lastStationsMap);
      expect(available).toEqual(allStations);
    });

    test('should exclude last assigned station', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      const available = getAvailableStationsForEmployee('emp1', allStations, lastStationsMap);
      expect(available).not.toContain('Plock');
      expect(available).toEqual(['Pack', 'KM', 'Decating', 'Rep']);
    });

    test('should return all stations for unknown employee', () => {
      const lastStationsMap = new Map<string, string | null>();
      
      const available = getAvailableStationsForEmployee('unknown', allStations, lastStationsMap);
      expect(available).toEqual(allStations);
    });
  });

  describe('Station Assignment Validation', () => {
    test('should not assign employee to same station as last assignment', () => {
      const lastAssignment = { station: 'Plock', date: '2024-12-01' };
      const allStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];
      
      const availableStations = allStations.filter(
        station => station !== lastAssignment.station
      );
      
      expect(availableStations).not.toContain('Plock');
      expect(availableStations).toHaveLength(4);
      expect(availableStations).toEqual(['Pack', 'KM', 'Decating', 'Rep']);
    });

    test('should handle multiple employees with different last assignments', () => {
      const employees = [
        { id: '1', lastStation: 'Plock' },
        { id: '2', lastStation: 'Pack' },
        { id: '3', lastStation: null },
      ];
      
      const allStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];
      
      employees.forEach(emp => {
        const availableStations = emp.lastStation 
          ? allStations.filter(s => s !== emp.lastStation)
          : allStations;
        
        if (emp.lastStation) {
          expect(availableStations).not.toContain(emp.lastStation);
          expect(availableStations.length).toBe(allStations.length - 1);
        } else {
          expect(availableStations.length).toBe(allStations.length);
        }
      });
    });

    test('should assign to least visited station excluding last assignment', () => {
      const lastAssignment = 'Plock';
      const allStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];
      
      const employeeHistory = [
        { station: 'Plock', date: '2024-12-01' },
        { station: 'Pack', date: '2024-11-30' },
        { station: 'Pack', date: '2024-11-29' },
        { station: 'KM', date: '2024-11-28' },
        { station: 'KM', date: '2024-11-27' },
        { station: 'KM', date: '2024-11-26' },
        { station: 'Decating', date: '2024-11-25' },
      ];
      
      const availableStations = allStations.filter(s => s !== lastAssignment);
      
      const stationCounts: Record<string, number> = {};
      availableStations.forEach(station => {
        stationCounts[station] = employeeHistory.filter(
          h => h.station === station
        ).length;
      });
      
      const leastVisited = availableStations.reduce((min, station) =>
        stationCounts[station] < stationCounts[min] ? station : min
      );
      
      expect(leastVisited).toBe('Rep');
      expect(stationCounts['Rep']).toBe(0);
      expect(stationCounts['Pack']).toBe(2);
      expect(stationCounts['KM']).toBe(3);
    });

    test('should correctly count station visits and identify least visited', () => {
      const employeeHistory = [
        { station: 'Plock', date: '2024-09-18', employeeId: '1' },
        { station: 'Plock', date: '2024-09-17', employeeId: '1' },
        { station: 'Pack', date: '2024-09-16', employeeId: '1' },
      ];
  
      const availableStations = ['Plock', 'Pack', 'KM', 'Rep'];
  
      const getStationVisitCounts = (history: typeof employeeHistory) => {
        const counts: Record<string, number> = {};
        availableStations.forEach(station => {
          counts[station] = history.filter(h => h.station === station).length;
        });
        return counts;
      };
  
      const visitCounts = getStationVisitCounts(employeeHistory);
      
      const minCount = Math.min(...Object.values(visitCounts));
      const leastVisitedStations = Object.entries(visitCounts)
        .filter(([_, count]) => count === minCount)
        .map(([station, _]) => station);
  
      expect(visitCounts['Plock']).toBe(2);
      expect(visitCounts['Pack']).toBe(1);
      expect(visitCounts['KM']).toBe(0);
      expect(visitCounts['Rep']).toBe(0);
      expect(leastVisitedStations).toContain('KM');
      expect(leastVisitedStations).toContain('Rep');
      expect(leastVisitedStations.length).toBe(2);
    });
  });
});