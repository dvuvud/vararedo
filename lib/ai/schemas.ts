import { z } from "zod";

/**
 * Kontraktet mellan spår A (backend/AI) och spår B (frontend).
 * Ändra inte utan att säga till i den andra spåret.
 */

// ---------- Konstanter ----------

export const LANGS = ["sv", "en", "ar", "fi", "fa", "so", "bs", "pl", "ku", "uk"] as const;
export type Lang = (typeof LANGS)[number];
export const RTL_LANGS: readonly Lang[] = ["ar", "fa", "ku"];

export const CRISIS_TYPES = [
  "power_outage",
  "it_payment_mobile",
  "water_outage",
  "extreme_weather",
  "war_heightened",
] as const;
export type CrisisType = (typeof CRISIS_TYPES)[number];

// Fasta kategorier. Används av självskattning, poäng och "det här saknar ni".
export const CATEGORIES = [
  "water",
  "food",
  "heat",
  "light_power",
  "radio_info",
  "cash",
  "household_plan",
  "shelter",
  "medicine_health",
  "hygiene",
  "children",
  "pets",
  "communication",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PHASES = ["now", "first_hour", "first_day", "first_week"] as const;
export type Phase = (typeof PHASES)[number];

export const EXTRA_SECTIONS = ["children", "elderly", "pets", "special_needs", "rural"] as const;
export type ExtraSection = (typeof EXTRA_SECTIONS)[number];

// ---------- Hushållsprofil (formulärets utdata) ----------

export const profileSchema = z.object({
  lang: z.enum(LANGS),

  housing: z.object({
    type: z.enum(["apartment", "house", "farm", "other"]),
    floor: z.number().int().min(0).max(60).optional(),
    hasElevator: z.boolean().optional(),
  }),

  area: z.object({
    kind: z.enum(["city", "town", "rural"]),
    address: z.string().max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  }),

  household: z.object({
    adults: z.number().int().min(1).max(20),
    childrenAges: z.array(z.number().min(0).max(17)).max(15),
    seniors70plus: z.number().int().min(0).max(20),
    pets: z.array(z.enum(["dog", "cat", "other"])).max(10),
  }),

  // Kryssrutor, inga diagnoser i fritext
  specialNeeds: z.object({
    medicineNeedsCooling: z.boolean(),
    powerDependentAids: z.boolean(),
    reducedMobility: z.boolean(),
    specialDiet: z.boolean(),
  }),

  heating: z.enum(["district", "electric", "wood", "other"]),
  hasCar: z.boolean(),
  hasCashAtHome: z.boolean(),
  hasBatteryOrCrankRadio: z.boolean(),

  crises: z.array(z.enum(CRISIS_TYPES)).min(1),

  // Svar på regelstyrda följdfrågor (lib/form/rules.ts), nyckel = regel-id
  ruleAnswers: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])).default({}),

  // Självskattning, driver beredskapspoängen
  selfAssessment: z.object({
    waterDays: z.number().int().min(0).max(14),
    foodDays: z.number().int().min(0).max(14),
    alternativeHeat: z.boolean(),
    lightAndPower: z.boolean(),
    radio: z.boolean(),
    cash: z.boolean(),
    householdPlan: z.boolean(),
    knowsShelter: z.boolean(),
  }),

  // "Berätta om något i ditt hushåll som vi inte frågat om"
  freeText: z.string().max(1000).optional(),

  // Svar på AI:s följdfrågor, nyckel = question.id
  followUpAnswers: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])).default({}),
});
export type Profile = z.infer<typeof profileSchema>;

// ---------- Adaptiva följdfrågor (AI) ----------

export const followUpSchema = z.object({
  extractedNeeds: z.array(z.string()).max(5),
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(["yesno", "number", "choice", "text"]),
        options: z.array(z.string()).max(5).optional(),
      }),
    )
    .max(3),
});
export type FollowUp = z.infer<typeof followUpSchema>;
export type FollowUpQuestion = FollowUp["questions"][number];

// ---------- Uträknade fakta (lib/calc, aldrig AI) ----------

export const quantitySchema = z.object({
  value: z.number(),
  unit: z.string(), // "l", "dagar", "st", ...
});
export type Quantity = z.infer<typeof quantitySchema>;

export const shelterSchema = z.object({
  id: z.string(),
  property: z.string(), // fastighetsbeteckning från MCF, inte gatuadress
  lat: z.number(),
  lon: z.number(),
  capacity: z.number().int(), // antal platser
  limited: z.boolean(), // MCF-status "tillfällig begränsning"
  distanceMeters: z.number(),
});
export type Shelter = z.infer<typeof shelterSchema>;

export const computedFactsSchema = z.object({
  // Nyckel (t.ex. "water_total_l") som planens quantityRef pekar på
  quantities: z.record(z.string(), quantitySchema),
  score: z.object({
    total: z.number().min(0).max(100),
    byCategory: z.partialRecord(z.enum(CATEGORIES), z.number().min(0).max(100)),
  }),
  nearestShelters: z.array(shelterSchema).max(3),
});
export type ComputedFacts = z.infer<typeof computedFactsSchema>;

// ---------- Planen (AI, streamObject) ----------

export const planSchema = z.object({
  summary: z.string(), // 2-3 meningar om största sårbarheter
  riskProfile: z.array(
    z.object({
      crisis: z.enum(CRISIS_TYPES),
      level: z.enum(["low", "medium", "high"]),
      why: z.string(),
    }),
  ),
  missing: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        item: z.string(),
        quantityRef: z.string().optional(), // nyckel till uträknad mängd, aldrig en egen siffra
        priority: z.enum(["1", "2", "3"]),
        reason: z.string(),
      }),
    )
    .max(15),
  actionPlan: z.array(
    z.object({
      phase: z.enum(PHASES),
      actions: z.array(z.string()).max(6),
    }),
  ),
  shelterAdvice: z.string().optional(),
  extraSections: z.array(z.enum(EXTRA_SECTIONS)),
});
export type Plan = z.infer<typeof planSchema>;

// ---------- API-kontrakt ----------

export const planRequestSchema = z.object({
  profile: profileSchema,
  // true (standard): NDJSON-ström, se PlanStreamEvent. false: ett JSON-svar (PlanResponse).
  stream: z.boolean().default(true),
});
export type PlanRequest = z.input<typeof planRequestSchema>;

export type PlanResponse = {
  plan: Plan;
  facts: ComputedFacts;
  contacts: readonly { id: string; name: string; number?: string; url?: string }[];
};

// Händelser i NDJSON-strömmen från POST /api/plan (en JSON per rad).
export type PlanStreamEvent =
  | { type: "facts"; facts: ComputedFacts; contacts: PlanResponse["contacts"]; cached: boolean }
  | { type: "partial"; plan: DeepPartial<Plan> }
  | { type: "done"; plan: Plan }
  | { type: "error"; message: string };

// Under strömning kan listelement vara undefined tills de börjat skrivas.
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? (DeepPartial<U> | undefined)[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
