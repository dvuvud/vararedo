Läs CLAUDE.md och alla skills i .claude/skills/ innan du gör något.

Vi är två utvecklare på ett 3-4 timmars hackathon hos Esatto och bygger Beredd: en webbapp som gör
MCF:s generella krisberedskapsråd till en personlig plan för varje hushåll, på tio språk.

Börja med steg 1 i byggordningen:
1. Skapa Next.js-projektet (App Router, TypeScript, Tailwind, shadcn/ui) och installera
   ai, @ai-sdk/anthropic, zod, react-leaflet, leaflet, resend och @upstash/redis.
2. Skapa filstrukturen enligt CLAUDE.md.
3. Skriv lib/ai/schemas.ts färdigt (followUpSchema, planSchema, typer för profil, kategorier och kristyper).
   Det är kontraktet mellan våra två spår, så gör det komplett.
4. Skapa en /api/plan som returnerar en hårdkodad plan enligt schemat, så frontend kan börja direkt.
5. Skapa .env.example med alla variabler som behövs.
6. Ge mig exakta kommandon för att deploya till Vercel.

Regler:
- Följ principen "kod där den räcker, AI där den behövs".
- Stanna efter steg 1 och säg vad vi ska testa. Sedan delar vi upp spår A och B.
- Fråga inte om lov för små beslut, välj det enklaste som fungerar och skriv vad du valde.
- Inga em-tankstreck i UI-texter.
