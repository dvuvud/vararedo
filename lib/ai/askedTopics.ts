import { generateText, Output } from "ai";
import { z } from "zod";
import sv from "@/messages/sv.json";
import { FOLLOWUP_MODEL_ID, modelSettings } from "./model";
import type { Profile } from "./schemas";
import { visibleRules } from "@/lib/form/rules";

/**
 * Allt som formuläret redan har frågat om, som text till modellen. Följdfrågorna ska bara handla om
 * sådant som formuläret INTE fångar. Fasta frågor listas här, och regelfrågor tas från samma ordlista
 * som användaren ser (lib/form/rules.ts + messages/sv.json), så listorna håller sig i fas.
 */
const FIXED_TOPICS = [
  "Boendeform (lägenhet, villa eller radhus, gård, annat), våning och om det finns hiss",
  "Område (storstad, mindre ort, landsbygd) och adress eller position",
  "Antal vuxna, antal personer över 70 år",
  "Om det finns barn och deras åldrar",
  "Husdjur och vilken sort (hund, katt, annat)",
  "Särskilda behov: medicin som kräver kyla, hjälpmedel som kräver ström, rörelsenedsättning, specialkost",
  "Uppvärmning (fjärrvärme, el, ved, annat)",
  "Om hushållet har bil",
  "Om det finns kontanter hemma",
  "Om det finns batteri- eller vevradio",
  "Vilka kriser hushållet vill förbereda sig för",
  "Hur många dagar vatten och mat hushållet har hemma",
  "Om det finns alternativ värmekälla, ljus och ström (lampa, powerbank)",
  "Om hushållet har en plan (mötesplats, vem ringer vem)",
  "Om hushållet känner till närmaste skyddsrum",
];

// Formulärets SMALA frågor: där en följdfråga om samma sak är en ren dubblett. Breda ämnen (särskilda behov,
// boende, barn) ligger medvetet inte här, eftersom formuläret bara frågar ja eller nej och fördjupningar är nya.
const NARROW_QUESTIONS = [
  "Hur många dagar vatten har hushållet hemma?",
  "Hur många dagar mat har hushållet hemma?",
  "Har hushållet en alternativ värmekälla?",
  "Har hushållet ljus och ström (lampa, powerbank) hemma?",
  "Har hushållet batteri- eller vevradio?",
  "Har hushållet kontanter hemma?",
  "Har hushållet bil?",
  "Vilken uppvärmning har hushållet?",
  "Har hushållet en plan med mötesplats och vem som ringer vem?",
  "Känner hushållet till närmaste skyddsrum?",
  "Hur många vuxna och barn bor hemma?",
  "Har hushållet husdjur?",
];

/** Smala formulärfrågor som en följdfråga inte får upprepa, inklusive regelfrågorna som visats. */
export function narrowFormQuestions(profile: Profile): string[] {
  const rules = sv.rules as Record<string, string>;
  const ruleTexts = visibleRules(profile, profile.ruleAnswers)
    .map((q) => rules[q.id])
    .filter((t): t is string => !!t);
  return [...NARROW_QUESTIONS, ...ruleTexts];
}

export function askedInForm(profile: Profile): string[] {
  const rules = sv.rules as Record<string, string>;
  const ruleTexts = visibleRules(profile, profile.ruleAnswers)
    .map((q) => rules[q.id])
    .filter((t): t is string => !!t);
  return [...FIXED_TOPICS, ...ruleTexts];
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Tar bort frågor som är identiska med något som redan frågats (efter att skiljetecken och versaler ignorerats). */
export function dropRepeated<T extends { question: string }>(questions: T[], alreadyAsked: string[]): T[] {
  const seen = new Set(alreadyAsked.map(norm));
  return questions.filter((q) => {
    const n = norm(q.question);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

const sameTopicSchema = z.object({ duplicateIndexes: z.array(z.number().int()) });

/**
 * Modellen upprepar ibland en formulärfråga eller tidigare följdfråga, trots instruktion. En snabb kontroll avgör
 * vilka nya frågor som är omformuleringar av `alreadyAsked`, och de tas bort.
 * Använd den bara mot smala formulärfrågor (`narrowFormQuestions`) och tidigare följdfrågor, inte mot breda ämnen:
 * där blev den för strikt och tog bort riktiga fördjupningar. Misslyckas kontrollen behålls frågorna
 * (hellre en upprepning än inga frågor).
 */
export async function dropSameTopic<T extends { question: string }>(
  questions: T[],
  alreadyAsked: string[],
): Promise<T[]> {
  if (questions.length === 0 || alreadyAsked.length === 0) return questions;
  try {
    const { output } = await generateText({
      ...modelSettings(FOLLOWUP_MODEL_ID),
      output: Output.object({ schema: sameTopicSchema }),
      system:
        "Du jämför nya frågor med sådant som redan har frågats. En NY fråga är en dubblett bara om den frågar om exakt samma sak som en tidigare fråga eller ett tidigare ämne, så att svaret inte skulle ge någon ny information (till exempel en omformulering). Formuläret frågar bara ja eller nej om breda ämnen. En fråga som går djupare in på en specifik detalj är INTE en dubblett: till exempel hur många dagar, hur mycket, hur man gör eller vem det gäller, även om huvudämnet (medicin, hjälpmedel, barn, husdjur) finns i listan. Returnera index (börjar på 0) för varje ny fråga som är en dubblett. Returnera en tom lista om alla nya frågor ger ny information. Vid tveksamhet är det INTE en dubblett: det är bättre att fråga en gång för mycket än att missa något.",
      prompt: JSON.stringify({
        nyaFrågor: questions.map((q, i) => ({ index: i, fråga: q.question })),
        redanFrågat: alreadyAsked,
      }),
      maxOutputTokens: 200,
      maxRetries: 1,
    });
    const drop = new Set(output.duplicateIndexes);
    return questions.filter((_, i) => !drop.has(i));
  } catch (err) {
    console.error("[followups] kunde inte kontrollera dubbletter", err);
    return questions;
  }
}
