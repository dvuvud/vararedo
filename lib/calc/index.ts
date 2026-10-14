import type { ComputedFacts, Profile } from "@/lib/ai/schemas";
import { nearestShelters } from "@/lib/data/shelters";
import { computeQuantities } from "./quantities";
import { computeScore } from "./score";

export function computeFacts(profile: Profile): ComputedFacts {
  const { lat, lon } = profile.area;
  return {
    quantities: computeQuantities(profile),
    score: computeScore(profile),
    nearestShelters: lat !== undefined && lon !== undefined ? nearestShelters(lat, lon, 3) : [],
  };
}
