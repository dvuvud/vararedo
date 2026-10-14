import { generateText, Output } from "ai";
import { FOLLOWUP_MODEL_ID, hasApiKey, modelSettings } from "@/lib/ai/model";
import { askedInForm, dropRepeated, dropSameTopic, narrowFormQuestions } from "@/lib/ai/askedTopics";
import { aiSafeProfile, followUpSystemPrompt } from "@/lib/ai/prompts";
import { followUpSchema, profileSchema, type FollowUp } from "@/lib/ai/schemas";
import { z } from "zod";

export const maxDuration = 30;

const requestSchema = z.object({
  profile: profileSchema,
  // Följdfrågor som redan ställts i en tidigare omgång (frågetext), så att de inte upprepas
  alreadyAsked: z.array(z.string().max(300)).max(30).default([]),
});
const EMPTY: FollowUp = { extractedNeeds: [], questions: [] };

// Följdfrågor är valfria: vid fel eller utan nyckel hoppar frontend över steget.
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ogiltig profil", issues: parsed.error.issues }, { status: 400 });
  }
  const { profile, alreadyAsked } = parsed.data;
  if (!profile.freeText?.trim() || !hasApiKey()) return Response.json(EMPTY);

  try {
    const { output } = await generateText({
      ...modelSettings(FOLLOWUP_MODEL_ID),
      output: Output.object({ schema: followUpSchema }),
      system: followUpSystemPrompt(profile.lang),
      prompt: JSON.stringify(
        {
          profile: aiSafeProfile(profile),
          alreadyAskedInForm: askedInForm(profile),
          alreadyAskedAsFollowUps: alreadyAsked,
        },
        null,
        1,
      ),
      maxOutputTokens: 800,
      maxRetries: 1,
    });
    const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ", ");
    const result = followUpSchema.parse(output);
    const asked = [...askedInForm(profile), ...alreadyAsked];
    const unique = dropRepeated(
      result.questions.map((q) => ({ ...q, question: clean(q.question) })),
      asked,
    );
    // Ämnesdomaren jämför bara mot (1) formulärets smala frågor och (2) tidigare följdfrågor. Mot formulärets breda
    // ämnen (särskilda behov m.m.) blev den för strikt och tog bort riktiga fördjupningar, t.ex. hur många dagar
    // medicinen räcker.
    const kept = await dropSameTopic(unique, [...narrowFormQuestions(profile), ...alreadyAsked]);
    // DEBUG_FOLLOWUPS=1 visar vad modellen föreslog och vad filtren tog bort (felsökning av "inga följdfrågor")
    if (process.env.DEBUG_FOLLOWUPS) {
      const names = (qs: { question: string }[]) => qs.map((q) => q.question);
      console.log("[followups]", JSON.stringify({
        modellen: names(result.questions),
        efterExaktDubblett: names(unique),
        efterÄmnesdomare: names(kept),
        behov: result.extractedNeeds,
      }, null, 1));
    }
    return Response.json({
      extractedNeeds: result.extractedNeeds.map(clean),
      questions: kept,
    } satisfies FollowUp);
  } catch (err) {
    console.error("[api/followups]", err);
    return Response.json(EMPTY);
  }
}
