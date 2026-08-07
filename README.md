# Station-Koll

Webbapp för arbetsplatsplanering i lager: håll koll på medarbetare, deras
stationskompetenser och fördela dem rättvist till arbetsstationer varje dag.

## Vad appen gör

Appen har fyra flikar:

- **Dashboard** – nyckeltal för dagen: antal medarbetare (totalt/aktiva), antal
  tilldelningar, antal stationer med behov och om dagen är planerad eller inte.
- **Medarbetare** – lägg till, aktivera/inaktivera och radera personal. Varje
  person har ett skift (Skift 1, Skift 2, Natt, Bemanningsföretag), ett arbetslag
  och en uppsättning stationer hen är upplärd på. Här skapas även grupperna. Här
  syns också hur många pass personen kört per station.
- **Dagsplanering** – välj datum och skift, ange behov per station, välj vilka
  som jobbar, låt systemet fördela automatiskt och justera sedan med
  drag-and-drop. Dagens bemanning kan exporteras som en liggande PDF med
  färgkodade stationer.
- **Stationer** – lägg upp anläggningens stationer och välj om de ska ha
  numrerade platser och i så fall hur många. Stationer kan även stängas av.

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
| Stationer, layout, antal platser, understationer | Fliken **Stationer**, dvs. tabellen `stations` |
| Arbetslag | Fliken **Medarbetare**, dvs. tabellen `groups` |
| Organisationsnamn, logga, färger | [`src/config/branding.ts`](src/config/branding.ts) |
| Skiftnamn | [`src/config/shifts.ts`](src/config/shifts.ts) |

`branding.ts` innehåller de färdiga profilerna i `brandings` — i dag `volvo` och
`ikea`. Förvalet styrs av `DEFAULT_BRAND`.

Sätts `VITE_BRAND_SWITCHER=true` visas en profilväljare i navbaren, så att namn,
logga och färger kan bytas live under en demo. Valet sparas i localStorage. Vid en
skarp kundinstallation lämnas variabeln tom: då körs alltid förvalsprofilen, och
ett gammalt värde i webbläsaren kan inte följa med in.

Färgerna sätts som CSS-variabler på `:root` och `.dark`, så en profil kan ange
egna färger för både ljust och mörkt läge. Utelämnas de används standardtemat i
`index.css`.

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
| `groups` | Arbetslag som medarbetare kan delas in i |
| `employees` | Namn, aktiv-status, skift och grupp |
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
skapar en fiktiv fordonsfabrik med 44 påhittade medarbetare i fyra arbetslag och
sex månaders historik:

```bash
psql "$DATABASE_URL" -f supabase/seed/demo_fordonsfabrik.sql
```

Skriptet tömmer alla tabeller först — kör det bara mot ett demoprojekt. Det går
även att klistra in filen i SQL-editorn i Supabase-dashboarden om CLI:t inte är
installerat.

### Lösenordsspärr under demo

Sätts `VITE_DEMO_PASSWORD` i `.env` läggs en enkel lösenordsruta framför appen.
Lämnas den tom är spärren avstängd.

Spärren döljer **gränssnittet, inte datan**: Supabase-nyckeln ligger kvar i
klienten och RLS-policyerna är `USING (true)`, så API:et är fortfarande öppet för
den som letar. Riktigt skydd kräver Supabase Auth och omskrivna policyer.

## Projektstruktur

```
src/
  components/
    Dashboard.tsx           Översiktsvyn
    EmployeeManagement.tsx  Medarbetare, kompetenser och arbetslag
    StationManagement.tsx   Upplägg av stationer och platsantal
    DailyPlanning.tsx       Dagsplanering och fördelning
    DemoGate.tsx            Lösenordsspärr under demo
    BrandSwitcher.tsx       Byter kundprofil live (endast demoläge)
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
    useGroups.ts            Hämtar arbetslagen från databasen
    useBranding.tsx         Aktiv kundprofil
  utils/
    distribution.ts         Fördelningsalgoritmen (testad)
    stationRotation.ts      Rotationsregler (senaste station per person)
    planningPdf.ts          PDF-export av dagens bemanning
    stationColors.ts        Färgkodning per station
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
