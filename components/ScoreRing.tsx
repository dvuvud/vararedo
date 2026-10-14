// Poängen räknas alltid i kod (lib/calc/score.ts). Ringen visar bara värdet.
export function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, Math.round(score)));
  // Färg förstärker siffran men bär aldrig informationen ensam
  const color = value < 40 ? "var(--destructive)" : value < 70 ? "var(--warning)" : "var(--success)";

  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold leading-none">{value}</span>
        <span className="mt-1 text-base text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
