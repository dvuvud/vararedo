# Beredd: personlig krisberedskapsplan

Hackathonprojekt hos Esatto (svenskt techbolag inom webb, e-handel och AI). Två utvecklare, 3-4 timmar.
Tävlingskrav: generativ AI ska vara central, och systemet ska göra världen till en bättre plats.

## Kärnidé (läs först, styr alla beslut)

Myndigheten för civilt försvar (MCF) ger samma råd till alla hushåll. Vi gör om de råden till en
personlig, konkret plan för varje hushåll, så att de som behöver beredskap mest faktiskt får den
(äldre, barnfamiljer, personer med funktionsnedsättning, personer som inte har svenska som förstaspråk).

Princip: **vanlig kod där den räcker, AI där människors verklighet inte ryms i ett formulär.**
- Kod (deterministiskt): mängder, beredskapspoäng, skyddsrumsavstånd, viktiga nummer, formulärregler.
- AI: tolka fritext, generera följdfrågor, prioritera och motivera råd, anpassa språk och ton.

Om en funktion inte gör planen mer personlig eller mer handlingsbar: bygg den inte.

## Stack

- Next.js (App Router) + TypeScript, deploy på Vercel
- Tailwind + shadcn/ui
- AI: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`) + Zod, nyckel i `ANTHROPIC_API_KEY`
  - `claude-haiku-5-5` för följdfrågor (snabbhet)
  - `claude-sonnet-5-5` för planen (kvalitet). Byt till Haiku om svarstiden blir för lång.
- Lagring: Upstash Redis via Vercel Marketplace (endast för e-post/token-flödet)
- E-post: Resend
- Karta: `react-leaflet` + OpenStreetMap-tiles
- Geokodning: Nominatim (OpenStreetMap), samt `navigator.geolocation` som snabbval
- PDF: utskriftsvänlig vy + `window.print()` (fungerar med alla språk inklusive höger-till-vänster)

Alla AI-anrop sker server-side. Nycklar committas aldrig.

## Kristyper

Längre strömavbrott, IT-/betalsystem och mobilnät nere, vattenavbrott, extremväder/naturkatastrof
(översvämning, storm, värmebölja, skogsbrand), höjd beredskap/krig. Användaren kan välja flera eller "alla".

## Språk

Tio språk (ungefär de vanligaste i Sverige, justera vid behov):
`sv` svenska, `en` engelska, `ar` arabiska, `fi` finska, `fa` persiska, `so` somaliska,
`bs` bosniska/kroatiska/serbiska, `pl` polska, `ku` kurdiska (sorani), `uk` ukrainska, `ch`kinesiska

- UI-texter: JSON-ordlistor i `messages/<lang>.json`. Svenska är källan, övriga AI-översätts i förväg
  och granskas snabbtm, inga em dashes.
- `ar`, `fa`, `ku` är höger-till-vänster: sätt `dir="rtl"` på `<html>`.
- AI-output genereras direkt på valt språk. Telefonnummer, adresser och siffror ändras aldrig.

## Användarflöde

1. Landningssida: allt ska vara en one page.
2. Formulär i steg med progress-indikator (se nedan).
3. Adaptiva följdfrågor från AI (max 3, hoppas över om inget behövs).
4. Resultatsida: dynamisk mall (se skill `resultatmall`).
5. Valfritt: spara med e-post, få länk och påminnelse en vecka senare.

## Formulär

### Grundfrågor (fasta, villkorslogik i `lib/form/rules.ts`)
- Boendeform (lägenhet/villa/gård/annat), våning, hiss ja/nej
- Område (storstad/mindre ort/landsbygd), adress eller "använd min position"
- Hushåll: antal vuxna, barn med åldrar, personer över 70, husdjur
- Särskilda behov som kryssrutor: medicin som kräver kyla, hjälpmedel som kräver ström,
  rörelsenedsättning, specialkost. Inga diagnoser i fritext.
- Uppvärmning: fjärrvärme/el/ved/annat
- Bil, kontanter hemma, batteri- eller vevradio (ja/nej)
- Vilka kriser man vill förbereda sig för

### Självskattning (driver beredskapspoängen, se skill `beredskapspoang`)
Snabbval per kategori: dagar vatten, dagar mat, alternativ värme, ljus/ström (lampa, powerbank),
radio, kontanter, hushållets plan (mötesplats, vem ringer vem), känner till närmaste skyddsrum.

### Villkorslogik i kod (inte AI)
Kända förgreningar löses med regler: barn under 3 år ger frågor om ersättning och blöjor,
landsbygd ger fråga om brunn, villa ger fråga om reservkraft, husdjur ger fråga om foder.

### Frontend design
Hämta inspiration från www.mcf.se. Dvs från myndigheten för civilt försvars egna hemsida.

### Adaptiva följdfrågor (AI)
- Indata: grundsvar + fritextfältet "Berätta om något i ditt hushåll som vi inte frågat om".
- Modellen tolkar kombinationer och ovanliga behov som reglerna inte fångar och ställer max 3 frågor.
- Endpoint: `POST /api/followups`, `generateObject`, schema i `lib/ai/schemas.ts`:

```ts
export const followUpSchema = z.object({
  extractedNeeds: z.array(z.string()).max(5),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(["yesno", "number", "choice", "text"]),
    options: z.array(z.string()).max(5).optional(),
  })).max(3),
});
```
- Frontenden renderar frågorna dynamiskt utifrån `type`. Tom fritext och inga oklarheter: hoppa över steget.
- Formulering styrs av skill `kris-tonalitet`.

## Plangenerering

Endpoint: `POST /api/plan`, `streamObject` så att planen skrivs fram på skärmen.

Ordning i routen:
1. Normalisera profilen och räkna fram allt deterministiskt i `lib/calc/`:
   mängder (t.ex. vatten 3 l per person och dygn i 7 dygn), beredskapspoäng, närmaste skyddsrum.
2. Skicka profil + uträknade fakta till modellen. Modellen får inte räkna om eller ändra siffror.
3. Modellen returnerar strukturerat innehåll enligt `planSchema`:

```ts
export const planSchema = z.object({
  summary: z.string(),                         // 2-3 meningar om största sårbarheter
  riskProfile: z.array(z.object({
    crisis: z.enum(CRISIS_TYPES),
    level: z.enum(["low", "medium", "high"]),
    why: z.string(),
  })),
  missing: z.array(z.object({                  // "Det här saknar ni"
    category: z.enum(CATEGORIES),
    item: z.string(),
    quantityRef: z.string().optional(),        // nyckel till uträknad mängd, aldrig en egen siffra
    priority: z.enum(["1", "2", "3"]),
    reason: z.string(),
  })).max(15),
  actionPlan: z.array(z.object({
    phase: z.enum(["now", "first_hour", "first_day", "first_week"]),
    actions: z.array(z.string()).max(6),
  })),
  shelterAdvice: z.string().optional(),
  extraSections: z.array(z.enum(["children", "elderly", "pets", "special_needs", "rural"])),
});
```

## Determinism ("samma input ska ge samma resultat")

- `temperature: 0`, ingen extended thinking.
- Strama scheman: enums, `.max()` på listor, fasta kategorier.
- All matematik i kod. Modellen refererar till uträknade värden via nycklar.
- Cache: hasha normaliserad profil (sorterade nycklar, inklusive språk) med SHA-256 och spara svaret.
  Samma profil ger identiskt svar. In-memory `Map` lokalt, Redis i produktion om tid finns.
- Kör de tre demo-profilerna innan presentationen så de ligger cachade.

## Viktiga nummer (statiska i kod, aldrig från AI)

`lib/data/contacts.ts`: 112 (nödnummer), 113 13 (information vid olyckor och kriser),
1177 (sjukvårdsrådgivning), 114 14 (polisen, icke akut), Giftinformationscentralen,
Sveriges Radio P4 för information vid kris, krisinformation.se, kommunens krisinformation.
Verifiera listan en gång innan demo. Modellen får aldrig hitta på telefonnummer eller organisationer.

## Skyddsrum

Se skill `skyddsrum-data`. Kort: MCF:s öppna data förbehandlas till kompakt JSON i förväg,
`GET /api/shelters?lat=&lon=` returnerar de tre närmaste med avstånd och antal platser.
Ingen AI i uträkningen. De närmaste skyddsrummen skickas sedan in i planprompten så att AI:n kan
ge personliga råd (t.ex. trappor vid rörelsenedsättning).

## E-post, token och notis veckan efter

- Valfritt steg på resultatsidan: "Spara min plan och påminn mig om en vecka".
- Tydligt samtycke (kryssruta), länk för att radera, TTL 30 dagar i Redis.
- Slumpad token (`crypto.randomUUID()`), spara `{ email, lang, plan, checklistState, createdAt, reminded }`.
- Mejl direkt via Resend med länk `/plan/[token]`, där användaren kan bocka av saker och se poängen öka.
- Vercel Cron en gång per dygn mot `/api/cron/reminders`: hitta planer äldre än 7 dagar med
  `reminded: false`, skicka påminnelse med det som fortfarande saknas, sätt `reminded: true`.
  Skydda routen med `CRON_SECRET`.
- Demo: visa mejlet live, och en knapp i dev-läge som triggar påminnelsen direkt.

## Inspiration

Material ligger i `docs/inspiration/` (Krishanteringsbladet, Kommunbladet). Läs dem innan du
bygger resultatsidan och tonen: ta struktur, rubriker och lugn saklig stil därifrån.
Fakta om hemberedskap hämtas från MCF:s råd (vatten, mat, värme, information, kommunikation).

## Skills

- `kris-tonalitet`: hur AI:n formulerar sig i frågor och resultat. Källa för systemprompterna.
- `resultatmall`: den dynamiska resultatsidan och PDF-vyn.
- `beredskapspoang`: deterministisk poängmodell och progress-cirkeln.
- `skyddsrum-data`: förbehandling av MCF-data, geokodning och närmaste-sökning.

Läs relevant skill innan du rör respektive del.

## Filstruktur

```
app/
  [lang]/page.tsx              landning
  [lang]/plan/new/page.tsx     formulär
  [lang]/plan/result/page.tsx  resultat
  plan/[token]/page.tsx        sparad plan
  api/followups/route.ts
  api/plan/route.ts
  api/shelters/route.ts
  api/save/route.ts
  api/cron/reminders/route.ts
