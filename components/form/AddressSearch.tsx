"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MapPin, Pencil, Search } from "lucide-react";
import type { Dict } from "@/lib/i18n";

export type PickedAddress = { label: string; lat: number; lon: number };
type Candidate = PickedAddress;

/**
 * Adress eller postnummer i ett fält. Förslagen visas medan man skriver när servern har en
 * autocomplete-tjänst (GEOAPIFY_API_KEY). Annars, eller vid Enter och knapptryck, görs en explicit sökning.
 * Användaren väljer alltid sin adress i listan, så vi aldrig gissar fel stad och det syns att det blev rätt.
 */
export function AddressSearch({
  t,
  query,
  confirmed,
  onQueryChange,
  onPick,
}: {
  t: Dict["form"]["address"];
  /** Fältets text. När `confirmed` är sann är det den valda adressen. */
  query: string;
  /** Position finns (vald i listan eller hämtad från enheten). */
  confirmed: boolean;
  onQueryChange: (q: string) => void;
  onPick: (a: PickedAddress) => void;
}) {
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "empty" | "error">("idle");

  // Live-sökning medan man skriver: "unknown" tills första svaret, "no" om servern saknar autocomplete-tjänst
  const live = useRef<"unknown" | "yes" | "no">("unknown");
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (confirmed || q.length < 3 || live.current === "no") return;
    const id = ++requestId.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&suggest=5&live=1`, { signal: ctrl.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { candidates?: Candidate[]; live?: boolean };
        if (body.live === false) {
          live.current = "no";
          return;
        }
        live.current = "yes";
        // Ignorera svar på en sökning som redan är ersatt av nyare text
        if (id === requestId.current && body.candidates?.length) {
          setResults(body.candidates);
          setStatus("idle");
        }
      } catch {
        // Avbruten eller nätverksfel: användaren kan fortfarande trycka Sök
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, confirmed]);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    requestId.current++;
    setStatus("busy");
    setResults(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&suggest=5`, {
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 404) return setStatus("empty");
      if (!res.ok) return setStatus("error");
      const { candidates } = (await res.json()) as { candidates: Candidate[] };
      if (!candidates?.length) return setStatus("empty");
      setResults(candidates);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  if (confirmed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-success bg-card p-4">
        <MapPin aria-hidden className="size-6 shrink-0 text-success" />
        <p role="status" className="min-w-0 flex-1 text-lg font-semibold leading-snug">
          {query.trim() || t.located}
        </p>
        <button
          type="button"
          onClick={() => {
            onQueryChange(query.trim());
            setResults(null);
            setStatus("idle");
          }}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-base font-semibold text-primary hover:bg-secondary"
        >
          <Pencil aria-hidden className="size-4" />
          {t.change}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="street-address"
          aria-label={t.label}
          placeholder={t.placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setResults(null);
            setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          className="h-14 min-w-0 flex-1 rounded-xl border-2 border-input bg-card px-4 text-lg placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={status === "busy" || query.trim().length < 3}
          className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground disabled:opacity-50"
        >
          {status === "busy" ? (
            <Loader2 aria-hidden className="size-5 animate-spin" />
          ) : (
            <Search aria-hidden className="size-5" />
          )}
          <span>{status === "busy" ? t.searching : t.search}</span>
        </button>
      </div>

      {results && (
        <div>
          <p className="mb-2 text-base font-medium text-muted-foreground">{t.pickPrompt}</p>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={`${r.label}:${r.lat}:${r.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setResults(null);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-start text-lg leading-snug hover:border-primary hover:bg-secondary"
                >
                  <MapPin aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(status === "empty" || status === "error") && (
        <p role="alert" className="flex items-start gap-2 text-base text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
          {status === "empty" ? t.noResults : t.searchFailed}
        </p>
      )}
    </div>
  );
}
