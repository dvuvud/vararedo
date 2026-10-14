"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Flame,
  HelpCircle,
  Home,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Tractor,
  Trash2,
  Trees,
  Zap,
} from "lucide-react";
import { CRISIS_TYPES, followUpSchema, profileSchema, type FollowUpQuestion, type Lang } from "@/lib/ai/schemas";
import type { Dict } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { EMPTY_DRAFT, toProfile, type Draft } from "@/lib/form/draft";
import { pruneAnswers, visibleRules, type FormState, type RuleAnswer, type RuleQuestion } from "@/lib/form/rules";
import { DRAFT_KEY, PROFILE_KEY } from "@/lib/form/storage";
import { ChoiceCards, CheckCard, Question, Stepper, YesNo } from "./fields";


const STEPS = [
  "housing",
  "area",
  "household",
  "needs",
  "home",
  "crises",
  "supplies",
  "readiness",
  "freeText",
  "followUps",
] as const;
type Step = (typeof STEPS)[number];
// Följdfrågorna är ett extra steg som bara visas ibland, så de räknas inte i "Steg X av Y"
const COUNTED_STEPS = STEPS.length - 1;

type Errors = Record<string, true>;

// Var regelfrågorna visas: i samma steg som svaret som utlöser dem. Nya regler hamnar i "home".
type RuleStep = "housing" | "area" | "household" | "home";
const RULE_STEP: Record<string, RuleStep> = {
  has_backup_power: "housing",
  has_well: "area",
  well_pump_needs_power: "area",
  toddler_supplies_week: "household",
  pet_food_week: "household",
};

function formState(d: Draft): FormState {
  return {
    housing: { type: d.housingType },
    area: { kind: d.areaKind },
    household: { childrenAges: d.hasChildren ? d.childrenAges : [], pets: d.hasPets ? d.pets : [] },
  };
}

function rulesFor(d: Draft, step: RuleStep): RuleQuestion[] {
  return visibleRules(formState(d), d.ruleAnswers).filter((q) => (RULE_STEP[q.id] ?? "home") === step);
}

function loadSaved(): { draft: Draft; step: number } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { draft: Partial<Draft>; step: number };
      return { draft: { ...EMPTY_DRAFT, ...saved.draft }, step: Math.min(saved.step ?? 0, COUNTED_STEPS - 1) };
    }
  } catch {
    // Trasigt sparat utkast: börja om
  }
  return { draft: EMPTY_DRAFT, step: 0 };
}

function validate(step: Step, d: Draft): Errors {
  const e: Errors = {};
  const need = (id: string, ok: boolean) => {
    if (!ok) e[id] = true;
  };
  const rulesAnswered = (s: RuleStep) => rulesFor(d, s).forEach((q) => need(q.id, q.id in d.ruleAnswers));

  switch (step) {
    case "housing":
      need("housingType", !!d.housingType);
      if (d.housingType === "apartment") need("elevator", d.hasElevator !== undefined);
      rulesAnswered("housing");
      break;
    case "area":
      need("areaKind", !!d.areaKind);
      rulesAnswered("area");
      break;
    case "household":
      need("children", d.hasChildren !== undefined);
      need("pets", d.hasPets !== undefined);
      if (d.hasPets) need("petKinds", d.pets.length > 0);
      rulesAnswered("household");
      break;
    case "needs":
      need("needs", d.needsAnswered);
      break;
    case "home":
      need("heating", !!d.heating);
      need("car", d.hasCar !== undefined);
      need("cash", d.hasCash !== undefined);
      need("radio", d.hasRadio !== undefined);
      rulesAnswered("home");
      break;
    case "crises":
      need("crises", d.crises.length > 0);
      break;
    case "supplies":
      need("waterDays", d.waterDays !== undefined);
      need("foodDays", d.foodDays !== undefined);
      break;
    case "readiness":
      need("alternativeHeat", d.alternativeHeat !== undefined);
      need("lightAndPower", d.lightAndPower !== undefined);
      need("householdPlan", d.householdPlan !== undefined);
      need("knowsShelter", d.knowsShelter !== undefined);
      break;
  }
  return e;
}

