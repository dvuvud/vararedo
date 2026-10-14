import raw from "@/data/skyddsrum.min.json";
import type { Shelter } from "@/lib/ai/schemas";

// Kolumnvis format från scripts/build-shelters.mjs
const data = raw as unknown as {
  lat: number[];
  lon: number[];
  cap: number[];
  lim: number[];
  id: string[];
  fast: string[];
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** De n närmaste skyddsrummen. Linjär sökning över ca 63 000 poster, någon millisekund. */
export function nearestShelters(lat: number, lon: number, n = 3): Shelter[] {
  const best: Shelter[] = [];
  for (let i = 0; i < data.lat.length; i++) {
    const d = haversineMeters(lat, lon, data.lat[i], data.lon[i]);
    if (best.length === n && d >= best[n - 1].distanceMeters) continue;
    best.push({
      id: data.id[i],
      property: data.fast[i],
      lat: data.lat[i],
      lon: data.lon[i],
      capacity: data.cap[i],
      limited: data.lim[i] === 1,
      distanceMeters: Math.round(d),
    });
    best.sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id));
    if (best.length > n) best.pop();
  }
  return best;
}
