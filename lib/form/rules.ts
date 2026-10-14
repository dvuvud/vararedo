import type { Profile } from "@/lib/ai/schemas";

/**
 * Regelstyrda följdfrågor (kod, inte AI). Rena funktioner utan sidoeffekter, så de fungerar både
 * i formuläret (klient, på en delvis ifylld profil) och på servern.
 *
 * Svaren sparas i `profile.ruleAnswers[rule.id]` och skickas med till planen.
 * Frågetexten ligger i messages/<lang>.json under nyckeln `rules.<id>`.
 */

export type RuleAnswer = boolean | number | string;

export type FormState = Partial<Omit<Profile, "housing" | "area" | "household">> & {
  housing?: Partial<Profile["housing"]>;
  area?: Partial<Profile["area"]>;
  household?: Partial<Profile["household"]>;
};

export type RuleQuestion = {
  id: string;
  type: "yesno" | "number" | "choice";
  /** i18n-nyckel i messages/<lang>.json */
  labelKey: string;
  options?: readonly string[];
};

type Rule = RuleQuestion & {
  /** Visas när villkoret är sant. `answers` är redan givna regelsvar. */
  when: (p: FormState, answers: Record<string, RuleAnswer>) => boolean;
};

const RULES: readonly Rule[] = [
  {
    // Barn under 3 år: ersättning och blöjor
    id: "toddler_supplies_week",
    type: "yesno",
    labelKey: "rules.toddler_supplies_week",
    when: (p) => (p.household?.childrenAges ?? []).some((a) => a < 3),
  },
  {
    // Landsbygd: brunn
    id: "has_well",
    type: "yesno",
    labelKey: "rules.has_well",
    when: (p) => p.area?.kind === "rural",
  },
  {
    // Följdfråga till brunn: elpump slutar fungera vid strömavbrott
    id: "well_pump_needs_power",
    type: "yesno",
    labelKey: "rules.well_pump_needs_power",
    when: (_p, a) => a.has_well === true,
  },
  {
    // Villa eller gård: reservkraft
    id: "has_backup_power",
    type: "yesno",
    labelKey: "rules.has_backup_power",
    when: (p) => p.housing?.type === "house" || p.housing?.type === "farm",
  },
  {
    // Husdjur: foder
    id: "pet_food_week",
    type: "yesno",
    labelKey: "rules.pet_food_week",
    when: (p) => (p.household?.pets ?? []).length > 0,
  },
];

/** Regler som ska visas för den här (delvis ifyllda) profilen, i fast ordning. */
export function visibleRules(
  state: FormState,
  answers: Record<string, RuleAnswer> = {},
): RuleQuestion[] {
  return RULES.filter((r) => r.when(state, answers)).map(({ id, type, labelKey, options }) => ({ id, type, labelKey, options }));
}

/** Tar bort svar på frågor som inte längre visas (t.ex. när man byter från landsbygd till stad). */
export function pruneAnswers(
  state: FormState,
  answers: Record<string, RuleAnswer>,
): Record<string, RuleAnswer> {
  // Iterera tills stabilt, eftersom en regel kan bero på en annan regels svar.
  let current = answers;
  for (let i = 0; i < RULES.length; i++) {
    const ids = new Set(visibleRules(state, current).map((q) => q.id));
    const next = Object.fromEntries(Object.entries(current).filter(([k]) => ids.has(k)));
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  return current;
}
