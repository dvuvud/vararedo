// Ingen AI. Tre lägen mot Nominatim (OpenStreetMap):
//   GET /api/geocode?q=Storgatan 1, Uppsala  ->  { lat, lon }        (adress till position, första träffen)
//   GET /api/geocode?q=Linnégatan 12&suggest=5 -> { candidates: [{ label, lat, lon }] }
//                                                  (flera kandidater, användaren väljer. Postnummer fungerar i q)
//   ...&live=1  anropas medan användaren skriver. Kräver GEOAPIFY_API_KEY, annars svarar vi
//               { candidates: [], live: false } och klienten faller tillbaka på sökknappen.
//   GET /api/geocode?lat=57.7&lon=11.97      ->  { address }         (position till adress, t.ex. för skyddsrum)
// 404 om inget hittas, 502 vid nätverksfel.
// Med GEOAPIFY_API_KEY används Geoapify för kandidater (byggt för autocomplete). Utan nyckel, eller om Geoapify
// misslyckas på en explicit sökning, används Nominatim. Nominatim anropas aldrig medan man skriver (live=1):
// dess användarvillkor förbjuder autocomplete.
// Nominatim kräver en egen User-Agent och högst ett anrop per sekund, så anropen köas och svaren cachas.

export type Candidate = { label: string; lat: number; lon: number };
type Hit = { lat: number; lon: number } | { address: string } | { candidates: Candidate[] } | null;
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

type SearchResult = {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  name?: string;
  address?: ReverseResult["address"] & { postcode?: string; municipality?: string };
};

// "Linnégatan 12, 413 04 Göteborg" eller "413 01, Haga, Göteborg". Postnummer och ort gör dubbletter åtskiljbara.
function candidateLabel(r: SearchResult): string {
  const a = r.address;
  const place = a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.suburb;
  if (r.type === "postcode") {
    return [r.name ?? a?.postcode, a?.suburb && a.suburb !== place ? a.suburb : undefined, place].filter(Boolean).join(", ");
  }
  const street = [a?.road ?? a?.pedestrian, a?.house_number].filter(Boolean).join(" ");
  if (street) {
    const tail = [a?.postcode, place].filter(Boolean).join(" ");
    return [street, tail].filter(Boolean).join(", ");
  }
  // Ort, stadsdel eller liknande utan gata: de första delarna av namnet räcker
  return r.display_name.split(",").slice(0, 3).map((x) => x.trim()).join(", ");
}

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY?.trim();

type GeoapifyResult = {
  formatted?: string;
  lat: number;
  lon: number;
  result_type?: string;
};

// Företag och intressepunkter ("Specsavers Linnégatan, ...") ska inte visas som hemadresser
const GEOAPIFY_TYPES = new Set(["building", "street", "postcode", "suburb", "district", "locality", "city", "county"]);

async function geoapifyCandidates(q: string, n: number): Promise<Candidate[]> {
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  const isPostcode = /^\d{3} \d{2}$/.test(q);
  url.search = new URLSearchParams({
    // "413 01" ger inga träffar utan type=postcode, "41301" fungerar
    text: isPostcode ? q.replace(" ", "") : q,
    ...(isPostcode ? { type: "postcode" } : {}),
    filter: "countrycode:se",
    lang: "sv",
    limit: String(Math.min(10, n * 2)),
    format: "json",
    apiKey: GEOAPIFY_KEY ?? "",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const { results = [] } = (await res.json()) as { results?: GeoapifyResult[] };
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of results) {
    if (r.result_type && !GEOAPIFY_TYPES.has(r.result_type)) continue;
    const label = r.formatted?.replace(/,\s*(Sverige|Sweden)$/i, "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat: r.lat, lon: r.lon });
    if (out.length === n) break;
  }
  return out;
}

// "41301" och "413 01" ska båda fungera som postnummer
function normalizeQuery(q: string): string {
  return /^\d{3}\s?\d{2}$/.test(q) ? `${q.replace(/\s/g, "").slice(0, 3)} ${q.replace(/\s/g, "").slice(3)}` : q;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = normalizeQuery(params.get("q")?.trim().replace(/\s+/g, " ").slice(0, 200) ?? "");
  const suggest = Math.min(8, Math.max(0, Number(params.get("suggest") ?? 0) || 0));
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const isReverse = params.has("lat") && params.has("lon");
  const live = params.get("live") === "1";

  if (isReverse ? !Number.isFinite(lat) || !Number.isFinite(lon) : q.length < 3) {
    return Response.json({ error: "Adress eller position saknas" }, { status: 400 });
  }

  if (!isReverse && suggest > 0) {
    // Live-sökning medan man skriver är bara tillåten med Geoapify
    if (live && !GEOAPIFY_KEY) return Response.json({ candidates: [], live: false });
    if (GEOAPIFY_KEY) {
      const gKey = `g${suggest}:${q.toLowerCase()}`;
      try {
        if (!cache.has(gKey)) {
          const candidates = await geoapifyCandidates(q, suggest);
          cache.set(gKey, candidates.length > 0 ? { candidates } : null);
        }
        const hit = cache.get(gKey);
        return hit
          ? Response.json({ ...hit, live: true }, { headers: { "cache-control": "public, max-age=86400" } })
          : Response.json({ error: "Hittades inte" }, { status: 404 });
      } catch (e) {
        console.error("[api/geocode] geoapify", e);
        // Vid live-sökning ger vi upp tyst. Vid explicit sökning faller vi vidare till Nominatim nedan.
        if (live) return Response.json({ candidates: [], live: true });
      }
    }
  }

  // 5 decimaler räcker (ca 1 m) och gör att samma skyddsrum alltid träffar cachen
  const key = isReverse
    ? `rev:${lat.toFixed(5)},${lon.toFixed(5)}`
    : suggest > 0
      ? `s${suggest}:${q.toLowerCase()}`
      : `q:${q.toLowerCase()}`;
  if (!cache.has(key)) {
    try {
      const hit: Hit = await throttled(async () => {
        if (isReverse) {
          const r = await nominatim<ReverseResult>("reverse", { lat: String(lat), lon: String(lon), zoom: "18", addressdetails: "1" });
          const address = formatAddress(r);
          return address ? { address } : null;
        }
        if (suggest > 0) {
          // Hämta lite fler än vi visar, eftersom OSM ofta har samma adress flera gånger
          const hits = await nominatim<SearchResult[]>("search", {
            q,
            limit: String(Math.min(10, suggest * 2)),
            countrycodes: "se",
            addressdetails: "1",
          });
          const seen = new Set<string>();
          const candidates: Candidate[] = [];
          for (const h of hits) {
            const label = candidateLabel(h);
            if (!label || seen.has(label)) continue;
            seen.add(label);
            candidates.push({ label, lat: Number(h.lat), lon: Number(h.lon) });
            if (candidates.length === suggest) break;
          }
          return candidates.length > 0 ? { candidates } : null;
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
