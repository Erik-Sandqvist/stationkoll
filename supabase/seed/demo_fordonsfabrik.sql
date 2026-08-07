-- Demodata: en fiktiv fordonsfabrik.
--
-- Kör detta i ett SEPARAT Supabase-projekt, aldrig mot produktionsdatabasen.
-- Skriptet tömmer alla tabeller innan det seedar.
--
-- Syftet är att kunna demonstrera appen utan att visa riktiga medarbetares namn
-- och arbetshistorik för utomstående. Alla personer nedan är påhittade.
--
-- Innehåller: 9 stationer, 44 medarbetare fördelade på tre skift och fyra
-- arbetslag, kompetenser per medarbetare och sex månaders arbetshistorik bakåt,
-- så att statistiken och rotationsvarningarna faktiskt har något att visa.

BEGIN;

-- 1. Rensa ------------------------------------------------------------------

TRUNCATE TABLE public.work_history,
               public.daily_assignments,
               public.station_needs,
               public.employee_stations,
               public.employees,
               public.groups,
               public.stations
  RESTART IDENTITY CASCADE;

-- 2. Stationer --------------------------------------------------------------

INSERT INTO public.stations (name, sort_order, layout_type, slots, manual_only) VALUES
  ('Kaross',           10, 'list', NULL, false),
  ('Måleri',           20, 'list', NULL, false),
  ('Dörrlinje',        30, 'grid',    8, false),
  ('Motorinbyggnad',   40, 'grid',   12, false),
  ('Chassi',           50, 'list', NULL, false),
  ('Slutmontering',    60, 'grid',   12, false),
  ('Kvalitetskontroll',70, 'list', NULL, false),
  ('Materialhantering',80, 'list', NULL, false),
  ('Skiftledare',      90, 'list', NULL, true);

-- Efterjustering visas inuti Kvalitetskontroll-kortet
INSERT INTO public.stations (name, sort_order, layout_type, slots, manual_only, parent_station_id)
VALUES (
  'Efterjustering', 75, 'list', NULL, false,
  (SELECT id FROM public.stations WHERE name = 'Kvalitetskontroll')
);

-- 3. Medarbetare ------------------------------------------------------------

INSERT INTO public.employees (name, shift, is_active) VALUES
  -- Skift 1
  ('Anna Lindqvist',      'Skift 1', true),
  ('Bo Hedström',         'Skift 1', true),
  ('Cecilia Nordin',      'Skift 1', true),
  ('David Öberg',         'Skift 1', true),
  ('Elin Karlsson',       'Skift 1', true),
  ('Fredrik Almqvist',    'Skift 1', true),
  ('Gabriella Sund',      'Skift 1', true),
  ('Hassan Yilmaz',       'Skift 1', true),
  ('Ingrid Palm',         'Skift 1', true),
  ('Johan Wikström',      'Skift 1', true),
  ('Karin Blom',          'Skift 1', true),
  ('Lars Nyberg',         'Skift 1', true),
  ('Maja Forsberg',       'Skift 1', true),
  ('Nikolai Petrov',      'Skift 1', true),
  ('Olivia Ahlgren',      'Skift 1', true),
  ('Patrik Sjöberg',      'Skift 1', true),
  -- Skift 2
  ('Rebecka Holm',        'Skift 2', true),
  ('Samir Haddad',        'Skift 2', true),
  ('Therese Lundin',      'Skift 2', true),
  ('Ulf Bergqvist',       'Skift 2', true),
  ('Vera Ekström',        'Skift 2', true),
  ('William Dahl',        'Skift 2', true),
  ('Xenia Molnar',        'Skift 2', true),
  ('Yusuf Demir',         'Skift 2', true),
  ('Zara Nilsson',        'Skift 2', true),
  ('Adam Söderberg',      'Skift 2', true),
  ('Beatrice Lind',       'Skift 2', true),
  ('Carl Rydberg',        'Skift 2', true),
  ('Diana Kovacs',        'Skift 2', true),
  ('Emil Strand',         'Skift 2', true),
  ('Filippa Grönlund',    'Skift 2', true),
  ('Gustav Åkerlund',     'Skift 2', true),
  -- Natt
  ('Hanna Bergström',     'Natt', true),
  ('Isak Lundgren',       'Natt', true),
  ('Julia Marklund',      'Natt', true),
  ('Kasper Ivanov',       'Natt', true),
  ('Linnea Falk',         'Natt', true),
  ('Marcus Ek',           'Natt', true),
  ('Nadia Rahimi',        'Natt', true),
  ('Oskar Vikström',      'Natt', true),
  -- Bemanningsföretag
  ('Petra Sandell',       'Bemanningsföretag', true),
  ('Rasmus Hjelm',        'Bemanningsföretag', true),
  ('Sofia Norén',         'Bemanningsföretag', true),
  ('Tobias Winge',        'Bemanningsföretag', true);

