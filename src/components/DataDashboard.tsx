import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  CalendarRange,
  CircleDashed,
  Database,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { todayKey, toDateKey } from "@/utils/date";

interface SummaryStat {
  label: string;
  value: number;
  description: string;
  accentClass: string;
  icon: typeof Users;
}

interface TrendPoint {
  date: string;
  label: string;
  behov: number;
  planerat: number;
}

interface StationNeedPoint {
  station: string;
  behov: number;
  planerat: number;
  differens: number;
}

interface ShiftMixPoint {
  shift: string;
  count: number;
}

const CHART_COLORS = ["#4f46e5", "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

const toShortDateLabel = (dateKey: string) =>
  new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric" }).format(
    new Date(`${dateKey}T00:00:00`),
  );

const getLastSevenDates = () => {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(toDateKey(date));
  }

  return dates;
};

const DataDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryStat[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<TrendPoint[]>([]);
  const [stationNeedData, setStationNeedData] = useState<StationNeedPoint[]>([]);
  const [shiftMix, setShiftMix] = useState<ShiftMixPoint[]>([]);

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = todayKey();
    const lastSevenDates = getLastSevenDates();

    const [employeesResult, assignmentsResult, needsResult, stationsResult] = await Promise.all([
      supabase.from("employees").select("id, is_active, shift, name"),
      supabase.from("daily_assignments").select("assigned_date, station, shift"),
      supabase.from("station_needs").select("need_date, station, needed_count, shift"),
      supabase.from("stations").select("name, is_active, slots"),
    ]);

    const employees = employeesResult.data ?? [];
    const assignments = assignmentsResult.data ?? [];
    const needs = needsResult.data ?? [];
    const stations = stationsResult.data ?? [];

    const activeEmployees = employees.filter((employee) => employee.is_active).length;
    const assignedToday = assignments.filter((assignment) => assignment.assigned_date === today).length;
    const neededToday = needs
      .filter((need) => need.need_date === today)
      .reduce((sum, need) => sum + (need.needed_count ?? 0), 0);
    const activeStations = stations.filter((station) => station.is_active).length;
    const utilization = neededToday === 0 ? 0 : Math.round((assignedToday / neededToday) * 100);

    const stationAssignmentsToday = assignments
      .filter((assignment) => assignment.assigned_date === today)
      .reduce<Record<string, number>>((acc, assignment) => {
        acc[assignment.station] = (acc[assignment.station] ?? 0) + 1;
        return acc;
      }, {});

    const stationNeedToday = needs
      .filter((need) => need.need_date === today)
      .reduce<Record<string, number>>((acc, need) => {
        acc[need.station] = (acc[need.station] ?? 0) + (need.needed_count ?? 0);
        return acc;
      }, {});

    const stationNeedPoints = Array.from(
      new Set([...Object.keys(stationNeedToday), ...Object.keys(stationAssignmentsToday)]),
    )
      .map((station) => {
        const behov = stationNeedToday[station] ?? 0;
        const planerat = stationAssignmentsToday[station] ?? 0;
        return {
          station,
          behov,
          planerat,
          differens: behov - planerat,
        };
      })
      .sort((a, b) => b.behov - a.behov)
      .slice(0, 6);

    const byShift = employees.reduce<Record<string, number>>((acc, employee) => {
      const shift = employee.shift || "Okänd";
      acc[shift] = (acc[shift] ?? 0) + 1;
      return acc;
    }, {});

    const shiftMixData = Object.entries(byShift)
      .map(([shift, count]) => ({ shift, count }))
      .sort((a, b) => b.count - a.count);

    const weeklyTrendData: TrendPoint[] = lastSevenDates.map((dateKey) => {
      const neededForDate = needs
        .filter((need) => need.need_date === dateKey)
        .reduce((sum, need) => sum + (need.needed_count ?? 0), 0);
      const assignedForDate = assignments
        .filter((assignment) => assignment.assigned_date === dateKey)
        .reduce((sum) => sum + 1, 0);

      return {
        date: dateKey,
        label: toShortDateLabel(dateKey),
        behov: neededForDate,
        planerat: assignedForDate,
      };
    });

    const totalAvailableCapacity = employees.filter((employee) => employee.is_active).length;
    const coverageGap = Math.max(0, neededToday - assignedToday);

    const statCards: SummaryStat[] = [
      {
        label: "Medarbetare",
        value: employees.length,
        description: `${activeEmployees} aktiva`,
        accentClass: "text-primary",
        icon: Users,
      },
      {
        label: "Behov idag",
        value: neededToday,
        description: "Fördelningar att matcha",
        accentClass: "text-accent",
        icon: Activity,
      },
      {
        label: "Täckningsgrad",
        value: utilization,
        description: `${coverageGap} tjänster kvar att fylla`,
        accentClass: "text-success",
        icon: TrendingUp,
      },
      {
        label: "Aktiva stationer",
        value: activeStations,
        description: `${totalAvailableCapacity} tillgängliga personer`,
        accentClass: "text-primary",
        icon: Database,
      },
    ];

    setSummary(statCards);
    setWeeklyTrend(weeklyTrendData);
    setStationNeedData(stationNeedPoints);
    setShiftMix(shiftMixData);
    setLoading(false);
  };

  const chartConfig = useMemo(
    () => ({
      behov: { label: "Behov", color: "#8b5cf6" },
      planerat: { label: "Planerat", color: "#22c55e" },
    }),
    [],
  );

  const shiftChartConfig = useMemo(
    () => ({
      count: { label: "Personer", color: "#4f46e5" },
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Driftsöversikt</h2>
        </div>
        <Badge variant="secondary" className="w-fit gap-2 border border-primary/20 bg-primary/5 text-primary">
          <Activity className="h-3.5 w-3.5" />
          Live data
        </Badge>
      </div>

      {loading ? (
        <Card className="border-border/50 shadow-lg">
          <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            Hämtar data från planeringen…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, description, accentClass, icon: Icon }) => (
              <Card key={label} className="border-border/50 shadow-lg transition-transform hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${accentClass}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${accentClass}`}>
                    {value}
                    {label === "Täckningsgrad" ? "%" : ""}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Behov vs planering</CardTitle>
                    <CardDescription>Senaste 7 dagarna</CardDescription>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart data={weeklyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="behovFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="planeratFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="behov" stroke="#8b5cf6" fill="url(#behovFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="planerat" stroke="#22c55e" fill="url(#planeratFill)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Skiftfördelning</CardTitle>
                    <CardDescription>Antal medarbetare per skift</CardDescription>
                  </div>
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={shiftChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <Pie data={shiftMix} dataKey="count" nameKey="shift" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {shiftMix.map((entry, index) => (
                        <Cell key={entry.shift} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="shift" />} />
                  </PieChart>
                </ChartContainer>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {shiftMix.map((entry, index) => (
                    <div key={entry.shift} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span>{entry.shift}</span>
                      </div>
                      <span className="font-semibold">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Stationsbehov idag</CardTitle>
                    <CardDescription>Högsta behov jämfört med planering</CardDescription>
                  </div>
                  <CalendarRange className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <BarChart data={stationNeedData} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="station" tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="behov" radius={[0, 8, 8, 0]} fill="#8b5cf6" />
                    <Bar dataKey="planerat" radius={[0, 8, 8, 0]} fill="#22c55e" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Snabba insikter</CardTitle>
                    <CardDescription>Prioritet att agera på</CardDescription>
                  </div>
                  <CircleDashed className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {stationNeedData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Det finns ännu inga tilldelningar eller behov att analysera.</p>
                ) : (
                  stationNeedData.map((station) => (
                    <div key={station.station} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium">{station.station}</span>
                        <Badge
                          variant={station.differens <= 0 ? "secondary" : "default"}
                          className={station.differens <= 0 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}
                        >
                          {station.differens <= 0 ? `${Math.abs(station.differens)} kvar` : `${station.differens} över`}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Behov</span>
                          <span className="font-medium text-foreground">{station.behov}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Planerat</span>
                          <span className="font-medium text-foreground">{station.planerat}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DataDashboard;
