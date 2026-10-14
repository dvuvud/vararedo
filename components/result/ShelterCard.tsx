"use client";

import { useEffect, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import type { Shelter } from "@/lib/ai/schemas";
import type { Dict } from "@/lib/i18n";
import { fill } from "@/lib/format";

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

// MCF:s data har bara fastighetsbeteckning, så gatuadressen slås upp från skyddsrummets position.
// Går det inte visas fastighetsbeteckningen i stället.
export function ShelterCard({ shelter: s, t }: { shelter: Shelter; t: Dict["result"] }) {
  const [address, setAddress] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/geocode?lat=${s.lat}&lon=${s.lon}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ address: string }>) : null))
      .then((data) => setAddress(data?.address ?? null))
      .catch(() => !ctrl.signal.aborted && setAddress(null));
    return () => ctrl.abort();
  }, [s.lat, s.lon]);

  // Öppnar kartappen på telefonen med gångväg dit
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking`;

  return (
    <li className="rounded-2xl border border-border bg-card p-4 print:break-inside-avoid">
      <div className="flex gap-3">
        <MapPin aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold" aria-live="polite">
            {address === undefined ? (
              <span className="text-muted-foreground">{t.shelterAddressLoading}</span>
            ) : (
              (address ?? fill(t.shelterProperty, { property: s.property }))
            )}
          </p>
          <p className="text-base text-muted-foreground">
            {fill(t.shelterCapacity, { n: s.capacity })} · {fill(t.shelterDistance, { distance: formatDistance(s.distanceMeters) })}
          </p>
          {s.limited && (
            <p className="mt-1 inline-block rounded-full bg-warning/10 px-3 py-0.5 text-base font-semibold text-warning">
              {t.shelterLimited}
            </p>
          )}
        </div>
      </div>
      <a
        href={directions}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary text-lg font-semibold text-primary hover:bg-secondary print:hidden"
      >
        <Navigation aria-hidden className="size-5" />
        {t.shelterDirections}
      </a>
    </li>
  );
}