lib/
  ai/schemas.ts  ai/prompts.ts  ai/cache.ts
  calc/quantities.ts  calc/score.ts
  form/rules.ts
  data/contacts.ts  data/shelters.ts
components/
  ScoreRing.tsx  result/sections/*  form/*
messages/<lang>.json
data/skyddsrum.min.json
docs/inspiration/
```

## Byggordning (varje steg ska vara deploybart)

Två spår parallellt efter steg 1. Kom överens om `lib/ai/schemas.ts` först.

| # | Tid | Spår A (backend/AI) | Spår B (frontend) |
|---|-----|---------------------|-------------------|
| 1 | 0:00-0:25 | Projekt, Vercel-deploy, env, scheman | samma |
| 2 | 0:25-1:15 | `/api/plan` med beräkningar, cache, temp 0 | Formulär i steg, i18n-grund |
| 3 | 1:15-1:50 | `/api/shelters` | Resultatmall + ScoreRing |
| 4 | 1:50-2:30 | `/api/followups` | Följdfrågor, karta, print-vy |
| 5 | 2:30-3:10 | Spara/token/Resend + cron | Sparad plan med avbockning, RTL |
| 6 | 3:10-     | Cacha demo-profiler, buggfix | Polish, laddningslägen, pitch |

Om tiden tar slut: stryk i omvänd ordning (5, sedan 4). Steg 1-3 är kärnan.

## Demo-profiler

1. Barnfamilj i lägenhet på våning 6, Göteborg, bebis 8 månader, ingen radio.
2. Ensamboende 78-åring på landsbygd, elberoende hjälpmedel, brunn, vedspis. Språk: finska.
3. Student i korridorsrum, Uppsala, inga kontanter, svarar på arabiska.

## Regler för koden

- TypeScript strict, inga `any` i scheman.
- Varje AI-anrop har felhantering och ett vänligt fallback-meddelande. Visa aldrig råa modellfel.
- Disclaimer i footern: komplement till, inte ersättning för, myndigheternas information.
- Skyddsrumsdata kan innehålla fel: visa "Kontrollera skyltning på plats. Data från MCF."
- Inga em-tankstreck i UI-texter eller AI-output.
