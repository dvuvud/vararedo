// Ingen AI. Två lägen mot Nominatim (OpenStreetMap):
//   GET /api/geocode?q=Storgatan 1, Uppsala  ->  { lat, lon }   (adress till position)
//   GET /api/geocode?lat=57.7&lon=11.97      ->  { address }    (position till adress, t.ex. för skyddsrum)
// 404 om inget hittas, 502 vid nätverksfel.
// Nominatim kräver en egen User-Agent och högst ett anrop per sekund, så anropen köas och svaren cachas.

type Hit = { lat: number; lon: number } | { address: string } | null;
const cache = new Map<string, Hit>();

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

// Kör anropen ett i taget med minst 1,1 s mellanrum, även när flera förfrågningar kommer samtidigt
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://nominatim.openstreetmap.org/${path}`);
  url.search = new URLSearchParams({ format: "jsonv2", ...params }).toString();
  const res = await fetch(url, {
    headers: { "user-agent": "Vararedo/0.1 (hackathon, krisberedskapsplan)", "accept-language": "sv" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

type ReverseResult = {
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
  };
};

// "Linnégatan 12, Göteborg": gata och nummer plus ort, det man behöver för att hitta dit
function formatAddress(r: ReverseResult): string | null {
  const a = r.address;
  if (!a) return null;
  const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(" ");
  const place = a.city ?? a.town ?? a.village ?? a.suburb;
  return [street, place].filter(Boolean).join(", ") || null;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim().replace(/\s+/g, " ").slice(0, 200) ?? "";
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const isReverse = params.has("lat") && params.has("lon");

  if (isReverse ? !Number.isFinite(lat) || !Number.isFinite(lon) : q.length < 3) {
    return Response.json({ error: "Adress eller position saknas" }, { status: 400 });
  }

  // 5 decimaler räcker (ca 1 m) och gör att samma skyddsrum alltid träffar cachen
  const key = isReverse ? `rev:${lat.toFixed(5)},${lon.toFixed(5)}` : `q:${q.toLowerCase()}`;
  if (!cache.has(key)) {
    try {
      const hit: Hit = await throttled(async () => {
        if (isReverse) {
          const r = await nominatim<ReverseResult>("reverse", { lat: String(lat), lon: String(lon), zoom: "18", addressdetails: "1" });
          const address = formatAddress(r);
          return address ? { address } : null;
        }
        const hits = await nominatim<{ lat: string; lon: string }[]>("search", { q, limit: "1", countrycodes: "se" });
        return hits[0] ? { lat: Number(hits[0].lat), lon: Number(hits[0].lon) } : null;
      });
      cache.set(key, hit);
    } catch (e) {
      // Nätverksfel cachas inte, så nästa försök kan lyckas
      console.error("[api/geocode]", e);
      return Response.json({ error: "Kunde inte slå upp adressen" }, { status: 502 });
    }
  }

  const hit = cache.get(key);
  return hit
    ? Response.json(hit, { headers: { "cache-control": "public, max-age=86400" } })
    : Response.json({ error: "Hittades inte" }, { status: 404 });
}
