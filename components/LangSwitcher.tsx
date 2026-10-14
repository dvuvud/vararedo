"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { SelectField } from "@/components/form/fields";
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
      <SelectField
        size="md"
        value={lang}
        onChange={(v) => router.push(pathname.replace(/^\/[^/]+/, `/${v}`))}
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </SelectField>
    </label>
  );
}
