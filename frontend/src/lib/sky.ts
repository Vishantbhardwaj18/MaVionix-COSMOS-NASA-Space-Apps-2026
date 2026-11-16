// Real-sky data for the background: Hipparcos/Yale stars + Milky Way isophotes
// (d3-celestial data, BSD-3, O. Frohn; stars from Hipparcos/Tycho). All J2000 equatorial.

export type SkyStar = { x: number; y: number; z: number; mag: number; rgb: [number, number, number]; css: string; cbin: number };
/** Colour bins used to batch the many faint stars into a few draw calls. */
export const COLOR_BIN_BV = [-0.1, 0.35, 0.7, 1.1, 1.6];
const binOf = (bv: number) => (bv < 0.15 ? 0 : bv < 0.5 ? 1 : bv < 0.9 ? 2 : bv < 1.3 ? 3 : 4);
export type MwPoly = { level: number; rings: number[][][] };

// Served from this site only (public/data/sky, built by scripts/fetch-sky-data.mjs). No third-party requests.
const LOCAL = "/data/sky/";

async function getJson(file: string, signal?: AbortSignal) {
  const r = await fetch(LOCAL + file, { signal });
  if (!r.ok) throw new Error("unavailable: " + file);
  return await r.json();
}

/** B-V colour index -> approximate sRGB via blackbody temperature (Ballesteros 2012). */
export function bvToRgb(bv: number): [number, number, number] {
  const b = Math.max(-0.4, Math.min(2.0, bv));
  const T = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const bl = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.max(0, Math.min(255, v));
  // stars look paler than their blackbody colour to the eye/camera: blend toward white
  const mixw = (v: number) => Math.round(c(v) * 0.72 + 255 * 0.28);
  return [mixw(r), mixw(g), mixw(bl)];
}

type FlatStars = { stars: (number | null)[] };

function star(lon: number, lat: number, mag: number, bv: number): SkyStar {
  const ra = (lon * Math.PI) / 180, dec = (lat * Math.PI) / 180;
  const rgb = bvToRgb(bv);
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec), mag, rgb, css: `${rgb[0]},${rgb[1]},${rgb[2]}`, cbin: binOf(bv) };
}

function parseFlat(json: FlatStars): SkyStar[] {
  const a = json.stars, out: SkyStar[] = [];
  for (let i = 0; i + 3 < a.length; i += 4) out.push(star(a[i] as number, a[i + 1] as number, a[i + 2] as number, a[i + 3] ?? 0.6));
  return out;
}

function parseStars(json: { features: { properties: { mag: string | number; bv?: string | number }; geometry: { coordinates: [number, number] } }[] }): SkyStar[] {
  const out: SkyStar[] = [];
  for (const f of json.features) {
    const mag = Number(f.properties.mag);
    const bvRaw = Number(f.properties.bv);
    const bv = Number.isFinite(bvRaw) && f.properties.bv !== "" ? bvRaw : 0.6;
    const [lon, lat] = f.geometry.coordinates; // lon = RA (deg, wrapped to -180..180), lat = Dec
    const ra = (lon * Math.PI) / 180, dec = (lat * Math.PI) / 180;
    const rgb = bvToRgb(bv);
    out.push({ x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec), mag, rgb, css: `${rgb[0]},${rgb[1]},${rgb[2]}`, cbin: binOf(bv) });
  }
  return out;
}

export async function loadStars(file: string, signal?: AbortSignal): Promise<SkyStar[]> {
  const j = await getJson(file, signal);
  return Array.isArray(j.stars) ? parseFlat(j) : parseStars(j);
}

export async function loadMilkyWay(signal?: AbortSignal): Promise<MwPoly[]> {
  const j = await getJson("mw.json", signal);
  const polys: MwPoly[] = [];
  j.features.forEach((f: { id?: string | number; geometry: { type: string; coordinates: number[][][][] } }, i: number) => {
    const level = Number(f.id) || i + 1;
    const mp = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates as unknown as number[][][]];
    for (const poly of mp) polys.push({ level, rings: poly });
  });
  return polys;
}

/** Offline fallback: statistically plausible stars (magnitude counts follow N ∝ 10^(0.5 m)), denser near the galactic plane. */
export function fallbackStars(rand: () => number, n = 3200): SkyStar[] {
  const out: SkyStar[] = [];
  // galactic north pole (J2000)
  const ngp = { x: -0.8676, y: -0.1981, z: 0.4560 };
  while (out.length < n) {
    const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const x = s * Math.cos(a), y = s * Math.sin(a);
    const sinb = x * ngp.x + y * ngp.y + z * ngp.z;
    if (rand() > 0.35 + 0.65 * Math.exp(-(sinb * sinb) / 0.05)) continue;
    const mag = 1.5 + 6 * Math.pow(rand(), 0.35); // few bright, many faint
    const bv = -0.1 + rand() * 1.7;
    const rgb = bvToRgb(bv);
    out.push({ x, y, z, mag, rgb, css: `${rgb[0]},${rgb[1]},${rgb[2]}`, cbin: binOf(bv) });
  }
  return out;
}

/** Constellation stick figures as polylines of [RA, Dec] in degrees (RA wrapped to -180..180). */
export async function loadConstellations(signal?: AbortSignal): Promise<[number, number][][]> {
  const j = await getJson("constellations.json", signal);
  return Array.isArray(j.lines) ? j.lines : [];
}

/** Unit vector for RA/Dec in degrees (J2000 equatorial). */
export function radecToVec(raDeg: number, decDeg: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180, dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}
