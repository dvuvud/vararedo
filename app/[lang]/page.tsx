import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, CloudLightning, Droplets, ListChecks, Printer, Shield, Smartphone, Zap } from "lucide-react";
import { CRISIS_TYPES } from "@/lib/ai/schemas";
import { getDictionary, isLang } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ContactList } from "@/components/ContactList";
import { LangChips } from "@/components/LangChips";

const CRISIS_ICONS = {
  power_outage: Zap,
  it_payment_mobile: Smartphone,
  water_outage: Droplets,
  extreme_weather: CloudLightning,
  war_heightened: Shield,
} as const;

const HOW_ICONS = [ClipboardList, ListChecks, Printer];

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.landing;

  const cta = (
    <Link
      href={`/${lang}/plan/new`}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
    >
      {t.cta}
      <ArrowRight aria-hidden className="size-5 rtl:rotate-180" />
    </Link>
  );

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
            <LangChips lang={lang} label={dict.common.language} />
            <h1 className="mt-8 text-3xl font-bold leading-tight text-balance sm:text-4xl">{t.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-primary-foreground/90">{t.lead}</p>
            <div className="mt-8">
              <Link
                href={`/${lang}/plan/new`}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-card px-6 text-lg font-semibold text-primary hover:bg-secondary sm:w-auto"
              >
                {t.cta}
                <ArrowRight aria-hidden className="size-5 rtl:rotate-180" />
              </Link>
              <p className="mt-3 text-base text-primary-foreground/85">{t.ctaNote}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-2xl font-bold text-primary">{t.howTitle}</h2>
          <ol className="mt-6 space-y-4">
            {t.how.map((step, i) => {
              const Icon = HOW_ICONS[i] ?? ClipboardList;
              return (
                <li key={step.title} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Icon aria-hidden className="size-5 text-primary" />
                      {step.title}
                    </h3>
                    <p className="mt-1 text-base text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="bg-secondary">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <h2 className="text-2xl font-bold text-primary">{t.whyTitle}</h2>
            <p className="mt-4 text-lg leading-relaxed">{t.whyText}</p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-2xl font-bold text-primary">{t.crisesTitle}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CRISIS_TYPES.map((c) => {
              const Icon = CRISIS_ICONS[c];
              return (
                <li key={c} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                  <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">{dict.crisis[c].title}</h3>
                    <p className="mt-1 text-base text-muted-foreground">{dict.crisis[c].text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">{cta}</div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <h2 className="text-2xl font-bold text-primary">{t.numbersTitle}</h2>
            <div className="mt-6">
              <ContactList dict={dict} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter dict={dict} />
    </>
  );
}
