import { nearestShelters } from "@/lib/data/shelters";
import type { Shelter } from "@/lib/ai/schemas";

// GET /api/shelters?lat=57.7&lon=11.97&n=3 returnerar de närmaste skyddsrummen. Ingen AI.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const n = Math.min(10, Math.max(1, Number(searchParams.get("n") ?? 3) || 3));

  if (
    searchParams.get("lat") === null ||
    searchParams.get("lon") === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return Response.json({ error: "lat och lon krävs och måste vara giltiga koordinater" }, { status: 400 });
  }

  const shelters: Shelter[] = nearestShelters(lat, lon, n);
  return Response.json(
    { shelters, notice: "Kontrollera skyltning på plats. Data från MCF." },
    { headers: { "cache-control": "public, max-age=86400" } },
  );
}
