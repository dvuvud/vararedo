"use client";

import { useId, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Hela kortet är klickbart och minst 56 px högt: lätt att träffa med tummen och tydligt för ovana användare.
// Riktiga radio/checkbox-element under ytan, så tangentbord och skärmläsare fungerar.
const cardClass =
  "group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-lg leading-snug transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring";

export function Question({
  id,
  label,
  hint,
  error,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = useId();
  return (
    <fieldset
      id={id}
      aria-describedby={hint ? hintId : undefined}
      aria-invalid={error ? true : undefined}
      className="scroll-mt-28 space-y-3"
    >
      <legend className="text-xl font-semibold leading-snug">{label}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-base text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-base font-medium text-destructive">
          <AlertCircle aria-hidden className="size-5 shrink-0" />
          {error}
        </p>
      )}
      {children}
    </fieldset>
  );
}

type Option<T> = { value: T; label: string; icon?: ReactNode };

export function ChoiceCards<T extends string | number | boolean>({
  options,
  value,
  onChange,
  columns = 1,
}: {
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <div className={cn("grid gap-3", columns === 2 && "grid-cols-2")}>
      {options.map((o) => (
        <label key={String(o.value)} className={cardClass}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.icon && <span className="shrink-0 text-primary [&_svg]:size-6">{o.icon}</span>}
          <span className="flex-1">{o.label}</span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-input group-has-checked:border-primary group-has-checked:bg-primary">
            <Check aria-hidden className="invisible size-4 text-primary-foreground group-has-checked:visible" />
          </span>
        </label>
      ))}
    </div>
  );
}

export function YesNo({
  value,
  onChange,
  yes,
  no,
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
}) {
  return (
    <ChoiceCards
      columns={2}
      value={value}
      onChange={onChange}
      options={[
        { value: true, label: yes },
        { value: false, label: no },
      ]}
    />
  );
}

export function CheckCard({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <label className={cardClass}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {icon && <span className="shrink-0 text-primary [&_svg]:size-6">{icon}</span>}
      <span className="flex-1">{label}</span>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border-2 border-input group-has-checked:border-primary group-has-checked:bg-primary">
        <Check aria-hidden className="invisible size-4 text-primary-foreground group-has-checked:visible" />
      </span>
    </label>
  );
}

// Plus/minus i stället för sifferfält: inget tangentbord som täcker skärmen och inga felskrivna värden.
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const btn =
    "flex size-14 items-center justify-center rounded-xl border-2 border-primary bg-card text-primary hover:bg-secondary disabled:border-border disabled:text-muted-foreground disabled:opacity-60";
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={decreaseLabel}
      >
        <Minus aria-hidden className="size-6" />
      </button>
      <output aria-live="polite" className="min-w-24 text-center text-2xl font-bold">
        {format(value)}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={increaseLabel}
      >
        <Plus aria-hidden className="size-6" />
      </button>
    </div>
  );
}

/**
 * Rullgardin med samma platta utseende överallt. `appearance-none` tar bort webbläsarens egen gradient
 * och pil, så den ritas separat. Den är fortfarande en vanlig <select>, så den fungerar likadant på
 * telefoner (egen väljare) och med skärmläsare. Chevronen ligger på rätt sida även i höger-till-vänster.
 */
export function SelectField({
  value,
  onChange,
  children,
  size = "lg",
  className,
  ...rest
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
  id?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none border-input bg-card bg-none ps-3 pe-10 text-foreground",
          size === "lg" ? "h-14 rounded-xl border-2 text-lg" : "h-11 rounded-lg border text-base",
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
