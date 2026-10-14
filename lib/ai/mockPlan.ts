import type { ComputedFacts, Plan } from "./schemas";

// Hårdkodad plan så frontend kan börja direkt. Byts mot streamObject i steg 2.
export const MOCK_PLAN: Plan = {
  summary:
    "Ert hushåll har inget vatten eller någon radio hemma och bor högt upp utan hiss. Det gör längre strömavbrott särskilt svåra. Börja med vatten och en batteriradio.",
  riskProfile: [
    { crisis: "power_outage", level: "high", why: "Hiss och vattenpump slutar fungera, och ni har ingen alternativ värme." },
    { crisis: "water_outage", level: "medium", why: "Ni har inget vatten hemma, och att bära vatten till våning 6 tar tid." },
    { crisis: "it_payment_mobile", level: "medium", why: "Inga kontanter hemma om kortbetalning slutar fungera." },
  ],
  missing: [
    { category: "water", item: "Dricksvatten", quantityRef: "water_total_l", priority: "1", reason: "Vatten är det första som tar slut och går inte att vara utan." },
    { category: "radio_info", item: "Batteri- eller vevradio", priority: "1", reason: "Mobilnätet kan vara nere, radion ger er information." },
    { category: "children", item: "Ersättning och blöjor", quantityRef: "diapers_total", priority: "1", reason: "Bebis på 8 månader behöver mat och blöjor även när butikerna är stängda." },
    { category: "cash", item: "Kontanter i små sedlar", priority: "2", reason: "Kortbetalning kan sluta fungera." },
    { category: "light_power", item: "Ficklampa och powerbank", priority: "2", reason: "Ljus och mobilladdning när strömmen är borta." },
  ],
  actionPlan: [
    { phase: "now", actions: ["Fyll badkar och kärl med vatten om det finns tid.", "Ladda mobiler och powerbank."] },
    { phase: "first_hour", actions: ["Lyssna på P4 för information.", "Samla hushållet på en bestämd plats."] },
    { phase: "first_day", actions: ["Kontrollera mat och vatten.", "Kontakta grannar som kan behöva hjälp."] },
    { phase: "first_week", actions: ["Räkna ut hur länge vattnet räcker.", "Följ information från kommunen."] },
  ],
  shelterAdvice:
    "Närmaste skyddsrum ligger på gångavstånd, men ni bor på våning 6 utan hiss. Planera för trappor med bebis.",
  extraSections: ["children"],
};

export const MOCK_FACTS: ComputedFacts = {
  quantities: {
    water_total_l: { value: 63, unit: "l" },
    diapers_total: { value: 56, unit: "st" },
  },
  score: {
    total: 28,
    byCategory: {
      water: 0, food: 30, heat: 0, light_power: 50, radio_info: 0, cash: 0,
      household_plan: 50, shelter: 0, medicine_health: 50, hygiene: 40,
      children: 20, pets: 100, communication: 50,
    },
  },
  nearestShelters: [
    { id: "demo-1", address: "Exempelgatan 1", municipality: "Göteborg", lat: 57.7089, lon: 11.9746, capacity: 200, distanceMeters: 450 },
  ],
};
