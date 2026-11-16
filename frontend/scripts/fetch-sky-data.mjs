// Builds the compact night-sky files used by the page background.
// Source: d3-celestial 0.7.35 (BSD-3-Clause, Olaf Frohn): Hipparcos/Tycho stars and Milky Way outlines.
// The compact outputs are committed in public/data/sky, so this only needs re-running to regenerate them:
//   npm i --no-save d3-celestial@0.7.35 && npm run build:sky
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../node_modules/d3-celestial/data/", import.meta.url);
const OUT = new URL("../public/data/sky/", import.meta.url);
const r = (v, d) => Number(Number(v).toFixed(d));

try {
  await mkdir(OUT, { recursive: true });
  for (const f of ["stars.6.json", "stars.8.json"]) {
    const j = JSON.parse(await readFile(new URL(f, SRC), "utf8"));
    const flat = [];
    for (const s of j.features) {
      const bv = s.properties.bv === "" || s.properties.bv == null ? null : Number(s.properties.bv);
      flat.push(r(s.geometry.coordinates[0], 3), r(s.geometry.coordinates[1], 3), r(s.properties.mag, 2), Number.isFinite(bv) ? r(bv, 2) : null);
    }
    await writeFile(new URL(f, OUT), JSON.stringify({ format: "flat:lon,lat,mag,bv", n: j.features.length, stars: flat }));
    console.log("wrote", f, j.features.length, "stars");
  }
  const mw = JSON.parse(await readFile(new URL("mw.json", SRC), "utf8"));
  for (const f of mw.features) {
    const g = f.geometry;
    const fix = (ring) => ring.map(([a, b]) => [r(a, 2), r(b, 2)]);
    g.coordinates = g.type === "MultiPolygon" ? g.coordinates.map((p) => p.map(fix)) : g.coordinates.map(fix);
  }
  await writeFile(new URL("mw.json", OUT), JSON.stringify(mw));
  console.log("wrote mw.json");
  // constellation stick figures, as a flat list of polylines of [lon, lat]
  const con = JSON.parse(await readFile(new URL("constellations.lines.json", SRC), "utf8"));
  const lines = [];
  for (const f of con.features) for (const seg of f.geometry.coordinates) lines.push(seg.map(([a, b]) => [r(a, 2), r(b, 2)]));
  await writeFile(new URL("constellations.json", OUT), JSON.stringify({ format: "polylines:lon,lat", lines }));
  console.log("wrote constellations.json", lines.length, "polylines");
} catch (e) {
  console.error("Could not build sky data:", e.message, "\nInstall the source first: npm i --no-save d3-celestial@0.7.35");
  process.exit(1);
}
