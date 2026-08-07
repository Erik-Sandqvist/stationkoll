-- Medarbetare hör ofta ihop i arbetslag som planeras tillsammans. Gruppen är en
-- egen tabell istället för en textkolumn på employees, så att ett lag kan byta
-- namn utan att varje medarbetare behöver uppdateras.

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to groups" ON public.groups;
CREATE POLICY "Allow all access to groups"
ON public.groups
FOR ALL
USING (true);

-- En medarbetare tillhör som mest en grupp. ON DELETE SET NULL gör att en
-- borttagen grupp bara lämnar medarbetarna utan grupp — ingen försvinner med
-- den.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_group_id ON public.employees(group_id);
