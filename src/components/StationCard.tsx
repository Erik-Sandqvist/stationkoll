import { Card } from "@/components/ui/card";
import type { StationLayout } from "@/hooks/useStations";

interface StationCardProps {
  station: string;
  assigned: string[];
  needed: number;
  /** 'grid' = numrerade platser, 'list' = enkel lista. Kommer från stations-tabellen. */
  layout: StationLayout;
  /** Antal numrerade platser vid grid-layout */
  slots: number | null;
  /** Stationer som bemannas för hand visar ingen behovsräknare */
  isManual?: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (station: string) => void;
  onDragStart: (employeeId: string, station: string) => void;
  onDropOnPackPosition: (station: string, index: number) => void;
  getEmployeeShortName: (id: string) => string;
  subStations?: string[];
  assignments: { [key: string]: string[] }; // Hela assignments-objektet
  stationNeeds: { [key: string]: number }; // Hela stationNeeds-objektet
}

export const StationCard = ({
  station,
  assigned,
  needed,
  layout,
  slots,
  isManual = false,
  onDragOver,
  onDrop,
  onDragStart,
  onDropOnPackPosition,
  getEmployeeShortName,
  subStations = [],
  assignments,
  stationNeeds,
}: StationCardProps) => {
  const isGrid = layout === "grid" && slots !== null;
  const filledCount = isGrid ? assigned.filter(a => a).length : assigned.length;

  return (
    <Card
      className="p-4 bg-white backdrop-blur-md border border-black/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
      onDragOver={onDragOver}
      onDrop={() => onDrop(station)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-black">{station}</h3>
        {!isManual && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            filledCount >= needed
              ? 'bg-black/60 text-white'
              : 'bg-black/60 text-red-300'
          }`}>
            {filledCount}/{needed}
          </span>
        )}
      </div>

      {/* Layouten styrs av stationens layout_type, inte av dess namn */}
      {isGrid ? (
        <GridStationContent
          assigned={assigned}
          station={station}
          slots={slots}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDropOnPackPosition={onDropOnPackPosition}
          getEmployeeShortName={getEmployeeShortName}
        />
      ) : (
        <RegularStationContent
          assigned={assigned}
          station={station}
          onDragStart={onDragStart}
          getEmployeeShortName={getEmployeeShortName}
        />
      )}

      {/* Sub stations */}
      {subStations.length > 0 && (
        <div className="mt-4 space-y-2">
          {subStations.map((subStation) => (
            <SubStationSection
              key={subStation}
              subStation={subStation}
              assigned={assignments[subStation] || []}
              needed={stationNeeds[subStation] || 0}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              getEmployeeShortName={getEmployeeShortName}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

// Stationer med numrerade platser. Antalet platser kommer från stations-tabellen,
// så samma komponent renderar både en 12-platsers Pack och en 8-platsers autolinje.
interface GridContentProps {
  assigned: string[];
  station: string;
  slots: number;
  onDragStart: (employeeId: string, station: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropOnPackPosition: (station: string, index: number) => void;
  getEmployeeShortName: (id: string) => string;
}

const GridStationContent = ({
  assigned,
  station,
  slots,
  onDragStart,
  onDragOver,
  onDropOnPackPosition,
  getEmployeeShortName
}: GridContentProps) => (
  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
    {Array.from({ length: slots }, (_, idx) => (
      <div
        key={idx}
        draggable={!!assigned[idx]}
        onDragStart={() => assigned[idx] && onDragStart(assigned[idx], station)}
        onDragOver={onDragOver}
        onDrop={(e) => {
          e.stopPropagation();
          onDropOnPackPosition(station, idx);
        }}
        className={`text-sm text-black p-2 rounded-lg ${
          assigned[idx]
            ? 'bg-white cursor-move hover:bg-primary/25 backdrop-blur-sm'
            : 'backdrop-blur-sm'
        } transition-all duration-200`}
      >
        {idx + 1}. {assigned[idx] ? getEmployeeShortName(assigned[idx]) : '–'}
      </div>
    ))}
  </div>
);

interface RegularContentProps {
  assigned: string[];
  station: string;
  onDragStart: (employeeId: string, station: string) => void;
  getEmployeeShortName: (id: string) => string;
}

const RegularStationContent = ({ 
  assigned, 
  station, 
  onDragStart, 
  getEmployeeShortName 
}: RegularContentProps) => (
  <div className="space-y-2 max-h-72 overflow-y-auto">
    {assigned.map((empId, idx) => (
      <div
        key={idx}
        draggable
        onDragStart={() => onDragStart(empId, station)}
        className="text-sm text-black p-2 rounded-lg bg-white cursor-move hover:bg-primary/25 backdrop-blur-sm transition-all duration-200"
      >
        {getEmployeeShortName(empId)}
      </div>
    ))}
  </div>
);

interface SubStationProps {
  subStation: string;
  assigned: string[];
  needed: number;
  onDragStart: (employeeId: string, station: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (station: string) => void;
  getEmployeeShortName: (id: string) => string;
}

const SubStationSection = ({
  subStation,
  assigned,
  needed,
  onDragStart,
  onDragOver,
  onDrop,
  getEmployeeShortName,
}: SubStationProps) => {
  const filledCount = assigned.length;

  return (
    <div
      className="p-2 bg-white rounded-lg border-top border-black shadow hover:shadow-md transition-all duration-200"
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.stopPropagation(); 
        onDrop(subStation);
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-black">{subStation}</h4>
        <span className={`text-xs px-2.5 py-1 rounded-full ${          
            filledCount >= needed
              ? 'bg-black/60 text-white'
              : 'bg-black/60 text-red-300'
        }`}>
          {filledCount}/{needed}
        </span>
      </div>
      <div className="space-y-1">
        {assigned.map((empId, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => onDragStart(empId, subStation)}
            className="text-sm text-black p-2 rounded bg-white cursor-move hover:bg-primary/10 transition-all duration-200"
          >
            {getEmployeeShortName(empId)}
          </div>
        ))}
      </div>
    </div>
  );
};