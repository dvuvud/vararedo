import type { CrisisType, Lang, Profile } from "@/lib/ai/schemas";
import { waterDaysFromLiters } from "@/lib/calc/quantities";

type Answer = boolean | number | string;

// Formulärets arbetsläge. Frågor utan svar är undefined, så vi kan visa vad som saknas.
export type Draft = {
  housingType?: Profile["housing"]["type"];
  floor: number;
  hasElevator?: boolean;
  areaKind?: Profile["area"]["kind"];
  address: string;
  lat?: number;
  lon?: number;
  adults: number;
  seniors: number;
  hasChildren?: boolean;
  childrenAges: number[];
  hasPets?: boolean;
  pets: ("dog" | "cat" | "other")[];
  needs: Profile["specialNeeds"];
  needsAnswered: boolean;
  heating?: Profile["heating"];
  hasCar?: boolean;
  hasCash?: boolean;
  hasRadio?: boolean;
  crises: CrisisType[];
  ruleAnswers: Record<string, Answer>;
  waterLiters?: number;
  foodDays?: number;
  alternativeHeat?: boolean;
  lightAndPower?: boolean;
  householdPlan?: boolean;
  knowsShelter?: boolean;
  freeText: string;
  followUpAnswers: Record<string, Answer>;
};

export const EMPTY_DRAFT: Draft = {
  floor: 0,
  address: "",
  adults: 1,
  seniors: 0,
  childrenAges: [],
  pets: [],
  needs: { medicineNeedsCooling: false, powerDependentAids: false, reducedMobility: false, specialDiet: false },
  needsAnswered: false,
  crises: [],
  ruleAnswers: {},
  freeText: "",
  followUpAnswers: {},
};

// Bygger profilen som skickas till /api/plan. Valideras med profileSchema innan anrop.
export function toProfile(d: Draft, lang: Lang): Profile {
  const isApartment = d.housingType === "apartment";
  const waterLiters = d.waterLiters ?? 0;
  return {
    lang,
    housing: {
      type: d.housingType ?? "other",
      ...(isApartment ? { floor: d.floor, hasElevator: d.hasElevator ?? false } : {}),
    },
    area: {
      kind: d.areaKind ?? "city",
      ...(d.address.trim() ? { address: d.address.trim() } : {}),
      ...(d.lat !== undefined && d.lon !== undefined ? { lat: d.lat, lon: d.lon } : {}),
    },
    household: {
      adults: d.adults,
      childrenAges: d.hasChildren ? d.childrenAges : [],
      // Personer över 70 räknas in bland de vuxna, inte utöver dem
      seniors70plus: Math.min(d.seniors, d.adults),
      pets: d.hasPets ? d.pets : [],
    },
    specialNeeds: d.needs,
    heating: d.heating ?? "other",
    hasCar: d.hasCar ?? false,
    hasCashAtHome: d.hasCash ?? false,
    hasBatteryOrCrankRadio: d.hasRadio ?? false,
    crises: d.crises,
    ruleAnswers: d.ruleAnswers,
    selfAssessment: {
      waterDays: waterDaysFromLiters(waterLiters, householdPersons(d)),
      waterLiters,
      foodDays: d.foodDays ?? 0,
      alternativeHeat: d.alternativeHeat ?? false,
      lightAndPower: d.lightAndPower ?? false,
      // Radio och kontanter frågas redan i steget "Det här har ni", så vi frågar inte två gånger
      radio: d.hasRadio ?? false,
      cash: d.hasCash ?? false,
      householdPlan: d.householdPlan ?? false,
      knowsShelter: d.knowsShelter ?? false,
    },
    ...(d.freeText.trim() ? { freeText: d.freeText.trim() } : {}),
    followUpAnswers: d.followUpAnswers,
  };
}

export function householdPersons(d: Draft): number {
  return d.adults + (d.hasChildren ? d.childrenAges.length : 0);
}
