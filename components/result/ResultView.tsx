"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, MapPin, Pencil, Printer } from "lucide-react";
import {
  PHASES,
  type ComputedFacts,
  type DeepPartial,
  type Lang,
  type Plan,
  type PlanStreamEvent,
  type Profile,
} from "@/lib/ai/schemas";
import type { Dict } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { CHECKED_KEY, PROFILE_KEY } from "@/lib/form/storage";
import { ScoreRing } from "@/components/ScoreRing";
import { ShelterCard } from "./ShelterCard";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "error"; message?: string }
  // done = false medan planen fortfarande skrivs fram
  | { kind: "ok"; facts: ComputedFacts; plan: Plan; done: boolean; error?: string };

// Under strömningen är planen ofullständig. Behåll bara poster som har det som krävs för att visas.
function normalize(p: DeepPartial<Plan> | undefined): Plan {
  return {
    summary: p?.summary ?? "",
    riskProfile: (p?.riskProfile ?? []).flatMap((r) =>
      r?.crisis && r.level ? [{ crisis: r.crisis, level: r.level, why: r.why ?? "" }] : [],
    ),
    missing: (p?.missing ?? []).flatMap((m) =>
      m?.category && m.item && m.priority
        ? [
            {
              category: m.category,
              item: m.item,
              priority: m.priority,
              reason: m.reason ?? "",
              quantityRef: m.quantityRef,
            },
          ]
        : [],
    ),
    actionPlan: (p?.actionPlan ?? []).flatMap((a) =>
      a?.phase ? [{ phase: a.phase, actions: (a.actions ?? []).filter((x): x is string => !!x) }] : [],
    ),
    shelterAdvice: p?.shelterAdvice,
    extraSections: (p?.extraSections ?? []).filter((x) => !!x),
  };
}

function loadProfile(): string | null {
  return localStorage.getItem(PROFILE_KEY);
}

// Avbockningar hör till en viss profil. Ändrar man svaren börjar listan om.
function loadChecked(profile: string | null): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? "null") as {
      profile: string;
      checked: string[];
    } | null;
    return saved && saved.profile === profile ? saved.checked : [];
  } catch {
    return [];
  }
}


const LEVEL_STYLE = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
} as const;

