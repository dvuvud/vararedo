// Enkel ersättning av {nyckel} i UI-texter. Fungerar både på server och klient.
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

// Språknamn på respektive språk, så att man hittar sitt eget språk i listan.
export const LANG_NAMES = {
  sv: "Svenska",
  en: "English",
  ar: "العربية",
  fi: "Suomi",
  fa: "فارسی",
  so: "Soomaali",
  bs: "Bosanski / Hrvatski / Srpski",
  pl: "Polski",
  ku: "کوردی",
  uk: "Українська",
} as const;
