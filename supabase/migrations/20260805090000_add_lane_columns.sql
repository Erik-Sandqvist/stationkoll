-- Kolumnen `lane` finns i den befintliga databasen (den syns i den genererade
-- typfilen src/integrations/supabase/types.ts) men skapades aldrig av någon
-- migration. Det gjorde att migrationerna inte kunde återskapa databasen i en ny
-- miljö. Den här migrationen tätar glappet och är idempotent, så den är en no-op
-- mot den databas som redan har kolumnen.
--
-- `lane` är platsnumret inom en station: stationer med numrerade platser (t.ex.
-- Pack 1-12) sparar vilken plats varje medarbetare stod på, så att layouten
-- överlever en omladdning. För stationer utan numrerade platser är den ordningen
-- i listan.

ALTER TABLE public.daily_assignments ADD COLUMN IF NOT EXISTS lane INTEGER;
ALTER TABLE public.work_history ADD COLUMN IF NOT EXISTS lane INTEGER;
