import { anthropic } from "@ai-sdk/anthropic";

// Modellerna kan bytas via env utan kodändring (t.ex. PLAN_MODEL=claude-haiku-4-5 om svarstiden blir för lång).
// OBS: CLAUDE.md nämner claude-haiku-5-5, men den finns inte i Anthropics modelltabell. Haiku 4.5 används tills vidare.
export const PLAN_MODEL_ID = process.env.PLAN_MODEL || "claude-sonnet-5-5";
export const FOLLOWUP_MODEL_ID = process.env.FOLLOWUP_MODEL || "claude-haiku-4-5";

/**
 * Claude 5-modellerna (Sonnet 5.5 m.fl.) avvisar icke-standard temperature med 400 och kan inte köras utan
 * thinking. Determinism kommer därför från cachen + strama scheman. Äldre modeller får temperature 0.
 */
export function modelSettings(modelId: string) {
  const isGen5 = /^claude-(sonnet|opus|fable|mythos)-5/.test(modelId);
  return {
    model: anthropic(modelId),
    ...(isGen5 ? {} : { temperature: 0 }),
    providerOptions: {
      anthropic: {
        // Undviker forcerat tool_choice, som Claude 5-modellerna svarar 400 på.
        structuredOutputMode: "outputFormat" as const,
        ...(isGen5 ? { thinking: { type: "between_tools" as const }, effort: "low" as const } : {}),
      },
    },
  };
}

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);
