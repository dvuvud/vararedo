// Översätter messages/sv.json till övriga språk med Claude. Svenska är källan.
// Kör:  node --env-file=.env.local scripts/translate-messages.mjs [språk...] [--force]
//   utan språk: alla. Utan --force översätts bara nycklar som saknas i målfilen (bra när sv.json fått nya texter).
// Resultatet ska granskas av någon som kan språket, särskilt so, ku och bs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const LANGS = {
  en: "engelska (English)",
  ar: "arabiska (modern standardarabiska, arabisk skrift)",
  fi: "finska",
  fa: "persiska (farsi, persisk skrift)",
  so: "somaliska",
  bs: "bosniska/kroatiska/serbiska i latinsk skrift, välj former som alla tre förstår",
  pl: "polska",
  ku: "kurdiska, sorani (arabisk skrift)",
  uk: "ukrainska",
};

const MODEL = process.env.TRANSLATE_MODEL ?? "claude-sonnet-5-5";
const args = process.argv.slice(2);
const force = args.includes("--force");
const wanted = args.filter((a) => !a.startsWith("--"));
const targets = wanted.length ? wanted : Object.keys(LANGS);
for (const l of targets) if (!(l in LANGS)) throw new Error(`Okänt språk: ${l}`);
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY saknas. Kör med --env-file=.env.local");

const root = new URL("../messages/", import.meta.url);
const sv = JSON.parse(readFileSync(new URL("sv.json", root), "utf8"));

// Plattar ut {a:{b:"x"},c:["y"]} till {"a.b":"x","c.0":"y"}
function flatten(o, p = "", out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
// Bygger tillbaka strukturen från svenska, så ordning och arrayer är identiska
function rebuild(template, flat, p = "") {
  if (Array.isArray(template)) return template.map((v, i) => rebuild(v, flat, p ? `${p}.${i}` : String(i)));
  if (template && typeof template === "object")
    return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, rebuild(v, flat, p ? `${p}.${k}` : k)]));
  return flat[p] ?? template;
}

const source = flatten(sv);
const placeholders = (s) => (String(s).match(/\{\w+\}/g) ?? []).sort().join(",");
const problems = (key, text) => {
  const issues = [];
  if (typeof text !== "string" || !text.trim()) issues.push("tom");
  else {
    if (placeholders(text) !== placeholders(source[key])) issues.push(`platshållare ${placeholders(source[key])} saknas eller ändrade`);
    if (/[—–]/.test(text)) issues.push("tankstreck");
  }
  return issues;
};

const system = (lang) => `Du översätter användargränssnitt för Vararedo, en webbapp där svenska hushåll får en personlig krisberedskapsplan baserad på MCF:s (Myndigheten för civilt försvar) råd.

Översätt från svenska till ${LANG_NAMES_FOR(lang)}.

Regler:
- Ton: lugn, saklig och trygg, aldrig alarmistisk. Enkelt språk som fungerar för personer som inte är vana vid myndighetsspråk. Korta meningar.
- Behåll platshållare som {n}, {total}, {current}, {done}, {distance}, {number}, {property} exakt som de står, tecken för tecken.
- Översätt inte "Vararedo", telefonnummer, siffror, webbadresser eller förkortningen MCF. Skriv ut vad MCF är bara om texten redan gör det.
- "Skyddsrum" är det svenska begreppet för civilförsvarets skyddsrum (bomb- och gasskydd). Använd den etablerade termen för det på målspråket.
- Inga tankstreck (— eller –). Använd komma eller punkt.
- Behåll skiljetecken och versalisering som är naturliga på målspråket. Texten kan visas höger-till-vänster, lägg inte till egna riktningstecken.
- Returnera exakt samma nycklar som du fick.`;
function LANG_NAMES_FOR(l) {
  return LANGS[l];
}

const schema = z.object({ translations: z.array(z.object({ key: z.string(), text: z.string() })) });

async function translate(lang, keys) {
  const payload = Object.fromEntries(keys.map((k) => [k, source[k]]));
  const { output } = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema }),
    system: system(lang),
    prompt: JSON.stringify(payload, null, 1),
    maxOutputTokens: 16000,
    maxRetries: 2,
    providerOptions: {
      anthropic: { structuredOutputMode: "outputFormat", thinking: { type: "between_tools" }, effort: "medium" },
    },
  });
  return Object.fromEntries(output.translations.map((t) => [t.key, t.text]));
}

async function run(lang) {
  const file = new URL(`${lang}.json`, root);
  const existing = existsSync(file) ? flatten(JSON.parse(readFileSync(file, "utf8"))) : {};
  const have = force ? {} : Object.fromEntries(Object.entries(existing).filter(([k]) => k in source && !problems(k, existing[k]).length));
  let todo = Object.keys(source).filter((k) => !(k in have));
  const result = { ...have };
  let log = [];
  for (let attempt = 1; attempt <= 2 && todo.length; attempt++) {
    const got = await translate(lang, todo);
    const bad = [];
    for (const k of todo) {
      const issues = k in got ? problems(k, got[k]) : ["saknas"];
      if (issues.length) bad.push(`${k}: ${issues.join(", ")}`);
      else result[k] = got[k];
    }
    todo = todo.filter((k) => !(k in result));
    if (bad.length) log.push(`försök ${attempt}: ${bad.length} avvisade (${bad.slice(0, 3).join(" | ")}${bad.length > 3 ? " ..." : ""})`);
  }
  // Det som fortfarande inte gick igenom lämnas utelagt: gränssnittet faller då tillbaka på svenska
  writeFileSync(file, JSON.stringify(rebuild(sv, result), null, 2).replace(/$/, "\n"));
  // Utelämnade nycklar skrivs ändå som svenska av rebuild, så markera dem tydligt i loggen
  const missing = Object.keys(source).filter((k) => !(k in result));
  console.log(`${lang}: ${Object.keys(result).length}/${Object.keys(source).length} översatta${missing.length ? `, ${missing.length} kvar på svenska: ${missing.join(", ")}` : ""}${log.length ? `\n   ${log.join("\n   ")}` : ""}`);
}

const results = await Promise.allSettled(targets.map(run));
results.forEach((r, i) => r.status === "rejected" && console.error(`${targets[i]}: FEL`, r.reason?.message ?? r.reason));
