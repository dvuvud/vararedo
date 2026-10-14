import type { Profile, Quantity } from "@/lib/ai/schemas";

// MCF:s råd: 3 l vatten per person och dygn, 7 dygn.
export const WATER_L_PER_PERSON_DAY = 3;
export const TARGET_DAYS = 7;
const DIAPERS_PER_CHILD_DAY = 8;

export function householdSize(p: Profile): number {
  return p.household.adults + p.household.childrenAges.length;
}

/** Alla mängder är deterministiska. Planens `quantityRef` pekar på nycklarna här. */
export function computeQuantities(p: Profile): Record<string, Quantity> {
  const persons = householdSize(p);
  const q: Record<string, Quantity> = {};

  q.persons = { value: persons, unit: "st" };
  q.water_per_day_l = { value: persons * WATER_L_PER_PERSON_DAY, unit: "l" };
  q.water_total_l = { value: persons * WATER_L_PER_PERSON_DAY * TARGET_DAYS, unit: "l" };
  const waterDaysMissing = Math.max(0, TARGET_DAYS - p.selfAssessment.waterDays);
  q.water_missing_l = { value: persons * WATER_L_PER_PERSON_DAY * waterDaysMissing, unit: "l" };

  q.food_days_target = { value: TARGET_DAYS, unit: "dagar" };
  q.food_days_missing = { value: Math.max(0, TARGET_DAYS - p.selfAssessment.foodDays), unit: "dagar" };

  const toddlers = p.household.childrenAges.filter((a) => a < 3).length;
  if (toddlers > 0) {
    q.diapers_total = { value: toddlers * DIAPERS_PER_CHILD_DAY * TARGET_DAYS, unit: "st" };
  }
  const infants = p.household.childrenAges.filter((a) => a < 1).length;
  if (infants > 0) {
    q.infants = { value: infants, unit: "st" };
  }

  if (p.household.pets.length > 0) {
    q.pet_food_days = { value: TARGET_DAYS, unit: "dagar" };
  }
  return q;
}
