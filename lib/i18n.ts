import "server-only";
import sv from "@/messages/sv.json";
import { LANGS, type Lang } from "@/lib/ai/schemas";

export type Dict = typeof sv;

const loaders: Record<Lang, () => Promise<{ default: unknown }>> = {
  sv: () => import("@/messages/sv.json"),
  en: () => import("@/messages/en.json"),
  ar: () => import("@/messages/ar.json"),
  fi: () => import("@/messages/fi.json"),
  fa: () => import("@/messages/fa.json"),
  so: () => import("@/messages/so.json"),
  bs: () => import("@/messages/bs.json"),
  pl: () => import("@/messages/pl.json"),
  ku: () => import("@/messages/ku.json"),
  uk: () => import("@/messages/uk.json"),
};

// Svenska är källan: nycklar som saknas i en översättning faller tillbaka på svenska.
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) && over.length === base.length ? over : base) as T;
  if (base && typeof base === "object") {
    const o = (over && typeof over === "object" ? over : {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(base)) out[k] = merge(v, o[k]);
    return out as T;
  }
  return (typeof over === typeof base ? over : base) as T;
}

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export async function getDictionary(lang: Lang): Promise<Dict> {
  if (lang === "sv") return sv;
  const mod = await loaders[lang]();
  return merge(sv, mod.default);
}