export default function PlanWizard({ lang, dict }: { lang: Lang; dict: Dict }) {
  const router = useRouter();
  const t = dict.form;
  const c = dict.common;

  // Komponenten laddas bara i webbläsaren (se plan/new/page.tsx), så localStorage finns här
  const [initial] = useState(loadSaved);
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [stepIndex, setStepIndex] = useState(initial.step);
  const [errors, setErrors] = useState<Errors>({});
  const [followUps, setFollowUps] = useState<FollowUpQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const step = STEPS[stepIndex];

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step: stepIndex }));
  }, [draft, stepIndex]);

  // Nytt steg: börja högst upp och flytta fokus till rubriken, så skärmläsare läser upp den
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [stepIndex]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setAdvanceFrom(null);
  };
  // Envalsfråga besvarad och inget mer saknas i steget: gå vidare automatiskt, så slipper man trycka Nästa.
  // Kort paus så att man hinner se sitt val markerat. Varje ny ändring avbryter en väntande övergång.
  const [advanceFrom, setAdvanceFrom] = useState<number | null>(null);
  useEffect(() => {
    if (advanceFrom === null) return;
    const timer = setTimeout(() => {
      setStepIndex((i) => (i === advanceFrom ? i + 1 : i));
      setAdvanceFrom(null);
    }, 350);
    return () => clearTimeout(timer);
  }, [advanceFrom]);
  const choose = (patch: Partial<Draft>) => {
    set(patch);
    const done =
      step !== "freeText" && step !== "followUps" && Object.keys(validate(step, { ...draft, ...patch })).length === 0;
    if (done) setAdvanceFrom(stepIndex);
  };
  const setRule = (id: string, v: RuleAnswer) => choose({ ruleAnswers: { ...draft.ruleAnswers, [id]: v } });
  const err = (id: string) => (errors[id] ? c.answerRequired : undefined);

  const submit = (d: Draft) => {
    const profile = profileSchema.parse(toProfile({ ...d, ruleAnswers: pruneAnswers(formState(d), d.ruleAnswers) }, lang));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    router.push(`/${lang}/plan/result`);
  };

  // AI:s följdfrågor. Fel eller inga frågor: hoppa över steget och visa planen direkt.
  const fetchFollowUps = async () => {
    setBusy(true);
    try {
      const profile = toProfile({ ...draft, followUpAnswers: {} }, lang);
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
        signal: AbortSignal.timeout(15000),
      });
      const parsed = res.ok ? followUpSchema.safeParse(await res.json()) : null;
      if (parsed?.success && parsed.data.questions.length > 0) {
        setFollowUps(parsed.data.questions);
        setStepIndex(STEPS.indexOf("followUps"));
        return;
      }
    } catch {
      // Följdfrågorna är ett plus, inte ett krav
    } finally {
      setBusy(false);
    }
    submit(draft);
  };

  const next = () => {
    const e = validate(step, draft);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      document.getElementById(Object.keys(e)[0])?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (step === "freeText") {
      if (draft.freeText.trim()) void fetchFollowUps();
      else submit(draft);
      return;
    }
    if (step === "followUps") {
      submit(draft);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const back = () => {
    setErrors({});
    if (stepIndex === 0) router.push(`/${lang}`);
    else if (step === "followUps") setStepIndex(STEPS.indexOf("freeText"));
    else setStepIndex((i) => i - 1);
  };

  const startOver = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(EMPTY_DRAFT);
    setStepIndex(0);
    setErrors({});
  };

  const locateMe = () => {
    if (!navigator.geolocation) return setLocating("fail");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating("ok");
      },
      () => setLocating("fail"),
      { timeout: 10000 },
    );
  };

  const dayOptions = [
    { value: 0, label: t.days.none },
    { value: 1, label: t.days.oneTwo },
    { value: 3, label: t.days.threeSix },
    { value: 7, label: t.days.week },
  ];

  const ruleQuestions = (s: RuleStep) =>
    rulesFor(draft, s).map((q) => {
      const value = draft.ruleAnswers[q.id];
      return (
        <Question key={q.id} id={q.id} label={(dict.rules as Record<string, string>)[q.id] ?? q.id} error={err(q.id)}>
          {q.type === "yesno" && (
            <YesNo value={value as boolean | undefined} onChange={(v) => setRule(q.id, v)} yes={c.yes} no={c.no} />
          )}
          {q.type === "choice" && (
            <ChoiceCards
              value={value as string | undefined}
              onChange={(v) => setRule(q.id, v)}
              options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
            />
          )}
          {q.type === "number" && (
            <Stepper
              value={typeof value === "number" ? value : 0}
              onChange={(v) => set({ ruleAnswers: { ...draft.ruleAnswers, [q.id]: v } })}
              min={0}
              max={99}
              decreaseLabel={c.decrease}
              increaseLabel={c.increase}
            />
          )}
        </Question>
      );
    });

  const yesNo = (id: string, label: string, value: boolean | undefined, onChange: (v: boolean) => void, hint?: string) => (
    <Question id={id} label={label} hint={hint} error={err(id)}>
      <YesNo value={value} onChange={onChange} yes={c.yes} no={c.no} />
    </Question>
  );

  const shownStep = Math.min(stepIndex + 1, COUNTED_STEPS);
  const isLast = step === "followUps" || (step === "freeText" && !draft.freeText.trim());

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <p className="text-base font-medium text-muted-foreground">
            {fill(c.stepOf, { current: shownStep, total: COUNTED_STEPS })}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={COUNTED_STEPS}
            aria-valuenow={shownStep}
            className="mt-2 h-3 overflow-hidden rounded-full bg-accent"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(shownStep / COUNTED_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-36 pt-6">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-primary outline-none sm:text-3xl">
          {t.steps[step]}
        </h1>

        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-base font-medium text-destructive">
            {c.fixErrors}
          </p>
        )}

        <div className="mt-6 space-y-8">
          {step === "housing" && (
            <>
              <Question id="housingType" label={t.housingType.label} error={err("housingType")}>
                <ChoiceCards
                  value={draft.housingType}
                  onChange={(v) => choose({ housingType: v })}
                  options={[
                    { value: "apartment", label: t.housingType.apartment, icon: <Building2 /> },
                    { value: "house", label: t.housingType.house, icon: <Home /> },
                    { value: "farm", label: t.housingType.farm, icon: <Tractor /> },
                    { value: "other", label: t.housingType.other, icon: <HelpCircle /> },
                  ]}
                />
              </Question>
              {draft.housingType === "apartment" && (
                <>
                  <Question id="floor" label={t.floor.label}>
                    <Stepper
                      value={draft.floor}
                      onChange={(v) => set({ floor: v })}
                      min={0}
                      max={40}
                      format={(v) => (v === 0 ? t.floor.ground : String(v))}
                      decreaseLabel={c.decrease}
                      increaseLabel={c.increase}
                    />
                  </Question>
                  {yesNo("elevator", t.elevator.label, draft.hasElevator, (v) => choose({ hasElevator: v }))}
                </>
              )}
              {ruleQuestions("housing")}
            </>
          )}

          {step === "area" && (
            <>
              <Question id="address" label={t.address.label} hint={t.address.hint}>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={locateMe}
                    disabled={locating === "busy"}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-4 text-lg font-semibold text-primary hover:bg-secondary"
                  >
                    {locating === "busy" ? (
                      <Loader2 aria-hidden className="size-5 animate-spin" />
                    ) : (
                      <LocateFixed aria-hidden className="size-5" />
                    )}
                    {locating === "busy" ? t.address.locating : t.address.useLocation}
                  </button>
                  {locating === "ok" && (
                    <p role="status" className="flex items-center gap-2 text-base font-medium text-success">
                      <MapPin aria-hidden className="size-5" />
                      {t.address.located}
                    </p>
                  )}
                  {locating === "fail" && (
                    <p role="alert" className="text-base text-destructive">
                      {t.address.locationFailed}
                    </p>
                  )}
                  <input
                    type="text"
                    autoComplete="street-address"
                    aria-label={t.address.label}
                    placeholder={t.address.placeholder}
                    value={draft.address}
                    // Ny adress ersätter en tidigare hämtad position
                    onChange={(e) => {
                      set({ address: e.target.value, lat: undefined, lon: undefined });
                      setLocating("idle");
                    }}
                    className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-lg placeholder:text-muted-foreground"
                  />
                </div>
              </Question>
              <Question id="areaKind" label={t.areaKind.label} error={err("areaKind")}>
                <ChoiceCards
                  value={draft.areaKind}
                  onChange={(v) => choose({ areaKind: v })}
                  options={[
                    { value: "city", label: t.areaKind.city, icon: <Building2 /> },
                    { value: "town", label: t.areaKind.town, icon: <Home /> },
                    { value: "rural", label: t.areaKind.rural, icon: <Trees /> },
                  ]}
                />
              </Question>
              {ruleQuestions("area")}
            </>
          )}

          {step === "household" && (
            <>
              <Question id="adults" label={t.adults.label}>
                <Stepper
                  value={draft.adults}
                  onChange={(v) => set({ adults: v, seniors: Math.min(draft.seniors, v) })}
                  min={1}
                  max={20}
                  decreaseLabel={c.decrease}
                  increaseLabel={c.increase}
                />
              </Question>
              <Question id="seniors" label={t.seniors.label}>
                <Stepper
                  value={draft.seniors}
                  onChange={(v) => set({ seniors: v })}
                  min={0}
                  max={draft.adults}
                  decreaseLabel={c.decrease}
                  increaseLabel={c.increase}
                />
              </Question>
              <Question id="children" label={t.children.label} error={err("children")}>
                <YesNo
                  value={draft.hasChildren}
                  onChange={(v) =>
                    choose({ hasChildren: v, childrenAges: v && draft.childrenAges.length === 0 ? [0] : draft.childrenAges })
                  }
                  yes={c.yes}
                  no={c.no}
                />
                {draft.hasChildren && (
                  <div className="space-y-3 pt-2">
                    {draft.childrenAges.map((age, i) => (
                      <div key={i} className="flex items-end gap-3">
                        <label className="flex-1">
                          <span className="mb-1 block text-base font-medium">
                            {fill(t.children.child, { n: i + 1 })}: {t.children.age}
                          </span>
                          <select
                            value={age}
                            onChange={(e) => {
                              const ages = [...draft.childrenAges];
                              ages[i] = Number(e.target.value);
                              set({ childrenAges: ages });
                            }}
                            className="h-14 w-full rounded-xl border-2 border-input bg-card px-3 text-lg"
                          >
                            {Array.from({ length: 18 }, (_, a) => (
                              <option key={a} value={a}>
                                {a === 0 ? t.children.underOne : fill(t.children.years, { n: a })}
                              </option>
                            ))}
                          </select>
                        </label>
                        {draft.childrenAges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => set({ childrenAges: draft.childrenAges.filter((_, j) => j !== i) })}
                            className="flex size-14 items-center justify-center rounded-xl border-2 border-border text-destructive hover:border-destructive"
                            aria-label={`${t.children.remove}: ${fill(t.children.child, { n: i + 1 })}`}
                          >
                            <Trash2 aria-hidden className="size-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {draft.childrenAges.length < 15 && (
                      <button
                        type="button"
                        onClick={() => set({ childrenAges: [...draft.childrenAges, 0] })}
                        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary text-lg font-semibold text-primary hover:bg-secondary"
                      >
                        <Plus aria-hidden className="size-5" />
                        {t.children.add}
                      </button>
                    )}
                  </div>
                )}
              </Question>
              <Question id="pets" label={t.pets.label} error={err("pets")}>
                <YesNo value={draft.hasPets} onChange={(v) => choose({ hasPets: v })} yes={c.yes} no={c.no} />
              </Question>
              {draft.hasPets && (
                <Question id="petKinds" label={t.pets.which} error={err("petKinds")}>
                  <div className="grid gap-3">
                    {(["dog", "cat", "other"] as const).map((p) => (
                      <CheckCard
                        key={p}
                        label={t.pets[p]}
                        checked={draft.pets.includes(p)}
                        onChange={(on) => set({ pets: on ? [...draft.pets, p] : draft.pets.filter((x) => x !== p) })}
                      />
                    ))}
                  </div>
                </Question>
              )}
              {ruleQuestions("household")}
            </>
          )}

          {step === "needs" && (
            <Question id="needs" label={t.needs.label} hint={t.needs.hint} error={err("needs")}>
              <div className="grid gap-3">
                {(["medicineNeedsCooling", "powerDependentAids", "reducedMobility", "specialDiet"] as const).map((k) => (
                  <CheckCard
                    key={k}
                    label={t.needs[k]}
                    checked={draft.needs[k]}
                    onChange={(on) => set({ needs: { ...draft.needs, [k]: on }, needsAnswered: true })}
                  />
                ))}
                <CheckCard
                  label={t.needs.none}
                  checked={draft.needsAnswered && !Object.values(draft.needs).some(Boolean)}
                  onChange={() => choose({ needs: EMPTY_DRAFT.needs, needsAnswered: true })}
                />
              </div>
            </Question>
          )}

          {step === "home" && (
            <>
              <Question id="heating" label={t.heating.label} error={err("heating")}>
                <ChoiceCards
                  value={draft.heating}
                  onChange={(v) => choose({ heating: v })}
                  options={[
                    { value: "district", label: t.heating.district, icon: <Building2 /> },
                    { value: "electric", label: t.heating.electric, icon: <Zap /> },
                    { value: "wood", label: t.heating.wood, icon: <Flame /> },
                    { value: "other", label: t.heating.other, icon: <HelpCircle /> },
                  ]}
                />
              </Question>
              {yesNo("car", t.car.label, draft.hasCar, (v) => choose({ hasCar: v }))}
              {yesNo("cash", t.cash.label, draft.hasCash, (v) => choose({ hasCash: v }))}
              {yesNo("radio", t.radio.label, draft.hasRadio, (v) => choose({ hasRadio: v }))}
              {ruleQuestions("home")}
            </>
          )}

          {step === "crises" && (
            <Question id="crises" label={t.crises.label} error={err("crises")}>
              <div className="grid gap-3">
                <CheckCard
                  label={t.crises.all}
                  checked={draft.crises.length === CRISIS_TYPES.length}
                  onChange={(on) => set({ crises: on ? [...CRISIS_TYPES] : [] })}
                />
                {CRISIS_TYPES.map((k) => (
                  <CheckCard
                    key={k}
                    label={dict.crisis[k].title}
                    checked={draft.crises.includes(k)}
                    onChange={(on) =>
                      set({
                        // Behåll fast ordning så att samma val ger samma profil (cache)
                        crises: CRISIS_TYPES.filter((x) => (x === k ? on : draft.crises.includes(x))),
                      })
                    }
                  />
                ))}
              </div>
            </Question>
          )}

          {step === "supplies" && (
            <>
              <Question id="waterDays" label={t.waterDays.label} hint={t.waterDays.hint} error={err("waterDays")}>
                <ChoiceCards value={draft.waterDays} onChange={(v) => choose({ waterDays: v })} options={dayOptions} />
              </Question>
              <Question id="foodDays" label={t.foodDays.label} error={err("foodDays")}>
                <ChoiceCards value={draft.foodDays} onChange={(v) => choose({ foodDays: v })} options={dayOptions} />
              </Question>
            </>
          )}

          {step === "readiness" && (
            <>
              {yesNo(
                "alternativeHeat",
                t.alternativeHeat.label,
                draft.alternativeHeat,
                (v) => choose({ alternativeHeat: v }),
                t.alternativeHeat.hint,
              )}
              {yesNo("lightAndPower", t.lightAndPower.label, draft.lightAndPower, (v) => choose({ lightAndPower: v }))}
              {yesNo("householdPlan", t.householdPlan.label, draft.householdPlan, (v) => choose({ householdPlan: v }))}
              {yesNo("knowsShelter", t.knowsShelter.label, draft.knowsShelter, (v) => choose({ knowsShelter: v }))}
            </>
          )}

          {step === "freeText" && (
            <div className="space-y-2">
              <label htmlFor="freeText" className="block text-xl font-semibold leading-snug">
                {t.freeText.label} <span className="font-normal text-muted-foreground">({c.optional})</span>
              </label>
              <p className="text-base text-muted-foreground">{t.freeText.hint}</p>
              <textarea
                id="freeText"
                rows={5}
                maxLength={1000}
                value={draft.freeText}
                onChange={(e) => set({ freeText: e.target.value })}
                placeholder={t.freeText.placeholder}
                className="w-full rounded-xl border-2 border-input bg-card p-4 text-lg placeholder:text-muted-foreground"
              />
            </div>
          )}

          {step === "followUps" && (
            <>
              <p className="text-lg">{t.followUps.intro}</p>
              {followUps.map((q) => {
                const value = draft.followUpAnswers[q.id];
                const setAnswer = (v: boolean | number | string) =>
                  set({ followUpAnswers: { ...draft.followUpAnswers, [q.id]: v } });
                return (
                  <Question key={q.id} id={`fu-${q.id}`} label={q.question}>
                    {q.type === "yesno" && (
                      <YesNo value={value as boolean | undefined} onChange={setAnswer} yes={c.yes} no={c.no} />
                    )}
                    {q.type === "number" && (
                      <Stepper
                        value={typeof value === "number" ? value : 0}
                        onChange={setAnswer}
                        min={0}
                        max={99}
                        decreaseLabel={c.decrease}
                        increaseLabel={c.increase}
                      />
                    )}
                    {q.type === "choice" && (
                      <ChoiceCards
                        value={value as string | undefined}
                        onChange={setAnswer}
                        options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
                      />
                    )}
                    {q.type === "text" && (
                      <textarea
                        rows={3}
                        maxLength={300}
                        aria-label={q.question}
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="w-full rounded-xl border-2 border-input bg-card p-4 text-lg"
                      />
                    )}
                  </Question>
                );
              })}
            </>
          )}
        </div>

        {stepIndex === 0 && (
          <button type="button" onClick={startOver} className="mt-10 text-base text-muted-foreground underline">
            {c.startOver}
          </button>
        )}
      </main>

      {/* Fast knapprad längst ner: alltid inom räckhåll för tummen på mobil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <button
            type="button"
            onClick={back}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-lg font-semibold text-primary hover:bg-secondary"
          >
            <ArrowLeft aria-hidden className="size-5 rtl:rotate-180" />
            {c.back}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className="flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 aria-hidden className="size-5 animate-spin" />
                <span>{t.followUps.loading}</span>
              </>
            ) : (
              <>
                {isLast ? c.done : c.next}
                <ArrowRight aria-hidden className="size-5 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
