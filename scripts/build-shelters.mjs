// Bygger data/skyddsrum.min.json från MCF:s GeoPackage (SWEREF 99 TM -> WGS84).
// Källa: https://inspire.msb.se/nedladdning/filer/geopackage/Skyddsrum_EPSG3006.gpkg
// (GML-filerna i samma feed är tomma.)
// Kör: node scripts/build-shelters.mjs <sökväg till .gpkg>
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Användning: node scripts/build-shelters.mjs <Skyddsrum_EPSG3006.gpkg>");
  process.exit(1);
}

// Inverse Gauss-Krüger enligt Lantmäteriets formler, GRS80, SWEREF 99 TM.
const a = 6378137;
const f = 1 / 298.257222101;
const k0 = 0.9996;
const lon0 = (15 * Math.PI) / 180;
const FE = 500000;
const e2 = f * (2 - f);
const n = f / (2 - f);
const aRoof = (a / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64);
const d1 = n / 2 - (2 * n ** 2) / 3 + (37 * n ** 3) / 96 - n ** 4 / 360;
const d2 = n ** 2 / 48 + n ** 3 / 15 - (437 * n ** 4) / 1440;
const d3 = (17 * n ** 3) / 480 - (37 * n ** 4) / 840;
const d4 = (4397 * n ** 4) / 161280;
const A = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
const B = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
const C = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
const D = -(4279 * e2 ** 4) / 1260;

function toWgs84(easting, northing) {
  const xi = northing / (k0 * aRoof);
  const eta = (easting - FE) / (k0 * aRoof);
  const xiP =
    xi -
    d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) -
    d2 * Math.sin(4 * xi) * Math.cosh(4 * eta) -
    d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) -
    d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
  const etaP =
    eta -
    d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) -
    d2 * Math.cos(4 * xi) * Math.sinh(4 * eta) -
    d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) -
    d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
  const phiStar = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  const dLon = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
  const s = Math.sin(phiStar);
  const lat = phiStar + s * Math.cos(phiStar) * (A + B * s ** 2 + C * s ** 4 + D * s ** 6);
  return [(lat * 180) / Math.PI, ((lon0 + dLon) * 180) / Math.PI];
}

// GPKG-geometri: "GP"-header med valfri envelope, därefter WKB (här MULTIPOINT med en punkt).
function firstPoint(blob) {
  const buf = Buffer.from(blob);
  const flags = buf[3];
  const envBytes = [0, 32, 48, 48, 64][(flags >> 1) & 0b111];
  let o = 8 + envBytes;
  const le = buf[o] === 1;
  const type = le ? buf.readUInt32LE(o + 1) : buf.readUInt32BE(o + 1);
  if (type === 4) o += 9 + 5; // hoppa över multipoint-header + punktens header
  else if (type === 1) o += 5;
  else throw new Error(`Oväntad geometrityp ${type}`);
  const x = le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
  const y = le ? buf.readDoubleLE(o + 8) : buf.readDoubleBE(o + 8);
  return [x, y];
}

const db = new DatabaseSync(input, { readOnly: true });
const rows = db
  .prepare(
    "SELECT geom, name, numberofoccupants AS cap, status, additionallocationdescription AS fast FROM Skyddsrum ORDER BY id",
  )
  .all();

// Kolumnvis format: halverar filstorleken jämfört med en array av objekt.
const out = { source: "MCF", lat: [], lon: [], cap: [], lim: [], id: [], fast: [] };
const round5 = (v) => Math.round(v * 1e5) / 1e5; // ca 1 m precision

for (const r of rows) {
  if (!r.geom) continue;
  const [lat, lon] = toWgs84(...firstPoint(r.geom));
  out.lat.push(round5(lat));
  out.lon.push(round5(lon));
  out.cap.push(r.cap ?? 0);
  out.lim.push(r.status === 7 ? 1 : 0); // 7 = "Tillfällig begränsning"
  out.id.push(r.name ?? "");
  out.fast.push(r.fast ?? "");
}

const path = new URL("../data/skyddsrum.min.json", import.meta.url);
writeFileSync(path, JSON.stringify(out));
console.log(`${out.lat.length} skyddsrum -> data/skyddsrum.min.json`);
