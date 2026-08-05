import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { sv } from "date-fns/locale";
import { format } from "date-fns";
import { fromDateKey, toDateKey, todayKey } from "@/utils/date";
import { SHIFTS, type Shift } from "@/config/shifts";

interface PlanningHeaderProps {
  /** Valt datum som YYYY-MM-DD */
  date: string;
  onDateChange: (dateKey: string) => void;
  /** Skiftet som planeras — behov och tilldelningar sparas mot detta */
  shift: Shift;
  onShiftChange: (shift: Shift) => void;
}

/**
 * Styr vad resten av sidan planerar: vilken dag och vilket skift. Allt som
 * laddas och sparas nedanför hör till den här kombinationen.
 */
export const PlanningHeader = ({
  date,
  onDateChange,
  shift,
  onShiftChange,
}: PlanningHeaderProps) => {
  const selected = fromDateKey(date);
  const isToday = date === todayKey();

  const shiftDays = (days: number) => {
    const next = fromDateKey(date);
    next.setDate(next.getDate() + days);
    onDateChange(toDateKey(next));
  };

  return (
    <Card className="shadow-lg border-border/50">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftDays(-1)}
            aria-label="Föregående dag"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-60 justify-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" />
                {format(selected, "EEEE d MMMM yyyy", { locale: sv })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(picked) => picked && onDateChange(toDateKey(picked))}
                weekStartsOn={1}
                locale={sv}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftDays(1)}
            aria-label="Nästa dag"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isToday && (
            <Button variant="ghost" onClick={() => onDateChange(todayKey())}>
              Idag
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <Select value={shift} onValueChange={(value) => onShiftChange(value as Shift)}>
            <SelectTrigger className="w-48 bg-sidebar-input font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFTS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
