# Station-Koll — underlag inför kundmöte

Internt arbetsmaterial. Inte att skicka till kunden som det är — det här är
argumenten, invändningarna och det du behöver ha svar på innan du går in i rummet.

---

## 1. Vinkeln

**Led med ergonomi och arbetsskadeprevention. Inte med effektivitet.**

Arbetsrotation mellan stationer är en etablerad åtgärd för att minska
belastningsbesvär, och Arbetsmiljöverkets föreskrifter om belastningsergonomi
ålägger arbetsgivaren att bedöma och åtgärda belastningsrisker. De flesta
tillverkande företag *säger* att de roterar. Få kan visa att det faktiskt sker,
eller att det sker rättvist.

Det är där appen sitter: den är ett verktyg som **dokumenterar** rotationen.

Varför den vinkeln fungerar:

- Den talar till arbetsmiljöansvariga, inte bara till produktionsledningen.
- Den ger facket ett skäl att vara för, inte emot. Facklig acceptans är ofta det
  som avgör om ett bemanningsverktyg får införas — ett system som fördelar
  människor kan annars läsas som övervakning.
- Den gör verktyget till en del av det systematiska arbetsmiljöarbetet snarare
  än ännu ett IT-system att förvalta.

Effektivitetsargumentet — "produktionsledaren sparar en halvtimme varje morgon"
— är sant, men köper ingen ett nytt system för. Ta det som andra argument, inte
första.

---

## 2. De tre värdena

### Dokumenterad rättvis rotation

Systemet visar, per person, var hen har stått de senaste sex månaderna. När
någon säger "jag får alltid de tunga stationerna" finns det siffror i stället
för upplevelser — och om personen har rätt syns det, vilket är hela poängen.

Fördelningen tar automatiskt hänsyn till tre regler: kompetens är ett hårt krav,
ingen ska stå på samma station två dagar i rad, och bland likvärdiga kandidater
går den som varit där minst. Regeln om två dagar i rad bryts bara när
alternativet är en obemannad station.

### Kompetensrisken blir synlig

Kompetensmatrisen svarar på frågan "hur många kan faktiskt köra station X?" —
och gör det obekvämt tydligt när svaret är två. Det är en sårbarhet varje
produktionschef känner igen men få har på papper.

Samma data driver fördelningen: den som är upplärd på minst antal stationer
placeras först, eftersom hen är svårast att placera. Det låter kontraintuitivt
men maximerar hur många som får en plats totalt.

### Bemanningen tar minuter i stället för en halvtimme

Och blir samma process oavsett vem som är i tjänst. Ny produktionsledare eller
vikarie kan göra fördelningen dag ett.

---

## 3. Var du ska vara ärlig om gränserna

Säg det här innan de frågar. Det bygger mer trovärdighet än det kostar.

- Det är **inte** linjebalansering eller takttidsberäkning. Det ersätter inte
  deras MES.
- Det är **inte** tidrapportering, schemaläggning av arbetstid eller
  lönegrundande.
- Nischen är den **dagliga bemanningen** — det som idag görs på whiteboard eller
  i Excel av en produktionsledare klockan sex på morgonen.

Att tydligt avgränsa vad produkten *inte* gör är också det som gör den möjlig
att köpa: den konkurrerar då inte med deras befintliga systemlandskap.

---

## 4. Frågorna du kommer få

| Fråga | Var du står idag |
| --- | --- |
| Var lagras data? | Supabase (Postgres). **Kontrollera vilken region ditt projekt ligger i innan mötet** — EU krävs i praktiken. |
| Vem kommer åt uppgifterna? | Idag: alla med länken. Det finns ingen inloggning. Var rak: det är nästa steg och en förutsättning för pilot. |
| Är det GDPR-förenligt? | Inte färdigt. Namn plus var någon arbetat varje dag är personuppgifter. Krävs före skarp drift: rättslig grund, gallringsrutin, personuppgiftsbiträdesavtal, och möjlighet att lämna ut och radera. |
| Integration mot SAP/HR? | Finns inte. Personal läggs in manuellt. Rimligt för pilot, blockerare för drift i skala. |
| Vad händer om du blir sjuk? | Ha ett svar om källkod, dokumentation och överlämning. Ett enmansberoende är en reell invändning från en stor koncern. |
| Vad kostar det, och vad ingår i support? | Behöver du ha bestämt innan mötet. Ett svävande svar här läser de som att du inte är redo. |
| Kan vi testa utan att lägga in våra riktiga anställda? | Ja — kör demodatan (`supabase/seed/demo_fordonsfabrik.sql`). |

---

## 5. Inför demon — praktiskt

**Kör aldrig demon mot din nuvarande databas.** Den innehåller riktiga
medarbetares namn och sex månaders arbetshistorik. Att visa det för ett annat
företag är ett verkligt integritetsproblem, oavsett hur bra appen ser ut.

Checklista:

1. Separat Supabase-projekt för demo.
2. Kör migrationerna, kör sedan `supabase/seed/demo_fordonsfabrik.sql`.
   Det ger en fiktiv fordonsfabrik med 44 påhittade medarbetare och sex
   månaders historik, så att statistik och varningar har något att visa.
3. Sätt kundens profil i `src/config/branding.ts` (namn, logga, färger).
4. Stationerna ligger i databasens `stations`-tabell — anpassa namnen till
   deras verklighet. Att de känner igen sina egna stationsnamn på skärmen är
   det som gör skillnaden mellan "intressant" och "det där är ju vårt".

### Vad du ska visa, i den här ordningen

1. **Kompetensmatrisen först.** Öppna en medarbetare, visa stationerna hen är
   upplärd på och statistiken. Det etablerar att systemet vet något de inte har
   samlat idag.
2. **Fördela.** Sätt behov, välj folk, tryck fördela. Poängen är inte att det
   går fort — det är att förklara *varför* den valde som den valde.
3. **Dra någon till fel station.** Varningen om att personen redan stått där
   ofta är det ögonblick där ergonomiargumentet blir konkret.
4. **Byt datum framåt.** Visar att det går att planera en vecka i förväg, inte
   bara improvisera på morgonen.
5. **Byt skift.** Visar att systemet förstår tvåskift och treskift.

### Vad du inte ska göra

Lova inga integrationer, inga tidsplaner och inget om säkerhet som inte finns
byggt. En stor kund kommer ihåg vad du sa på första mötet.

---

## 6. Om de blir intresserade — vad som krävs för pilot

Ha den här listan redo, för frågan kommer:

1. **Inloggning och behörigheter.** Idag finns ingen. Det är den enskilt
   största blockeraren och bör vara ditt nästa arbete oavsett kund.
2. **Riktiga RLS-policyer.** Alla tabeller har idag `USING (true)`, vilket
   innebär att API-nyckeln ger full läs- och skrivåtkomst till all persondata.
3. **Datahantering enligt GDPR.** Gallring, utlämning, radering,
   personuppgiftsbiträdesavtal, EU-region.
4. **Spårbarhet.** Vem ändrade vad och när. Behövs vid en facklig diskussion om
   en enskild fördelning.
5. **Flera anläggningar.** Datamodellen antar idag en enda anläggning. En
   koncern med flera fabriker behöver att data hålls isär.

Punkt 1–3 är inte "nice to have" för en industrikoncern. De är villkor.
