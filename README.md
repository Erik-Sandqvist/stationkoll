# Station-Koll

Webbapp för arbetsplatsplanering i lager: håll koll på medarbetare, deras
stationskompetenser och fördela dem rättvist till arbetsstationer varje dag.

## Vad appen gör

Appen har tre flikar:

- **Dashboard** – nyckeltal för dagen: antal medarbetare (totalt/aktiva), antal
  tilldelningar, antal stationer med behov och om dagen är planerad eller inte.
- **Medarbetare** – lägg till, aktivera/inaktivera och radera personal. Varje
  person har ett skift (Skift 1, Skift 2, Natt, Bemanningsföretag) och en
  uppsättning stationer hen är upplärd på. Här syns även hur många pass personen
  kört per station.
- **Dagsplanering** – välj datum och skift, ange behov per station, välj vilka
  som jobbar, låt systemet fördela automatiskt och justera sedan med
  drag-and-drop.

### Fördelningslogiken

Fördelningen körs i två pass och tar hänsyn till tre saker: kompetens, rotation
och historik.

1. **Första passet** placerar bara personer som har kompetens för stationen och
   som *inte* stod på samma station förra gången. Stationer med minst antal
   möjliga kandidater fylls först, och bland kandidaterna prioriteras den som är
   upplärd på minst antal stationer (den minst flexibla placeras först, vilket
   maximerar totala antalet placeringar). Vid lika väljs den som varit på
   stationen minst antal gånger de senaste 6 månaderna.
2. **Andra passet** fyller kvarvarande behov med samma prioritering men utan
   rotationsregeln. Regeln "inte samma station två gånger i rad" bryts alltså
   bara när alternativet är en tom plats.

Logiken ligger i [`src/utils/distribution.ts`](src/utils/distribution.ts) och är
täckt av tester.

Stationer märkta `manual_only` (hos IKEA "FL") fördelas inte automatiskt utan
bemannas för hand.

## Anpassa för en ny anläggning

Inget av det anläggningsspecifika ligger i komponenterna:

| Vad | Var |
| --- | --- |
| Stationer, layout, antal platser, understationer | Tabellen `stations` i databasen |
| Organisationsnamn, logga, färger | [`src/config/branding.ts`](src/config/branding.ts) |
| Skiftnamn | [`src/config/shifts.ts`](src/config/shifts.ts) |

En station har `layout_type` (`list` eller `grid`), `slots` (antal numrerade
platser vid grid), `parent_station_id` (visas inuti en annan stations kort) och
`manual_only`. Det som förut var hårdkodade specialfall per stationsnamn styrs
alltså av data.

## Teknik

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres) som backend
- Jest + Testing Library för tester

## Kom igång

```bash
npm install
```

Kopiera `.env.example` till `.env` och fyll i uppgifterna från ditt
Supabase-projekt:

```bash
cp .env.example .env
```

Starta utvecklingsservern (kör på port 8080):

```bash
npm run dev
```

## Kommandon

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Startar utvecklingsservern |
| `npm run build` | Bygger för produktion |
| `npm run preview` | Förhandsgranskar produktionsbygget |
| `npm run lint` | Kör ESLint |
| `npm test` | Kör testerna |
| `npm run test:watch` | Kör testerna i watch-läge |

## Databas

Schemat ligger i `supabase/migrations/`:

| Tabell | Innehåll |
| --- | --- |
| `stations` | Anläggningens stationer, layout och antal platser |
| `employees` | Namn, aktiv-status och skift |
| `employee_stations` | Vilka stationer varje medarbetare är upplärd på |
| `station_needs` | Hur många som behövs per station, datum och skift |
| `daily_assignments` | Faktiska placeringar per datum och skift |
| `work_history` | Historik per pass, används för statistik och rotation |

Migrationerna körs mot Supabase-projektet med Supabase CLI:

```bash
supabase db push
```

### Demodata

För att visa upp appen utan riktiga personuppgifter finns ett seed-skript som
skapar en fiktiv fordonsfabrik med 44 påhittade medarbetare och sex månaders
historik:

```bash
psql "$DATABASE_URL" -f supabase/seed/demo_fordonsfabrik.sql
```

Skriptet tömmer alla tabeller först — kör det bara mot ett separat demoprojekt.

## Projektstruktur

```
src/
  components/
    Dashboard.tsx           Översiktsvyn
    EmployeeManagement.tsx  Hantering av medarbetare och kompetenser
    DailyPlanning.tsx       Dagsplanering och fördelning
    PlanningHeader.tsx      Val av datum och skift
    StationNeedsCard.tsx    Behov per station
    StationCard.tsx         Stationskort med drag-and-drop
    EmployeeDetailsDialog.tsx  Kompetenser och statistik per medarbetare
    ui/                     shadcn/ui-komponenter
  config/
    branding.ts             Kundprofil: namn, logga, färger
    shifts.ts               Skiftindelning
  hooks/
    useStations.ts          Hämtar stationerna från databasen
  utils/
    distribution.ts         Fördelningsalgoritmen (testad)
    stationRotation.ts      Rotationsregler (senaste station per person)
    date.ts                 Datumnycklar i lokal tid
  integrations/supabase/    Supabase-klient och genererade typer
  pages/                    Sidor och routing
supabase/
  migrations/               Databasschema
  seed/                     Demodata
```

## Support

Applikationen är under utveckling och kan innehålla buggar. Vid frågor och
support, kontakta Erik Sandqvist – <esandqvist04@gmail.com>.
