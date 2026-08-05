import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StationCard } from "@/components/StationCard";
import { StationNeedsCard } from "@/components/StationNeedsCard";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Shuffle, Search, Info, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { getEmployeesLastStations } from "@/utils/stationRotation";
import { distributeEmployees, type DistributableEmployee } from "@/utils/distribution";
import { useStations } from "@/hooks/useStations";
import { PlanningHeader } from "@/components/PlanningHeader";
import { StationsMissingNotice } from "@/components/StationsMissingNotice";
import { monthsBefore, todayKey } from "@/utils/date";
import { ALL_SHIFTS, DEFAULT_SHIFT, SHIFTS, type Shift } from "@/config/shifts";

interface Employee {
  id: string;
  name: string;
  shift: string;
  is_active: boolean;
}

interface StationNeed {
  station: string;
  count: number;
}

const DailyPlanning = () => {
  const {
    stationNames,
    topLevelStationNames,
    getSubStationNames,
    getSlots: getStationSlots,
    getLayout,
    autoAssignedStationNames,
    manualStationName,
    loading: stationsLoading,
    error: stationsError,
    isEmpty: noStations,
  } = useStations();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [stationNeeds, setStationNeeds] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [flManual, setFlManual] = useState("");
  const [hasUnsavedNeeds, setHasUnsavedNeeds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedEmployee, setDraggedEmployee] = useState<{ id: string; fromStation: string } | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Vilka medarbetare som visas i urvalslistan. Följer planeringsskiftet, men
  // kan sättas till "Alla" för att hämta in folk från ett annat skift.
  const [shiftFilter, setShiftFilter] = useState<string>(DEFAULT_SHIFT);
  const [flPopoverOpen, setFlPopoverOpen] = useState(false);
  const [warningDialog, setWarningDialog] = useState<{
    show: boolean;
    employeeName: string;
    toStation: string;
    count: number;
    onConfirm: () => void;
  } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeStations, setEmployeeStations] = useState<string[]>([]);
  const [stationStats, setStationStats] = useState<Record<string, number>>({});
  const [recentWork, setRecentWork] = useState<{station: string, work_date: string}[]>([]);
  // Allt på sidan gäller det valda datumet och skiftet, inte nödvändigtvis idag
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [planningShift, setPlanningShift] = useState<Shift>(DEFAULT_SHIFT);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Läses om när datumet byts. Måste ske efter att stationerna hämtats:
  // platslayouten avgör var varje medarbetare hamnar, och den kommer från
  // stations-tabellen.
  useEffect(() => {
    if (stationsLoading) return;
    loadNeeds();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationsLoading, selectedDate, planningShift]);

  // Byter man planeringsskift är det rimligast att se det skiftets medarbetare
  useEffect(() => {
    setShiftFilter(planningShift);
    setSelectedEmployees([]);
  }, [planningShift]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, name, shift, is_active")
      .eq("is_active", true)
      .order("name");

    setEmployees(data || []);
  };

  const loadNeeds = async () => {
    const { data } = await supabase
      .from("station_needs")
      .select("station, needed_count")
      .eq("need_date", selectedDate)
      .eq("shift", planningShift);

    // Nollställ alltid, annars ligger föregående datums behov kvar
    const needsMap: Record<string, number> = {};
    data?.forEach((item) => {
      needsMap[item.station] = item.needed_count;
    });
    setStationNeeds(needsMap);
    setHasUnsavedNeeds(false);
  };

  const loadAssignments = async () => {
    const { data } = await supabase
      .from("daily_assignments")
      .select("employee_id, station, lane")
      .eq("assigned_date", selectedDate)
      .eq("shift", planningShift)
      .order("lane", { ascending: true, nullsFirst: false });

    // Nollställ alltid, annars ligger föregående datums tilldelningar kvar
    const assignmentsMap: Record<string, string[]> = {};

    data?.forEach((item) => {
      const slots = getStationSlots(item.station);

      if (slots === null) {
        // Listlayout: ordningen räcker
        if (!assignmentsMap[item.station]) assignmentsMap[item.station] = [];
        assignmentsMap[item.station].push(item.employee_id);
        return;
      }

      // Numrerade platser: lägg tillbaka på samma plats som vid sparning
      if (!assignmentsMap[item.station]) {
        assignmentsMap[item.station] = Array(slots).fill("");
      }
      const target =
        item.lane !== null && item.lane >= 0 && item.lane < slots
          ? item.lane
          : assignmentsMap[item.station].findIndex((id) => !id);

      if (target !== -1) {
        assignmentsMap[item.station][target] = item.employee_id;
      }
    });

    setAssignments(assignmentsMap);
  };

  const saveStationNeeds = async () => {
    setLoading(true);

    for (const station of stationNames) {
      const count = stationNeeds[station] || 0;
      await supabase.from("station_needs").upsert(
        {
          station,
          needed_count: count,
          need_date: selectedDate,
          shift: planningShift,
        },
        { onConflict: "station,need_date,shift" }
      );
    }

    setLoading(false);
    setHasUnsavedNeeds(false);
    toast({
      title: "Sparat!",
      description: "Personalbehovet har sparats",
    });
  };

  const getEmployeeHistory = async (employeeId: string) => {
    // Historiken räknas bakåt från det datum som planeras, inte från idag
    const { data } = await supabase
      .from("work_history")
      .select("station")
      .eq("employee_id", employeeId)
      .gte("work_date", monthsBefore(selectedDate, 6))
      .lt("work_date", selectedDate);

    const stationCount: Record<string, number> = {};
    data?.forEach((item) => {
      stationCount[item.station] = (stationCount[item.station] || 0) + 1;
    });

    return stationCount;
  };

  const getEmployeeCompetencies = async (employeeIds: string[]): Promise<Map<string, Set<string>>> => {
    const competenciesMap = new Map<string, Set<string>>();
    
    // Initialize all employees with empty set
    employeeIds.forEach(id => competenciesMap.set(id, new Set()));
    
    if (employeeIds.length === 0) return competenciesMap;
    
    const { data } = await supabase
      .from("employee_stations")
      .select("employee_id, station")
      .in("employee_id", employeeIds);
    
    if (data) {
      data.forEach((item) => {
        const existing = competenciesMap.get(item.employee_id) || new Set();
        existing.add(item.station);
        competenciesMap.set(item.employee_id, existing);
      });
    }
    
    return competenciesMap;
  };

  const handleDistribute = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "Ingen vald",
        description: "Välj minst en medarbetare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Hämta underlaget: senaste station, kompetenser och historik per medarbetare
    const lastStationsMap = await getEmployeesLastStations(selectedEmployees);
    const competenciesMap = await getEmployeeCompetencies(selectedEmployees);

    const employees: DistributableEmployee[] = await Promise.all(
      selectedEmployees.map(async (empId) => ({
        id: empId,
        history: await getEmployeeHistory(empId),
        lastStation: lastStationsMap.get(empId) || null,
        competencies: competenciesMap.get(empId) || new Set<string>(),
      }))
    );

    const { assignments: newAssignments, assignedIds, unassignedIds } =
      distributeEmployees({
        employees,
        stations: autoAssignedStationNames,
        stationNeeds,
      });

    // Den manuellt bemannade stationen fördelas inte automatiskt
    if (manualStationName && flManual.trim()) {
      newAssignments[manualStationName] = [flManual];
    }

    setAssignments(newAssignments);
    setLoading(false);

    const unassignedMsg = unassignedIds.length > 0
      ? ` ${unassignedIds.length} medarbetare saknar kompetens för lediga stationer.`
      : "";

    toast({
      title: "Fördelning klar!",
      description: `${assignedIds.size} medarbetare har tilldelats stationer.${unassignedMsg} Klicka på Spara för att spara till databasen.`,
    });
  };

  // const getEmployeeName = (id: string) => {
  //   return employees.find((e) => e.id === id)?.name || id;
  // };

  const getEmployeeShortName = (empId: string) => {
    const employee = employees.find(e => e.id === empId);
    if (!employee) return empId;
    
    const nameParts = employee.name.split(' ');
    if (nameParts.length === 1) return nameParts[0];
    
    const firstName = nameParts[0];
    const lastInitial = nameParts[nameParts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  };

  const handleDragStart = (employeeId: string, fromStation: string) => {
    setDraggedEmployee({ id: employeeId, fromStation });
    setDraggedFrom(fromStation);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toStation: string) => {
    if (!draggedEmployee || draggedEmployee.fromStation === toStation) {
      setDraggedEmployee(null);
      return;
    }

    // Check if employee has been at this station the most
    const history = await getEmployeeHistory(draggedEmployee.id);
    const stationCount = history[toStation] || 0;
    
    // Find the station with the highest count
    const maxStation = Object.entries(history).reduce((max, [station, count]) => 
      count > max.count ? { station, count } : max,
      { station: '', count: 0 }
    );
    
    // Show warning if moving to the station they've been to the most (and at least 3 times)
    if (maxStation.station === toStation && stationCount >= 3) {
      setWarningDialog({
        show: true,
        employeeName: getEmployeeShortName(draggedEmployee.id),
        toStation,
        count: stationCount,
        onConfirm: () => performMove(toStation),
      });
      return;
    }

    await performMove(toStation);
  };

  const performMove = async (toStation: string) => {
    if (!draggedEmployee) return;

    setLoading(true);

    // Remove from old station
    const updatedAssignments = { ...assignments };
    
    // Only try to remove if not from unassigned list
    if (draggedEmployee.fromStation !== "unassigned" && updatedAssignments[draggedEmployee.fromStation]) {
      updatedAssignments[draggedEmployee.fromStation] = updatedAssignments[draggedEmployee.fromStation].filter(
        (id) => id !== draggedEmployee.id
      );
    }

    // Add to new station
    if (!updatedAssignments[toStation]) {
      updatedAssignments[toStation] = [];
    }
    updatedAssignments[toStation].push(draggedEmployee.id);

    setAssignments(updatedAssignments);
    setDraggedEmployee(null);
    setWarningDialog(null);
    setLoading(false);

    toast({
      title: "Flyttad!",
      description: `${getEmployeeShortName(draggedEmployee.id)} har flyttats till ${toStation}. Kom ihåg att spara!`,
    });
  };

  const handleDropOnPackPosition = (station: string, targetIdx: number) => {
    if (!draggedEmployee || !draggedFrom) return;
  
    setAssignments((prev) => {
      const updated = { ...prev };
      
      // Specialfall: Om draggedFrom är "unassigned", skapa det inte i updated
      if (draggedFrom !== "unassigned") {
        // Säkerställ att draggedFrom station existerar
        if (!updated[draggedFrom]) {
          console.warn(`Station ${draggedFrom} har inga tilldelningar`);
          return prev;
        }
        
        // Ta bort från ursprunglig plats
        if (draggedFrom === station) {
          // Flyttar inom samma station
          const sourceIdx = updated[draggedFrom].indexOf(draggedEmployee.id);
          if (sourceIdx !== -1) {
            updated[draggedFrom] = [...updated[draggedFrom]];
            updated[draggedFrom][sourceIdx] = "";
          }
        } else {
          // Flyttar från annan station
          if (Array.isArray(updated[draggedFrom])) {
            updated[draggedFrom] = updated[draggedFrom].filter((id) => id !== draggedEmployee.id);
          }
        }
      }
  
      // Lägg till på ny plats
      const maxPositions = getStationSlots(station) ?? 6;
      if (!updated[station]) {
        updated[station] = Array(maxPositions).fill("");
      }
      
      // Säkerställ att vi har en array med rätt storlek
      if (updated[station].length < maxPositions) {
        updated[station] = [...updated[station], ...Array(maxPositions - updated[station].length).fill("")];
      }
      
      updated[station] = [...updated[station]];
      updated[station][targetIdx] = draggedEmployee.id;
  
      return updated;
    });
  
    setDraggedEmployee(null);
    setDraggedFrom(null);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === ALL_SHIFTS || emp.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const openEmployeeDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    
    // Hämta medarbetarens stationer
    const { data } = await supabase
      .from("employee_stations")
      .select("station")
      .eq("employee_id", employee.id);
    
    setEmployeeStations(data?.map(d => d.station) || []);

    // Hämta statistik för senaste 6 månaderna
    const { data: historyData } = await supabase
      .from("work_history")
      .select("station")
      .eq("employee_id", employee.id)
      .gte("work_date", monthsBefore(selectedDate, 6));
    
    // Räkna antal gånger per station
    const stats: Record<string, number> = {};
    historyData?.forEach(record => {
      stats[record.station] = (stats[record.station] || 0) + 1;
    });
    setStationStats(stats);

    // Hämta de senaste 5 tilldelningarna från sparade fördelningar
    const { data: recentHistory } = await supabase
      .from("daily_assignments")
      .select("station, assigned_date")
      .eq("employee_id", employee.id)
      .order("assigned_date", { ascending: false })
      .limit(5);
    
    setRecentWork(recentHistory?.map(r => ({ station: r.station, work_date: r.assigned_date })) || []);
  };

  const toggleStation = async (station: string) => {
    if (!selectedEmployee) return;

    const hasStation = employeeStations.includes(station);
    
    if (hasStation) {
      // Ta bort station
      const { error } = await supabase
        .from("employee_stations")
        .delete()
        .eq("employee_id", selectedEmployee.id)
        .eq("station", station);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte ta bort station",
          variant: "destructive",
        });
      } else {
        setEmployeeStations(prev => prev.filter(s => s !== station));
      }
    } else {
      // Lägg till station
      const { error } = await supabase
        .from("employee_stations")
        .insert([{ employee_id: selectedEmployee.id, station }]);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte lägga till station",
          variant: "destructive",
        });
      } else {
        setEmployeeStations(prev => [...prev, station]);
      }
    }
  };

  const clearAllAssignments = () => {
    // Rensa assignments state (sparas inte till databasen förrän användaren klickar på Spara)
    setAssignments({});

    toast({
      title: "Rensat!",
      description: "Alla stationer har tömts på medarbetare. Klicka på Spara för att spara ändringarna.",
    });
  };

  const saveAllAssignments = async () => {
    setLoading(true);

    try {
      const assignmentsToSave: TablesInsert<"daily_assignments">[] = [];
      const historyToSave: TablesInsert<"work_history">[] = [];

      // En medarbetare får bara ha en tilldelning per dag (unikt villkor i
      // databasen). Den manuellt bemannade stationen hanteras först, så att ett
      // handplockat val vinner över en automatisk placering om samma person
      // hamnat på båda.
      const stationOrder = Object.keys(assignments).sort((a, b) =>
        a === manualStationName ? -1 : b === manualStationName ? 1 : 0
      );
      const placedAt = new Map<string, string>();
      const duplicates: string[] = [];

      for (const station of stationOrder) {
        (assignments[station] || []).forEach((empId, index) => {
          if (!empId) return; // Skippa tomma platser

          if (placedAt.has(empId)) {
            duplicates.push(getEmployeeShortName(empId));
            return;
          }
          placedAt.set(empId, station);

          assignmentsToSave.push({
            employee_id: empId,
            station,
            assigned_date: selectedDate,
            shift: planningShift,
            lane: index,
          });
          historyToSave.push({
            employee_id: empId,
            station,
            work_date: selectedDate,
            shift: planningShift,
            lane: index,
          });
        });
      }

      // Ta bort befintliga tilldelningar för datumet och skiftet. Andra skift
      // samma dag rörs inte.
      const { error: deleteAssignmentsError } = await supabase
        .from("daily_assignments")
        .delete()
        .eq("assigned_date", selectedDate)
        .eq("shift", planningShift);
      if (deleteAssignmentsError) throw deleteAssignmentsError;

      const { error: deleteHistoryError } = await supabase
        .from("work_history")
        .delete()
        .eq("work_date", selectedDate)
        .eq("shift", planningShift);
      if (deleteHistoryError) throw deleteHistoryError;

      if (assignmentsToSave.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from("daily_assignments")
          .insert(assignmentsToSave);
        if (insertAssignmentsError) throw insertAssignmentsError;

        const { error: insertHistoryError } = await supabase
          .from("work_history")
          .insert(historyToSave);
        if (insertHistoryError) throw insertHistoryError;
      }

      const duplicateMsg = duplicates.length > 0
        ? ` ${duplicates.join(", ")} fanns på flera stationer och sparades bara en gång.`
        : "";

      toast({
        title: "Sparat!",
        description: `${assignmentsToSave.length} tilldelningar har sparats till databasen.${duplicateMsg}`,
      });
    } catch (err) {
      console.error("Kunde inte spara tilldelningarna:", err);

      // Supabase-fel har message/details, men fångar även vanliga Error
      const supabaseError = err as { message?: string; details?: string };
      const message = supabaseError?.message || "Okänt fel vid sparning";
      const details = supabaseError?.details ? ` – ${supabaseError.details}` : "";

      toast({
        title: "Kunde inte spara",
        description: `${message}${details}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (noStations) {
    return <StationsMissingNotice error={stationsError} />;
  }

  return (
    <div className="space-y-6">
      <PlanningHeader
        date={selectedDate}
        onDateChange={setSelectedDate}
        shift={planningShift}
        onShiftChange={setPlanningShift}
      />

      <StationNeedsCard
  stations={stationNames}
  manualStationName={manualStationName}
  stationNeeds={stationNeeds}
  onUpdateNeed={(station, count) => {
    setStationNeeds({
      ...stationNeeds,
      [station]: count,
    });
    setHasUnsavedNeeds(true);
  }}
  onSave={saveStationNeeds}
  loading={loading}
  hasUnsavedChanges={hasUnsavedNeeds}
/>

      <Card className="shadow-lg border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Välj medarbetare
          </CardTitle>
          <CardDescription>
            Välj vilka som arbetar den valda dagen innan du fördelar till stationer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
  <div className="flex gap-4 mb-4">
    <div className="flex-1 relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Sök medarbetare..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9 bg-sidebar-input"
      />
    </div>
    <Select value={shiftFilter} onValueChange={setShiftFilter}>
      <SelectTrigger className="w-40 bg-sidebar-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SHIFTS}>Alla skift</SelectItem>
        {SHIFTS.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button
      variant="outline"
      onClick={() => {
        if (selectedEmployees.length === filteredEmployees.length) {
          // Avmarkera alla
          setSelectedEmployees([]);
        } else {
          // Välj alla filtrerade medarbetare
          setSelectedEmployees(filteredEmployees.map(e => e.id));
        }
      }}
      className="whitespace-nowrap"
    >
      {selectedEmployees.length === filteredEmployees.length ? 'Avmarkera alla' : 'Välj alla'}
    </Button>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {filteredEmployees.map((employee) => (
      <div
        key={employee.id}
        className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50 hover:bg-backdrop-blur-lg"
      >
        <Checkbox
          id={employee.id}
          checked={selectedEmployees.includes(employee.id)}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedEmployees([...selectedEmployees, employee.id]);
            } else {
              setSelectedEmployees(
                selectedEmployees.filter((id) => id !== employee.id)
              );
            }
          }}
        />
        <label
          htmlFor={employee.id}
          className="text-sm font-medium leading-none cursor-pointer flex-1"
        >
          {employee.name}
        </label>
        <button
          onClick={(e) => {
            e.preventDefault();
            openEmployeeDetails(employee);
          }}
          className="ml-auto p-1 rounded-full hover:bg-primary/20 transition-colors"
          title="Visa information"
        >
          <Info className="h-4 w-4 text-primary" />
        </button>
      </div>
    ))}
  </div>
  <div className="space-y-2 pt-4 border-t">
  <Label htmlFor="fl-manual">FL Station</Label>
  <Popover open={flPopoverOpen} onOpenChange={setFlPopoverOpen}>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={flPopoverOpen}
        className="w-full justify-between bg-white hover:bg-primary/20"
      >
        {flManual
          ? employees.find((e) => e.id === flManual)?.name || "Välj medarbetare..."
          : "Välj medarbetare..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-full p-0">
      <Command className="w-96">
        <CommandInput placeholder="Sök medarbetare..." />
        <CommandList>
          <CommandEmpty>Ingen medarbetare hittades.</CommandEmpty>
          <CommandGroup>
            {employees.map((employee) => (
              <CommandItem
                key={employee.id}
                value={employee.name}
                onSelect={() => {
                  setFlManual(employee.id);
                  setFlPopoverOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    flManual === employee.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {employee.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</div>

          <Button
            onClick={handleDistribute}
            disabled={loading || selectedEmployees.length === 0}
            className="w-full gap-2 bg-gradient-to-r from-accent to-primary"
          >
            <Shuffle className="h-4 w-4" />
            Fördela medarbetare till stationer
          </Button>
         </CardContent>
      </Card>


     {/* Tilldelnings kortet */}
{Object.keys(assignments).length > 0 && (
  <Card className="shadow-lg border-border/50">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">Tilldelningar</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Unassigned employees list */}
        {(() => {
          const assignedEmployeeIds = new Set(
            Object.values(assignments).flat().filter(id => id)
          );
          const unassignedEmployees = selectedEmployees.filter(
            empId => !assignedEmployeeIds.has(empId)
          );

         
            return (
              <Card className="p-4 bg-gradient-to-br from-accent/20 to-primary/20 backdrop-blur-md border border-accent/50 shadow-xl col-span-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">
                    Ofördelade medarbetare
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent/60 text-accent-foreground">
                    {unassignedEmployees.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unassignedEmployees.map((empId) => (
                    <div
                      key={empId}
                      draggable
                      onDragStart={() => handleDragStart(empId, "unassigned")}
                      className="text-sm text-foreground cursor-move px-3 py-2 rounded-lg bg-background/80 hover:bg-primary/25 backdrop-blur-sm transition-all duration-200 border border-border/30"
                    >
                      {getEmployeeShortName(empId)}
                    </div>
                  ))}
                </div>
              </Card>
            );
        }
        )()}

{topLevelStationNames.map((station) => {
  const assigned = assignments[station] || [];
  const needed = stationNeeds[station] || 0;

  return (
    <StationCard
      key={station}
      station={station}
      assigned={assigned}
      needed={needed}
      layout={getLayout(station)}
      slots={getStationSlots(station)}
      isManual={station === manualStationName}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragStart={handleDragStart}
      onDropOnPackPosition={handleDropOnPackPosition}
      getEmployeeShortName={getEmployeeShortName}
      subStations={getSubStationNames(station)}
      assignments={assignments}
      stationNeeds={stationNeeds}
    />
  );
})}
      </div>
      {Object.keys(assignments).length > 0 && (
        <div className="flex justify-center gap-4 mt-4">
          <Button
            onClick={saveAllAssignments}
            disabled={loading}
            className="w-1/3 bg-gradient-to-r from-primary to-accent"
          >
            Spara
          </Button>
          <Button
            onClick={clearAllAssignments}
            disabled={loading}
            variant="destructive"
            className="w-1/3"
          >
            Rensa
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
)}

      <AlertDialog open={warningDialog?.show} onOpenChange={(open) => !open && setWarningDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Varning: Ofta besökt station</AlertDialogTitle>
            <AlertDialogDescription>
              {warningDialog?.employeeName} har varit på {warningDialog?.toStation}{" "}
              {warningDialog?.count} gånger under de senaste 6 månaderna, vilket är mer än genomsnittet.
              Är du säker på att du vill flytta till denna station?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => warningDialog?.onConfirm()}>
              Bekräfta flytt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog för medarbetarinformation */}
      <EmployeeDetailsDialog
  employee={selectedEmployee}
  onOpenChange={(open) => !open && setSelectedEmployee(null)}
  employeeStations={employeeStations}
  stationStats={stationStats}
  recentWork={recentWork}
  stations={stationNames}
  onToggleStation={toggleStation}
/>
    </div>
  );
};

export default DailyPlanning;
