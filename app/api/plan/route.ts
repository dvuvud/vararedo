import { CONTACTS } from "@/lib/data/contacts";
import { MOCK_FACTS, MOCK_PLAN } from "@/lib/ai/mockPlan";
import { planRequestSchema, planSchema, type PlanResponse } from "@/lib/ai/schemas";

// Steg 1: hårdkodad plan. Steg 2 byter ut mot beräkningar + cache + streamObject.
export async function POST(req: Request) {
  const parsed = planRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ogiltig profil", issues: parsed.error.issues }, { status: 400 });
  }
  const body: PlanResponse = {
    plan: planSchema.parse(MOCK_PLAN),
    facts: MOCK_FACTS,
    contacts: CONTACTS,
  };
  return Response.json(body);
}
