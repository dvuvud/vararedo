import { Output, streamText } from "ai";
import { getCachedPlan, normalizeProfile, profileHash, setCachedPlan } from "@/lib/ai/cache";
import { MOCK_PLAN } from "@/lib/ai/mockPlan";
import { PLAN_MODEL_ID, hasApiKey, modelSettings } from "@/lib/ai/model";
import { planSystemPrompt, planUserPrompt } from "@/lib/ai/prompts";
import {
  planRequestSchema,
  planSchema,
  type ComputedFacts,
  type Plan,
  type PlanResponse,
  type PlanStreamEvent,
} from "@/lib/ai/schemas";
import { computeFacts } from "@/lib/calc";
import { CONTACTS } from "@/lib/data/contacts";

export const maxDuration = 60;

const FRIENDLY_ERROR =
  "Vi kunde inte skapa planen just nu. Försök igen om en stund. Under tiden finns myndigheternas råd på krisinformation.se.";

// Modellen får aldrig sätta egna siffror. Vi tar bort ogiltiga referenser och tankstreck i efterhand.
function sanitize(plan: Plan, facts: ComputedFacts): Plan {
  const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ", ");
  return {
    ...plan,
    summary: clean(plan.summary),
    riskProfile: plan.riskProfile.map((r) => ({ ...r, why: clean(r.why) })),
    missing: plan.missing.map((m) => ({
      ...m,
      item: clean(m.item),
      reason: clean(m.reason),
      quantityRef: m.quantityRef && m.quantityRef in facts.quantities ? m.quantityRef : undefined,
    })),
    actionPlan: plan.actionPlan.map((a) => ({ ...a, actions: a.actions.map(clean) })),
    shelterAdvice: plan.shelterAdvice ? clean(plan.shelterAdvice) : undefined,
  };
}

export async function POST(req: Request) {
  const parsed = planRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ogiltig profil", issues: parsed.error.issues }, { status: 400 });
  }
  const profile = normalizeProfile(parsed.data.profile);
  const wantStream = parsed.data.stream;
  const facts = computeFacts(profile);
  const key = profileHash(profile);

  // Utveckling utan API-nyckel: hårdkodad plan så att frontend kan jobba.
  const useMock = !hasApiKey() && process.env.NODE_ENV !== "production";
  const cached = getCachedPlan(key);

  if (!wantStream) {
    if (cached || useMock) {
      const body: PlanResponse = { plan: cached ?? MOCK_PLAN, facts, contacts: CONTACTS };
      return Response.json(body);
    }
    try {
      const plan = await generatePlan(profile, facts, key);
      return Response.json({ plan, facts, contacts: CONTACTS } satisfies PlanResponse);
    } catch (err) {
      console.error("[api/plan]", err);
      return Response.json({ error: FRIENDLY_ERROR }, { status: 502 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: PlanStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        send({ type: "facts", facts, contacts: CONTACTS, cached: Boolean(cached) });
        if (cached || useMock) {
          send({ type: "done", plan: cached ?? MOCK_PLAN });
        } else {
          const plan = await generatePlan(profile, facts, key, (partial) => send({ type: "partial", plan: partial }));
          send({ type: "done", plan });
        }
      } catch (err) {
        console.error("[api/plan]", err);
        send({ type: "error", message: FRIENDLY_ERROR });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

async function generatePlan(
  profile: ReturnType<typeof normalizeProfile>,
  facts: ComputedFacts,
  cacheKey: string,
  onPartial?: (p: Extract<PlanStreamEvent, { type: "partial" }>["plan"]) => void,
): Promise<Plan> {
  const result = streamText({
    ...modelSettings(PLAN_MODEL_ID),
    output: Output.object({ schema: planSchema }),
    system: planSystemPrompt(profile.lang),
    prompt: planUserPrompt(profile, facts),
    maxOutputTokens: 6000,
    maxRetries: 1,
  });
  for await (const partial of result.partialOutputStream) {
    onPartial?.(partial);
  }
  const plan = sanitize(planSchema.parse(await result.output), facts);
  setCachedPlan(cacheKey, plan);
  return plan;
}