export default function ResultView({ lang, dict, contacts }: { lang: Lang; dict: Dict; contacts: React.ReactNode }) {
  const t = dict.result;
  const [profile] = useState(loadProfile);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<string[]>(() => loadChecked(profile));

  // NDJSON från /api/plan: först fakta (poäng, mängder, skyddsrum), sedan planen bit för bit.
  useEffect(() => {
    if (!profile) return;
    const ctrl = new AbortController();
    const handle = (ev: PlanStreamEvent) => {
      if (ev.type === "facts") setState({ kind: "ok", facts: ev.facts, plan: normalize(undefined), done: false });
      else if (ev.type === "partial") setState((s) => (s.kind === "ok" ? { ...s, plan: normalize(ev.plan) } : s));
      else if (ev.type === "done")
        setState((s) => (s.kind === "ok" ? { ...s, plan: normalize(ev.plan), done: true } : s));
      // Servern skriver sina felmeddelanden på svenska. Vi visar alltid ordlistans text på användarens språk.
      else if (ev.type === "error")
        setState((s) => (s.kind === "ok" ? { ...s, done: true, error: t.error } : { kind: "error" }));
    };
    (async () => {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: JSON.parse(profile) as Profile, stream: true }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as PlanStreamEvent);
      }
      if (buffer.trim()) handle(JSON.parse(buffer) as PlanStreamEvent);
      // Strömmen tog slut utan "done": visa det vi har
      setState((s) => (s.kind === "ok" ? { ...s, done: true } : s.kind === "loading" ? { kind: "error" } : s));
    })().catch(() => {
      // Visa aldrig råa fel för användaren
      if (!ctrl.signal.aborted)
        setState((s) => (s.kind === "ok" ? { ...s, done: true, error: t.error } : { kind: "error" }));
    });
    return () => ctrl.abort();
  }, [profile, attempt, t.error]);

  useEffect(() => {
    if (profile) localStorage.setItem(CHECKED_KEY, JSON.stringify({ profile, checked }));
  }, [profile, checked]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((a) => a + 1);
  };

  if (!profile) {
    return (
      <Centered>
        <p className="text-lg">{t.noProfile}</p>
        <PrimaryLink href={`/${lang}/plan/new`}>{t.goToForm}</PrimaryLink>
      </Centered>
    );
  }

  if (state.kind === "loading") {
    return (
      <Centered>
        <Loader2 aria-hidden className="size-10 animate-spin text-primary" />
        <p role="status" className="text-lg">
          {t.loading}
        </p>
      </Centered>
    );
  }

  if (state.kind === "error") {
    return (
      <Centered>
        <AlertTriangle aria-hidden className="size-10 text-warning" />
        <p role="alert" className="text-lg">
          {t.error}
        </p>
        <button
          type="button"
          onClick={retry}
          className="min-h-14 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"
        >
          {t.retry}
        </button>
      </Centered>
    );
  }

  const { plan, facts, done } = state;
  const score = facts.score.total;
  const scoreText = score < 40 ? t.scoreLow : score < 70 ? t.scoreMid : t.scoreHigh;
  const itemKey = (m: (typeof plan.missing)[number]) => `${m.category}:${m.item}`;
  const doneCount = plan.missing.filter((m) => checked.includes(itemKey(m))).length;
  const priorities = (["1", "2", "3"] as const).filter((p) => plan.missing.some((m) => m.priority === p));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 py-6 print:space-y-6 print:py-0">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-primary">{t.title}</h1>
        <div className="flex flex-col gap-3 sm:flex-row print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Printer aria-hidden className="size-5" />
            {t.print}
          </button>
          <Link
            href={`/${lang}/plan/new`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-primary px-5 text-lg font-semibold text-primary hover:bg-secondary"
          >
            <Pencil aria-hidden className="size-5" />
            {t.edit}
          </Link>
        </div>
      </div>

      {!done && (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-lg print:hidden">
          <Loader2 aria-hidden className="size-6 shrink-0 animate-spin text-primary" />
          {t.writing}
        </p>
      )}
      {state.error && (
        <div role="alert" className="space-y-3 rounded-2xl bg-warning/10 p-4 text-lg print:hidden">
          <p className="flex items-center gap-3">
            <AlertTriangle aria-hidden className="size-6 shrink-0 text-warning" />
            {state.error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="min-h-14 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"
          >
            {t.retry}
          </button>
        </div>
      )}

      <Section title={t.scoreTitle}>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <ScoreRing score={score} label={t.scoreOf} />
          <p className="text-lg">{scoreText}</p>
        </div>
      </Section>

      {plan.summary && (
        <Section title={t.summaryTitle}>
          <p className="rounded-2xl bg-secondary p-5 text-lg leading-relaxed">{plan.summary}</p>
        </Section>
      )}

      {plan.missing.length > 0 && (
        <Section title={t.missingTitle}>
          <p className="text-base text-muted-foreground print:hidden">
            {t.missingHint}{" "}
            <strong className="text-foreground">
              {fill(t.missingDone, { done: doneCount, total: plan.missing.length })}
            </strong>
          </p>
          {priorities.map((p) => (
            <div key={p} className="space-y-3">
              <h3 className="text-lg font-semibold">{t.priority[p]}</h3>
              <ul className="space-y-3">
                {plan.missing
                  .filter((m) => m.priority === p)
                  .map((m) => {
                    const key = itemKey(m);
                    const isDone = checked.includes(key);
                    const qty = m.quantityRef ? facts.quantities[m.quantityRef] : undefined;
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            "group flex cursor-pointer gap-3 rounded-xl border-2 border-border bg-card p-4 has-checked:border-success has-checked:bg-success/5 has-focus-visible:ring-3 has-focus-visible:ring-ring",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            disabled={!done}
                            checked={isDone}
                            onChange={(e) =>
                              setChecked((c) => (e.target.checked ? [...c, key] : c.filter((x) => x !== key)))
                            }
                          />
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-input group-has-checked:border-success group-has-checked:bg-success">
                            <Check aria-hidden className="invisible size-5 text-white group-has-checked:visible" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className={cn("text-lg font-semibold", isDone && "line-through")}>{m.item}</span>
                              {qty && (
                                <span
                                  dir="ltr"
                                  className="rounded-md bg-secondary px-2 py-0.5 text-base font-bold text-primary"
                                >
                                  {qty.value} {qty.unit}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-base text-muted-foreground">{m.reason}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {plan.actionPlan.length > 0 && (
        <Section title={t.actionTitle}>
          <ol className="space-y-4">
            {PHASES.map((phase) => {
              const block = plan.actionPlan.find((a) => a.phase === phase);
              if (!block || block.actions.length === 0) return null;
              return (
                <li key={phase} className="rounded-2xl border border-border bg-card p-5 print:break-inside-avoid">
                  <h3 className="text-lg font-bold text-primary">{t.phase[phase]}</h3>
                  <ul className="mt-3 list-disc space-y-2 ps-6 text-lg marker:text-primary">
                    {block.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {plan.riskProfile.length > 0 && (
        <Section title={t.riskTitle}>
          <ul className="space-y-3">
            {plan.riskProfile.map((r) => (
              <li key={r.crisis} className="rounded-2xl border border-border bg-card p-5 print:break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{dict.crisis[r.crisis].title}</h3>
                  <span className={cn("rounded-full px-3 py-1 text-base font-semibold", LEVEL_STYLE[r.level])}>
                    {t.level[r.level]}
                  </span>
                </div>
                <p className="mt-2 text-base text-muted-foreground">{r.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t.shelterTitle}>
        {plan.shelterAdvice && <p className="text-lg">{plan.shelterAdvice}</p>}
        {/* Utan adress eller position finns inga skyddsrum att visa: säg det och visa hur man fixar det */}
        {facts.nearestShelters.length === 0 && (
          <div className="space-y-3 rounded-2xl bg-secondary p-4 print:hidden">
            <p className="text-lg">{t.shelterMissing}</p>
            <Link
              href={`/${lang}/plan/new?step=area`}
              className="inline-flex min-h-14 items-center gap-2 rounded-xl border-2 border-primary bg-card px-5 text-lg font-semibold text-primary"
            >
              <MapPin aria-hidden className="size-5" />
              {t.edit}
            </Link>
          </div>
        )}
        <ul className="space-y-3">
          {facts.nearestShelters.map((s) => (
            <ShelterCard key={s.id} shelter={s} t={t} />
          ))}
        </ul>
        <p className="text-base text-muted-foreground">{t.shelterNote}</p>
      </Section>

      <Section title={t.contactsTitle}>{contacts}</Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      {children}
    </main>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"
    >
      {children}
    </Link>
  );
}
