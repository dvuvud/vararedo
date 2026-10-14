// Språklistan på ett ställe. Ligger i en egen liten fil så att proxy.ts kan använda den utan zod.
export const LANGS = ["sv", "en", "ar", "fi", "fa", "so", "bs", "pl", "ku", "uk", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export const RTL_LANGS: readonly Lang[] = ["ar", "fa", "ku"];

// Webbläsarens språkkoder som vi mappar till våra. bs täcker även kroatiska och serbiska, ku även sorani (ckb).
const ALIASES: Record<string, Lang> = { hr: "bs", sr: "bs", ckb: "ku", prs: "fa", nb: "sv", nn: "sv" };

/** Bästa träff ur ett Accept-Language-huvud, eller undefined. Högst q-värde vinner. */
export function pickLang(header: string | null | undefined): Lang | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { base: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.base && x.base !== "*")
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { base } of ranked) {
    const lang = ALIASES[base] ?? (base as Lang);
    if ((LANGS as readonly string[]).includes(lang)) return lang;
  }
  return undefined;
}

export const isLang = (v: string | undefined): v is Lang => !!v && (LANGS as readonly string[]).includes(v);
