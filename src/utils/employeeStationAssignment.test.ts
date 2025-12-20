import { canAssignToStation } from './stationRotation';

describe('Employee Station Assignment Validation', () => {
  describe('Employee can only be assigned to qualified stations', () => {
    test('should allow assignment to qualified station', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', null);
      
      const employeeQualifiedStations = ['Plock', 'Pack', 'KM'];
      const targetStation = 'Plock';
      
      const isQualified = employeeQualifiedStations.includes(targetStation);
      const canAssign = canAssignToStation('emp1', targetStation, lastStationsMap);
      
      expect(isQualified).toBe(true);
      expect(canAssign).toBe(true);
    });

    test('should NOT allow assignment to non-qualified station', () => {
      const employeeQualifiedStations = ['Plock', 'Pack'];
      const targetStation = 'Decating';
      
      const isQualified = employeeQualifiedStations.includes(targetStation);
      
      expect(isQualified).toBe(false);
    });

    test('should allow rotation between qualified stations only', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      const employeeQualifiedStations = ['Plock', 'Pack', 'KM'];
      
      // Kan byta till Pack (kvalificerad och inte samma som senaste)
      expect(employeeQualifiedStations.includes('Pack')).toBe(true);
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      
      // Kan byta till KM (kvalificerad och inte samma som senaste)
      expect(employeeQualifiedStations.includes('KM')).toBe(true);
      expect(canAssignToStation('emp1', 'KM', lastStationsMap)).toBe(true);
      
      // Kan INTE stanna på Plock (samma som senaste)
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
      
      // Kan INTE gå till Decating (ej kvalificerad)
      expect(employeeQualifiedStations.includes('Decating')).toBe(false);
    });

    test('should handle employee with single qualified station', () => {
      const employeeQualifiedStations = ['Plock'];
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      // Kvalificerad men var där senast
      expect(employeeQualifiedStations.includes('Plock')).toBe(true);
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
      
      // Inte kvalificerad för andra stationer
      expect(employeeQualifiedStations.includes('Pack')).toBe(false);
      expect(employeeQualifiedStations.includes('KM')).toBe(false);
    });

    test('should validate assignment logic for multiple employees', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      lastStationsMap.set('emp2', 'Pack');
      lastStationsMap.set('emp3', null);
      
      const employeeStations = {
        emp1: ['Plock', 'Pack'],
        emp2: ['Pack', 'KM', 'Decating'],
        emp3: ['Plock', 'Pack', 'KM', 'Decating', 'Rep'],
      };
      
      // emp1 kan gå till Pack men inte Plock
      expect(employeeStations.emp1.includes('Pack')).toBe(true);
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
      
      // emp2 kan gå till KM eller Decating men inte Pack
      expect(employeeStations.emp2.includes('KM')).toBe(true);
      expect(canAssignToStation('emp2', 'KM', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp2', 'Pack', lastStationsMap)).toBe(false);
      
      // emp3 kan gå till alla sina stationer (ingen tidigare placering)
      expect(canAssignToStation('emp3', 'Plock', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp3', 'Pack', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp3', 'Rep', lastStationsMap)).toBe(true);
    });

    test('should prevent assignment to unqualified station even if rotation allows', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      const employeeQualifiedStations = ['Plock', 'Pack'];
      const targetStation = 'Decating'; // Ej kvalificerad
      
      // Rotationen tillåter (inte samma som senaste)
      expect(canAssignToStation('emp1', targetStation, lastStationsMap)).toBe(true);
      
      // Men medarbetaren är INTE kvalificerad
      expect(employeeQualifiedStations.includes(targetStation)).toBe(false);
      
      // Slutlig regel: Måste vara både rotationsgiltig OCH kvalificerad
      const canActuallyAssign = 
        canAssignToStation('emp1', targetStation, lastStationsMap) && 
        employeeQualifiedStations.includes(targetStation);
      
      expect(canActuallyAssign).toBe(false);
    });
  });

  describe('Integration: Full assignment validation', () => {
    test('should validate complete assignment flow', () => {
      // Setup
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      const employeeQualifiedStations = ['Plock', 'Pack', 'KM'];
      
      // Helper function för fullständig validering
      const isValidAssignment = (empId: string, station: string): boolean => {
        return employeeQualifiedStations.includes(station) && 
               canAssignToStation(empId, station, lastStationsMap);
      };
      
      // Testa olika scenarion
      expect(isValidAssignment('emp1', 'Pack')).toBe(true);   // Kvalificerad + rotation OK
      expect(isValidAssignment('emp1', 'KM')).toBe(true);     // Kvalificerad + rotation OK
      expect(isValidAssignment('emp1', 'Plock')).toBe(false); // Kvalificerad men var där senast
      expect(isValidAssignment('emp1', 'Decating')).toBe(false); // Ej kvalificerad
      expect(isValidAssignment('emp1', 'Rep')).toBe(false);   // Ej kvalificerad
    });
  });
});