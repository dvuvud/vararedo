import { createHash } from "node:crypto";
import type { Plan, Profile } from "./schemas";

// Sorterade nycklar så att samma innehåll alltid ger samma sträng.
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    household: {
      ...p.household,
      childrenAges: [...p.household.childrenAges].sort((a, b) => a - b),
      pets: [...p.household.pets].sort(),
    },
    crises: [...new Set(p.crises)].sort(),
    freeText: p.freeText?.trim() || undefined,
    area: { ...p.area, address: p.area.address?.trim() || undefined },
  };
}

export function profileHash(p: Profile): string {
  return createHash("sha256").update(JSON.stringify(stable(normalizeProfile(p)))).digest("hex");
}

// In-memory lokalt. Överlever hot reload i dev via globalThis. Redis i produktion om tid finns.
const g = globalThis as unknown as { __planCache?: Map<string, Plan> };
const store = (g.__planCache ??= new Map<string, Plan>());

export const getCachedPlan = (key: string) => store.get(key);
export const setCachedPlan = (key: string, plan: Plan) => void store.set(key, plan);
