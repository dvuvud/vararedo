import { CATEGORIES, type Category, type Profile } from "@/lib/ai/schemas";
import { householdSize, TARGET_DAYS, WATER_L_PER_PERSON_DAY } from "./quantities";

// Vikter summerar till 100. Kategorier utan självskattning (t.ex. hygien) ingår inte i poängen.
const WEIGHTS: Partial<Record<Category, number>> = {
  water: 20,
  food: 15,
  heat: 15,
  light_power: 10,
  radio_info: 15,
  cash: 5,
  household_plan: 10,
  shelter: 10,
};

const pct = (days: number) => Math.round((Math.min(days, TARGET_DAYS) / TARGET_DAYS) * 100);

export function computeScore(p: Profile) {
  const s = p.selfAssessment;
  const byCategory: Partial<Record<Category, number>> = {
    water:
      s.waterLiters !== undefined
        ? Math.round(Math.min(1, s.waterLiters / (householdSize(p) * WATER_L_PER_PERSON_DAY * TARGET_DAYS)) * 100)
        : pct(s.waterDays),
    food: pct(s.foodDays),
    heat: s.alternativeHeat || p.heating === "wood" ? 100 : 0,
    light_power: s.lightAndPower ? 100 : 0,
    radio_info: s.radio || p.hasBatteryOrCrankRadio ? 100 : 0,
    cash: s.cash || p.hasCashAtHome ? 100 : 0,
    household_plan: s.householdPlan ? 100 : 0,
    shelter: s.knowsShelter ? 100 : 0,
  };

  let total = 0;
  for (const c of CATEGORIES) {
    const w = WEIGHTS[c];
    const v = byCategory[c];
    if (w !== undefined && v !== undefined) total += (w * v) / 100;
  }
  return { total: Math.round(total), byCategory };
}
