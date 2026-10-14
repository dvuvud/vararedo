import { generateText, Output } from "ai";
import { FOLLOWUP_MODEL_ID, hasApiKey, modelSettings } from "@/lib/ai/model";
import { askedInForm, dropRepeated, dropSameTopic } from "@/lib/ai/askedTopics";
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
    return Response.json({
      extractedNeeds: result.extractedNeeds.map(clean),
      questions: await dropSameTopic(unique, asked),
    } satisfies FollowUp);
  } catch (err) {
    console.error("[api/followups]", err);
    return Response.json(EMPTY);
  }
}
