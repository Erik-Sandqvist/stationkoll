-- Skift fanns bara på medarbetaren, inte på planeringen. Det unika villkoret
-- UNIQUE(employee_id, assigned_date) innebar att en medarbetare kunde ha exakt
-- en tilldelning per dag, och station_needs kunde inte uttrycka olika behov för
-- olika skift. En anläggning som kör två- eller treskift kunde alltså inte
-- använda appen.
--
-- Här flyttas skiftet in i planeringen: behov, tilldelningar och historik hör
-- till ett visst skift en viss dag.

ALTER TABLE public.daily_assignments
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'Skift 1';
ALTER TABLE public.work_history
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'Skift 1';
ALTER TABLE public.station_needs
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'Skift 1';

-- Rensa dubbletter innan det unika villkoret kan skapas.
--
-- Det tidigare villkoret UNIQUE(employee_id, assigned_date) saknas i vissa
-- databaser trots att migration 1 skapar det, och där har samma medarbetare
-- kunnat sparas både på en produktionsstation och på den manuellt bemannade
-- stationen (FL) samma dag. Ingen kan stå på två stationer samtidigt, så en av
-- raderna är fel.
--
-- Vi behåller produktionsstationen och tar bort raden för den manuellt
-- bemannade stationen — det är den som appens egen sparning var tänkt att
-- utelämna. Är båda (eller ingen) manuella behålls den äldsta raden.
WITH rangordnade AS (
  SELECT
    a.id,
    row_number() OVER (
      PARTITION BY a.employee_id, a.assigned_date, a.shift
      ORDER BY
        COALESCE(
          (SELECT s.manual_only FROM public.stations s WHERE s.name = a.station),
          false
        ),
        a.created_at,
        a.id
    ) AS radnr
  FROM public.daily_assignments a
)
DELETE FROM public.daily_assignments
WHERE id IN (SELECT id FROM rangordnade WHERE radnr > 1);

-- Samma sak för behoven, som har motsvarande unika villkor
WITH rangordnade AS (
  SELECT
    n.id,
    row_number() OVER (
      PARTITION BY n.station, n.need_date, n.shift
      ORDER BY n.created_at, n.id
    ) AS radnr
  FROM public.station_needs n
)
DELETE FROM public.station_needs
WHERE id IN (SELECT id FROM rangordnade WHERE radnr > 1);

-- En medarbetare kan nu ha en tilldelning per skift och dag
ALTER TABLE public.daily_assignments
  DROP CONSTRAINT IF EXISTS daily_assignments_employee_id_assigned_date_key;
ALTER TABLE public.daily_assignments
  DROP CONSTRAINT IF EXISTS daily_assignments_employee_date_shift_key;
ALTER TABLE public.daily_assignments
  ADD CONSTRAINT daily_assignments_employee_date_shift_key
  UNIQUE (employee_id, assigned_date, shift);

-- Behovet anges per station, datum och skift
ALTER TABLE public.station_needs
  DROP CONSTRAINT IF EXISTS station_needs_station_need_date_key;
ALTER TABLE public.station_needs
  DROP CONSTRAINT IF EXISTS station_needs_station_date_shift_key;
ALTER TABLE public.station_needs
  ADD CONSTRAINT station_needs_station_date_shift_key
  UNIQUE (station, need_date, shift);

CREATE INDEX IF NOT EXISTS idx_daily_assignments_date_shift
  ON public.daily_assignments(assigned_date, shift);
CREATE INDEX IF NOT EXISTS idx_station_needs_date_shift
  ON public.station_needs(need_date, shift);
