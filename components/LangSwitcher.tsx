"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Globe } from "lucide-react";
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
      {/* appearance-none tar bort webbläsarens egen gradient på rullgardinen. Chevronen ritas separat. */}
      <span className="relative">
        <select
          value={lang}
          onChange={(e) => router.push(pathname.replace(/^\/[^/]+/, `/${e.target.value}`))}
          className="h-11 appearance-none rounded-lg border border-input bg-card bg-none ps-3 pe-9 text-base"
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-2 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}