-- 4. Grupper ----------------------------------------------------------------
--
-- Arbetslagen som medarbetarna delas in i. Fördelningen är deterministisk
-- utifrån namnet, så samma person hamnar i samma lag varje gång skriptet körs.

INSERT INTO public.groups (name) VALUES
  ('Lag Alfa'),
  ('Lag Beta'),
  ('Lag Gamma'),
  ('Lag Delta');

UPDATE public.employees e
SET group_id = g.id
FROM (
  SELECT id, row_number() OVER (ORDER BY name) - 1 AS idx
  FROM public.groups
) AS g
WHERE g.idx = ((hashtext(e.name) % 4) + 4) % 4;

-- 5. Kompetenser ------------------------------------------------------------
--
-- Fördelas pseudoslumpmässigt men deterministiskt utifrån namnet, så att
-- resultatet blir detsamma varje gång skriptet körs. Alla får minst en
-- kompetens; ungefär en tredjedel blir specialister med bara en eller två
-- stationer, vilket är det som gör fördelningsalgoritmen intressant att visa.

INSERT INTO public.employee_stations (employee_id, station)
SELECT e.id, s.name
FROM public.employees e
CROSS JOIN public.stations s
WHERE s.manual_only = false
  AND ((hashtext(e.name || s.name) % 100) + 100) % 100 <
      CASE
        -- Var tredje medarbetare är specialist
        WHEN ((hashtext(e.name) % 3) + 3) % 3 = 0 THEN 25
        ELSE 60
      END;

-- Säkerställ att ingen står helt utan kompetens
INSERT INTO public.employee_stations (employee_id, station)
SELECT e.id, 'Materialhantering'
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_stations es WHERE es.employee_id = e.id
)
ON CONFLICT (employee_id, station) DO NOTHING;

-- Skiftledarkompetens till ett fåtal
INSERT INTO public.employee_stations (employee_id, station)
SELECT e.id, 'Skiftledare'
FROM public.employees e
WHERE e.name IN ('Anna Lindqvist', 'Rebecka Holm', 'Hanna Bergström')
ON CONFLICT (employee_id, station) DO NOTHING;

-- 6. Arbetshistorik ---------------------------------------------------------
--
-- Sex månader bakåt, vardagar. Varje medarbetare placeras på en av sina egna
-- stationer, roterande över tid så att statistiken blir ojämn nog att
-- rotationsvarningarna slår till på några personer.

INSERT INTO public.work_history (employee_id, station, work_date, shift)
SELECT
  e.id,
  comp.station,
  d.work_date,
  COALESCE(e.shift, 'Skift 1')
FROM public.employees e
CROSS JOIN LATERAL generate_series(
  CURRENT_DATE - INTERVAL '6 months',
  CURRENT_DATE - INTERVAL '1 day',
  INTERVAL '1 day'
) AS d(work_date)
CROSS JOIN LATERAL (
  -- Välj en av medarbetarens stationer, varierande med datumet
  SELECT es.station
  FROM public.employee_stations es
  JOIN public.stations s ON s.name = es.station
  WHERE es.employee_id = e.id AND s.manual_only = false
  ORDER BY ((hashtext(e.name || d.work_date::text || es.station) % 1000) + 1000) % 1000
  LIMIT 1
) AS comp
-- Bara vardagar, och inte varje dag för alla (frånvaro/semester)
WHERE EXTRACT(ISODOW FROM d.work_date) <= 5
  AND ((hashtext(e.name || d.work_date::text) % 10) + 10) % 10 < 8;

-- 7. Behov för idag ---------------------------------------------------------
--
-- Så att appen visar något direkt när den öppnas.

INSERT INTO public.station_needs (station, needed_count, need_date, shift)
SELECT s.name, v.needed, CURRENT_DATE, 'Skift 1'
FROM public.stations s
JOIN (VALUES
  ('Kaross', 2),
  ('Måleri', 2),
  ('Dörrlinje', 4),
  ('Motorinbyggnad', 5),
  ('Chassi', 2),
  ('Slutmontering', 6),
  ('Kvalitetskontroll', 2),
  ('Efterjustering', 1),
  ('Materialhantering', 3)
) AS v(station, needed) ON v.station = s.name;

COMMIT;

-- Kontroll
SELECT 'stationer' AS tabell, count(*) FROM public.stations
UNION ALL SELECT 'medarbetare', count(*) FROM public.employees
UNION ALL SELECT 'grupper', count(*) FROM public.groups
UNION ALL SELECT 'kompetenser', count(*) FROM public.employee_stations
UNION ALL SELECT 'historikrader', count(*) FROM public.work_history
UNION ALL SELECT 'behov idag', count(*) FROM public.station_needs;
