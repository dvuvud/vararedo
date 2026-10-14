"use client";

import Link from "next/link";
import { LANGS, type Lang } from "@/lib/langs";
import { LANG_NAMES, rememberLang } from "@/lib/format";

// Språkval som synliga länkar på landningssidan, så att man hittar sitt språk direkt utan att öppna en meny.
export function LangChips({ lang, label }: { lang: Lang; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {LANGS.map((l) => (
          <li key={l}>
            <Link
              href={`/${l}`}
              lang={l}
              hrefLang={l}
              onClick={() => rememberLang(l)}
              aria-current={l === lang ? "page" : undefined}
              className={
                l === lang
                  ? "inline-flex min-h-11 items-center rounded-full bg-primary-foreground px-4 text-base font-semibold text-primary"
                  : "inline-flex min-h-11 items-center rounded-full border border-primary-foreground/40 px-4 text-base text-primary-foreground hover:bg-primary-foreground/10"
              }
            >
              {LANG_NAMES[l]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
