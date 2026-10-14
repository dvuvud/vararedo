"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LANGS, type Lang } from "@/lib/ai/schemas";
import { LANG_NAMES } from "@/lib/format";

// Vanlig <select>: fungerar likadant på alla telefoner och med skärmläsare.
export function LangSwitcher({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-base">
      <Globe aria-hidden className="size-5 text-primary" />
      <span className="sr-only">{label}</span>
      <select
        value={lang}
        onChange={(e) => router.push(pathname.replace(/^\/[^/]+/, `/${e.target.value}`))}
        className="h-11 rounded-lg border border-input bg-card px-2 text-base"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
