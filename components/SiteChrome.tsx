import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Lang } from "@/lib/ai/schemas";
import type { Dict } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";

export function SiteHeader({ lang, dict }: { lang: Lang; dict: Dict }) {
  return (
    <header className="border-b border-border bg-card print:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href={`/${lang}`} className="flex items-center gap-2 text-xl font-bold text-primary">
          <ShieldCheck aria-hidden className="size-7" />
          {dict.common.appName}
        </Link>
        <LangSwitcher lang={lang} label={dict.common.language} />
      </div>
    </header>
  );
}

export function SiteFooter({ dict }: { dict: Dict }) {
  return (
    <footer className="mt-auto border-t border-border bg-secondary">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 text-base text-muted-foreground">
        <p>{dict.footer.disclaimer}</p>
        <p>{dict.footer.source}</p>
      </div>
    </footer>
  );
}
