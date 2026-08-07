import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Trash2, UserCheck, UserX, Settings, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStations } from "@/hooks/useStations";
import { useGroups, type Group } from "@/hooks/useGroups";
import { ALL_SHIFTS, DEFAULT_SHIFT, SHIFTS } from "@/config/shifts";
import { monthsBefore, todayKey } from "@/utils/date";

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  shift: string;
  /** Null = medarbetaren är inte indelad i något arbetslag */
  group_id: string | null;
}

// Radix Select tillåter inte tomma värden, så "ingen grupp" och "alla grupper"
// behöver egna nycklar. De sparas aldrig — group_id blir null respektive filtret
// släpper igenom allt.
const NO_GROUP = "utan-grupp";
const ALL_GROUPS = "alla-grupper";

const EmployeeManagement = () => {
  const { stationNames } = useStations();
  const { groups, error: groupsError, refresh: refreshGroups } = useGroups();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeShift, setNewEmployeeShift] = useState<string>(DEFAULT_SHIFT);
  const [newEmployeeGroup, setNewEmployeeGroup] = useState<string>(NO_GROUP);
  const [newGroupName, setNewGroupName] = useState("");
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<Group | null>(null);
  const [confirmGroupDelete, setConfirmGroupDelete] = useState(false);
  const [filterShift, setFilterShift] = useState<string>(ALL_SHIFTS);
  const [filterGroup, setFilterGroup] = useState<string>(ALL_GROUPS);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [recentWork, setRecentWork] = useState<{station: string, work_date: string}[]>([]);
  const [employeeStations, setEmployeeStations] = useState<string[]>([]);
  const [stationStats, setStationStats] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte hämta medarbetare",
        variant: "destructive",
      });
    } else {
      setEmployees(data || []);
    }
  };

  const addEmployee = async () => {
    if (!newEmployeeName.trim()) {
      toast({
        title: "Namn krävs",
        description: "Ange ett namn för medarbetaren",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("employees").insert([
      {
        name: newEmployeeName.trim(),
        shift: newEmployeeShift,
        // group_id skickas bara när en grupp valts, så att medarbetare går att
        // lägga till även innan grupp-migrationen är körd
        ...(newEmployeeGroup !== NO_GROUP && { group_id: newEmployeeGroup }),
      },
    ]);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte lägga till medarbetare",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tillagd!",
        description: `${newEmployeeName} har lagts till`,
      });
      setNewEmployeeName("");
      setNewEmployeeShift(DEFAULT_SHIFT);
      // Gruppen behålls — man lägger oftast upp ett helt lag i följd
      fetchEmployees();
    }
    setLoading(false);
  };

  const addGroup = async () => {
    const trimmed = newGroupName.trim();

    if (!trimmed) {
      toast({
        title: "Namn krävs",
        description: "Ange ett namn för gruppen",
        variant: "destructive",
      });
      return;
    }

    if (groups.some((group) => group.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: "Gruppen finns redan",
        description: `Det finns redan en grupp som heter ${trimmed}`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("groups").insert([{ name: trimmed }]);

    if (error) {
      toast({
        title: "Kunde inte skapa gruppen",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Skapad!", description: `Gruppen ${trimmed} har lagts till` });
    setNewGroupName("");
    refreshGroups();
  };

  const deleteGroup = async (group: Group) => {
    setConfirmGroupDelete(false);

    const { error } = await supabase.from("groups").delete().eq("id", group.id);

    if (error) {
      toast({
        title: "Kunde inte ta bort gruppen",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Borttagen!",
      description: `Gruppen ${group.name} har tagits bort`,
    });

    // Medarbetarna finns kvar men står nu utan grupp (ON DELETE SET NULL)
    if (filterGroup === group.id) setFilterGroup(ALL_GROUPS);
    if (newEmployeeGroup === group.id) setNewEmployeeGroup(NO_GROUP);
    refreshGroups();
    fetchEmployees();
  };

  const changeEmployeeGroup = async (employee: Employee, value: string) => {
    const groupId = value === NO_GROUP ? null : value;

    const { error } = await supabase
      .from("employees")
      .update({ group_id: groupId })
      .eq("id", employee.id);

    if (error) {
      toast({
        title: "Fel",
        description: `Kunde inte byta grupp: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === employee.id ? { ...e, group_id: groupId } : e))
    );
  };

  const toggleEmployeeStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uppdaterad!",
        description: "Status har ändrats",
      });
      fetchEmployees();
    }
  };

  const openEmployeeDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    
    try {
      // Hämta medarbetarens stationer
      const { data: stationsData } = await supabase
        .from("employee_stations")
        .select("station")
        .eq("employee_id", employee.id);
      
      setEmployeeStations(stationsData?.map(d => d.station) || []);
  
      // Hämta statistik för senaste 6 månaderna
      const { data: historyData } = await supabase
        .from("work_history")
        .select("station, work_date")
        .eq("employee_id", employee.id)
        .gte("work_date", monthsBefore(todayKey(), 6))
        .order('work_date', { ascending: false });
      
      // Räkna antal gånger per station
      const stats: Record<string, number> = {};
      historyData?.forEach(record => {
        stats[record.station] = (stats[record.station] || 0) + 1;
      });
      setStationStats(stats);
  
      // Senaste 5 stationerna
      setRecentWork(historyData?.slice(0, 5) || []);
      
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte hämta medarbetardata",
        variant: "destructive",
      });
    }
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

  const deleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${name}?`)) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort medarbetare",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Borttagen!",
        description: `${name} har tagits bort`,
      });
      fetchEmployees();
    }
  };

  const visibleEmployees = employees.filter((employee) => {
    const matchesShift = filterShift === ALL_SHIFTS || employee.shift === filterShift;
    const matchesGroup =
      filterGroup === ALL_GROUPS ||
      (filterGroup === NO_GROUP ? !employee.group_id : employee.group_id === filterGroup);
    return matchesShift && matchesGroup;
  });

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-6 w-6" />
          Medarbetarhantering
        </CardTitle>
        <CardDescription>
          Lägg till och hantera medarbetare som kan tilldelas arbetsstationer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="employee-name">Namn på medarbetare</Label>
            <Input
              className="bg-sidebar-input"
              id="employee-name"
              placeholder="Ange namn..."
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmployee()}
            />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="employee-shift" bg-sidebar-input>Skift</Label>
            <Select value={newEmployeeShift} onValueChange={setNewEmployeeShift}>
              <SelectTrigger id="employee-shift" className="bg-sidebar-input"> 
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="">
                {SHIFTS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!groupsError && (
            <div className="w-48 space-y-2">
              <Label htmlFor="employee-group">Grupp</Label>
              <Select value={newEmployeeGroup} onValueChange={setNewEmployeeGroup}>
                <SelectTrigger id="employee-group" className="bg-sidebar-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>Ingen grupp</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end">
            <Button
              onClick={addEmployee}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-80 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Button>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Grupper</h3>
            <p className="text-sm text-muted-foreground">
              Arbetslag som medarbetarna kan delas in i. En medarbetare hör till
              en grupp.
            </p>
          </div>

          {groupsError ? (
            <p className="rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
              {groupsError}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  className="max-w-xs bg-sidebar-input"
                  placeholder="Namn på grupp..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGroup()}
                />
                <Button variant="outline" onClick={addGroup} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Skapa grupp
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga grupper än. Skapa den första ovan.
                  </p>
                ) : (
                  groups.map((group) => (
                    <Badge
                      key={group.id}
                      variant="secondary"
                      className="gap-2 py-1.5 pl-3 pr-1.5 text-sm font-normal"
                    >
                      {group.name}
                      <span className="text-muted-foreground">
                        {employees.filter((e) => e.group_id === group.id).length}
                      </span>
                      <button
                        onClick={() => {
                          setPendingDeleteGroup(group);
                          setConfirmGroupDelete(true);
                        }}
                        aria-label={`Ta bort gruppen ${group.name}`}
                        className="rounded-full p-0.5 transition-colors hover:bg-destructive/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-foreground">
              Medarbetare ({visibleEmployees.length})
            </h3>
            <div className="flex gap-2">
              {!groupsError && (
                <div className="w-48">
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="bg-sidebar-input">
                      <SelectValue placeholder="Välj grupp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_GROUPS}>Alla grupper</SelectItem>
                      <SelectItem value={NO_GROUP}>Utan grupp</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="w-48">
                <Select value={filterShift} onValueChange={setFilterShift}>
                  <SelectTrigger className="bg-sidebar-input">
                    <SelectValue placeholder="Välj skift" />
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
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            {visibleEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {employees.length === 0
                  ? "Inga medarbetare än. Lägg till din första medarbetare ovan."
                  : "Inga medarbetare matchar filtret."}
              </p>
            ) : (
              visibleEmployees.map((employee) => (
                <Card
                  key={employee.id}
                  className="p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => openEmployeeDetails(employee)}
                      className="font-medium hover:text-primary transition-colors cursor-pointer text-left"
                    >
                      {employee.name}
                    </button>
                    <Badge
                      variant={employee.is_active ? "default" : "secondary"}
                      className={
                        employee.is_active
                          ? "bg-success text-success-foreground"
                          : ""
                      }
                    >
                      {employee.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <Badge variant="outline">{employee.shift}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {!groupsError && (
                      <Select
                        value={employee.group_id ?? NO_GROUP}
                        onValueChange={(value) => changeEmployeeGroup(employee, value)}
                      >
                        <SelectTrigger
                          className="h-9 w-44 bg-sidebar-input"
                          aria-label={`Grupp för ${employee.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_GROUP}>Ingen grupp</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleEmployeeStatus(employee.id, employee.is_active)
                      }
                      className="gap-2"
                    >
                      {employee.is_active ? (
                        <>
                          <UserX className="h-4 w-4" />
                          Inaktivera
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Aktivera
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteEmployee(employee.id, employee.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </CardContent>

      <EmployeeDetailsDialog
  employee={selectedEmployee}
  onOpenChange={(open) => !open && setSelectedEmployee(null)}
  employeeStations={employeeStations}
  stationStats={stationStats}
  recentWork={recentWork}
  stations={stationNames}
  onToggleStation={toggleStation}
/>

      <AlertDialog open={confirmGroupDelete} onOpenChange={setConfirmGroupDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ta bort gruppen {pendingDeleteGroup?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Medarbetarna i gruppen ligger kvar, men står sedan utan grupp tills
              du delar in dem på nytt. Inget annat påverkas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDeleteGroup && deleteGroup(pendingDeleteGroup)}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default EmployeeManagement;
