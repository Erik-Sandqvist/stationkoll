-- Stationerna låg tidigare som hårdkodade konstanter i två komponenter (som
-- dessutom skilde sig åt). Det gjorde appen omöjlig att använda hos en annan
-- kund utan kodändring. Här flyttas de till databasen tillsammans med de
-- egenskaper som förut var hårdkodade specialfall i renderingen.

CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  -- Ordning i gränssnittet
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- 'list' = enkel lista, 'grid' = numrerade platser (kräver slots)
  layout_type TEXT NOT NULL DEFAULT 'list' CHECK (layout_type IN ('list', 'grid')),
  -- Antal numrerade platser, endast för layout_type = 'grid'
  slots INTEGER CHECK (slots IS NULL OR slots > 0),
  -- Understation visas inuti förälderns kort istället för som eget kort
  parent_station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  -- Fördelas inte automatiskt utan väljs för hand (t.ex. arbetsledare)
  manual_only BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT grid_requires_slots CHECK (layout_type <> 'grid' OR slots IS NOT NULL)
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to stations" ON public.stations;
CREATE POLICY "Allow all access to stations"
ON public.stations
FOR ALL
USING (true);

CREATE INDEX IF NOT EXISTS idx_stations_sort_order ON public.stations(sort_order);

-- Seed med de stationer som tidigare var hårdkodade, så att befintliga
-- installationer fungerar oförändrat efter migrationen.
INSERT INTO public.stations (name, sort_order, layout_type, slots, manual_only) VALUES
  ('Plock',      10, 'list', NULL,  false),
  ('Auto Plock', 20, 'grid',    8,  false),
  ('Pack',       30, 'grid',   12,  false),
  ('Auto Pack',  40, 'grid',    8,  false),
  ('KM',         50, 'list', NULL,  false),
  ('Decating',   60, 'list', NULL,  false),
  ('Rework',     70, 'list', NULL,  false),
  ('In/Ut',      80, 'list', NULL,  false),
  ('Rep',        90, 'list', NULL,  false),
  ('FL',        100, 'list', NULL,  true)
ON CONFLICT (name) DO NOTHING;

-- Rework visades tidigare inuti Decating-kortet via en hårdkodad mappning
UPDATE public.stations
SET parent_station_id = (SELECT id FROM public.stations WHERE name = 'Decating')
WHERE name = 'Rework' AND parent_station_id IS NULL;
