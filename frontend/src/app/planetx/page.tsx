"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, TNO } from "@/lib/api";
import { hasField, useFieldQuery } from "@/components/FieldPicker";
import { P9_CITATION, P9_REFERENCE } from "@/lib/orbits";

const OrbitScene3D = dynamic(() => import("@/components/OrbitScene3D"), { ssr: false, loading: () => <div className="h-full grid place-items-center note">Loading the 3D view…</div> });

// Approximate published elements, used only when JPL SBDB cannot be reached.
const FALLBACK: TNO[] = [
  { name: "90377 Sedna", a: 506, e: 0.85, i: 11.9, om: 144.4, w: 311.3, q: 76.2, ad: 937, per_y: 11400, H: 1.5 },
  { name: "2012 VP113", a: 262, e: 0.69, i: 24.1, om: 90.8, w: 293.8, q: 80.5, ad: 444, per_y: 4270, H: 4.0 },
  { name: "2004 VN112", a: 327, e: 0.85, i: 25.6, om: 66.0, w: 327.1, q: 47.3, ad: 606, per_y: 5900, H: 6.4 },
  { name: "2010 GB174", a: 351, e: 0.86, i: 21.5, om: 130.7, w: 347.8, q: 48.6, ad: 653, per_y: 6600, H: 6.5 },
  { name: "2007 TG422", a: 502, e: 0.93, i: 18.6, om: 112.9, w: 285.7, q: 35.6, ad: 968, per_y: 11200, H: 6.5 },
  { name: "2013 RF98", a: 350, e: 0.90, i: 29.6, om: 67.6, w: 311.8, q: 36.1, ad: 664, per_y: 6500, H: 8.6 },
];

const d2r = Math.PI / 180;
function project(t: TNO, nu: number) {
  const w = t.w * d2r, i = t.i * d2r, om = t.om * d2r;
  const r = t.a * (1 - t.e * t.e) / (1 + t.e * Math.cos(nu));
  const xo = r * Math.cos(nu), yo = r * Math.sin(nu);
  const x1 = xo * Math.cos(w) - yo * Math.sin(w), y1 = (xo * Math.sin(w) + yo * Math.cos(w)) * Math.cos(i);
  return { x: x1 * Math.cos(om) - y1 * Math.sin(om), y: -(x1 * Math.sin(om) + y1 * Math.cos(om)) };
}
function orbitPath(t: TNO, n = 160) {
  return "M" + Array.from({ length: n + 1 }, (_, k) => { const p = project(t, (k / n) * 2 * Math.PI); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join("L");
}

export default function PlanetNine() {
  const q = useFieldQuery();
  const [tnos, setTnos] = useState<TNO[]>(FALLBACK);
  const [live, setLive] = useState<boolean | null>(null);
  const [aMin, setAMin] = useState(150);
  const [p, setP] = useState({ mass_earth: 7, albedo: 0.4, distance_au: 600 });
  const [bright, setBright] = useState<Record<string, unknown> | null>(null);
  const [inj, setInj] = useState<{ curve: { ab_mag: number; completeness: number }[]; depth_50pct_ab: number | null; is_synthetic: boolean; method: string } | null>(null);
  const [injBusy, setInjBusy] = useState(false);
  const [injErr, setInjErr] = useState<string | null>(null);
  const [flat, setFlat] = useState(false);          // the 2D drawing, by choice or because 3D is unavailable
  const [no3d, setNo3d] = useState(false);
  const [showP9, setShowP9] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let alive = true;
    api.tnos(aMin).then((r) => { if (!alive) return; if (r.objects.length) { setTnos(r.objects); setLive(true); } else { setTnos(FALLBACK); setLive(false); } })
      .catch(() => { if (alive) { setTnos(FALLBACK); setLive(false); } });
    return () => { alive = false; };
  }, [aMin]);
  // wait until the slider rests: one request per adjustment, not one per pixel of drag
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => { api.brightness(p).then((b) => { if (alive) setBright(b); }).catch(() => {}); }, 180);
    return () => { alive = false; window.clearTimeout(t); };
  }, [p]);

  const extreme = (t: TNO) => t.a > 250 && t.q > 30;
  const perihelia = useMemo(() => tnos.filter(extreme).map((t) => ({ name: t.name, ...project(t, 0) })), [tnos]);
  const R = 1000;
  const extremeList = useMemo(() => tnos.filter(extreme).sort((x, y) => y.a - x.a).slice(0, 14), [tnos]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>Planet Nine: the argument, and what SPHEREx can say about it</h1>
        <p className="lede mt-2">In 2016 Batygin and Brown noticed that the most distant known objects beyond Neptune reach their closest points to the Sun on the same side of the Solar System. A planet of five to ten Earth masses, several hundred AU out, would do that. No such planet has been seen. Optical surveys have already ruled out roughly three quarters of the places it could be, and the Rubin Observatory is expected to settle the matter. SPHEREx has not found it, and this site makes no such claim.</p>
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
        <section className="panel p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2>Orbits of the most distant known objects</h2>
            {live === null ? <span className="note">asking JPL…</span> : live ? <span className="mark mark-real">JPL SBDB, {tnos.length} objects</span> : <span className="mark mark-synthetic">JPL unreachable; approximate elements for six objects</span>}
          </div>
          <label className="small block mt-2">Show objects with semi-major axis above {aMin} AU<input type="range" min={30} max={400} step={10} value={aMin} onChange={(e) => setAMin(Number(e.target.value))} /></label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
            {!no3d && (
              <div className="seg" role="group" aria-label="Drawing">
                <button aria-pressed={!flat} onClick={() => setFlat(false)}>3D</button>
                <button aria-pressed={flat} onClick={() => setFlat(true)}>Flat, from above</button>
              </div>
            )}
            {!flat && !no3d && <label className="small flex items-center gap-1.5"><input type="checkbox" checked={showP9} onChange={(e) => setShowP9(e.target.checked)} />Show the hypothesised orbit</label>}
          </div>
          {flat || no3d ? (
          <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="w-full aspect-square mt-2 rounded-sm" style={{ background: "#0c1426" }} role="img" aria-label="Top-down view of distant trans-Neptunian orbits">
            {[250, 500, 750, 1000].map((r) => <g key={r}><circle r={r} fill="none" stroke="#22304c" /><text x={4} y={-r - 6} fill="#6e7a95" fontSize={30}>{r} AU</text></g>)}
            <circle r={30.1} fill="none" stroke="#a3aec6" strokeWidth={2.5} />
            {tnos.slice(0, 500).map((t, k) => <path key={k} d={orbitPath(t)} fill="none" stroke={extreme(t) ? "#efe7d3" : "#2f4166"} strokeWidth={extreme(t) ? 2.5 : 1.2} />)}
            {perihelia.map((pp, k) => <circle key={k} cx={pp.x} cy={pp.y} r={9} fill="#f2b544"><title>{pp.name}, perihelion</title></circle>)}
            <circle r={9} fill="#efe7d3" />
            <text x={-R + 24} y={R - 30} fill="#a3aec6" fontSize={32}>Neptune’s orbit in grey. Cream orbits: a &gt; 250 AU and q &gt; 30 AU. Amber dots: where each comes closest to the Sun.</text>
          </svg>
          ) : (
            <div className="w-full aspect-square mt-2"><OrbitScene3D tnos={tnos} selected={sel} showP9={showP9} date={today} onUnavailable={() => setNo3d(true)} /></div>
          )}
          {!flat && !no3d && (
            <p className="note mt-2">Drag to turn, scroll or pinch to zoom. Cream orbits have a &gt; 250 au and q &gt; 30 au; amber dots mark where each comes closest to the Sun. The planets’ orbits and today’s positions (the small cluster at the centre) come from JPL’s approximate planetary elements. {showP9 && <>The blue dashed curve is one model of the proposed planet’s orbit, the maximum-likelihood fit of {P9_CITATION}: a = {P9_REFERENCE.a} au, e = {P9_REFERENCE.e}, tilted {P9_REFERENCE.i}°. It is a hypothesis with wide uncertainty, not an observed orbit.</>}</p>
          )}
          {extremeList.length > 0 && (
            <div className="scroll-x mt-3">
              <table className="data">
                <thead><tr><th>Object</th><th>a, au</th><th>q, au</th><th>e</th><th>tilt</th></tr></thead>
                <tbody>
                  {extremeList.map((t) => (
                    <tr key={t.name} className="num">
                      <td><button className={`text-left underline-offset-2 hover:underline ${sel === t.name ? "text-[var(--accent)]" : ""}`} aria-pressed={sel === t.name} onClick={() => setSel(sel === t.name ? null : t.name)}>{t.name}</button></td>
                      <td>{t.a.toFixed(0)}</td><td>{t.q.toFixed(1)}</td><td>{t.e.toFixed(2)}</td><td>{t.i.toFixed(1)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!flat && !no3d && <p className="note mt-1">Choose an object to pick out its orbit in the 3D view.</p>}
            </div>
          )}
          <p className="small mt-2 measure">The amber points bunching on one side is the whole observation. In 3D, press “Edge-on” to see the second half of the argument: these orbits are also tilted the same way. The main counter-argument is that surveys have looked harder in some directions than others, which could create the same bunching by selection alone.</p>
        </section>

        <section className="panel p-4 flex flex-col gap-3">
          <h2>How bright would it be, and could SPHEREx reach it?</h2>
          <div className="grid grid-cols-3 gap-3">
            <label className="small">Mass, Earths <b className="block text-[var(--ink)] num">{p.mass_earth}</b><input type="range" min={2} max={20} step={0.5} value={p.mass_earth} onChange={(e) => setP({ ...p, mass_earth: Number(e.target.value) })} /></label>
            <label className="small">Albedo <b className="block text-[var(--ink)] num">{p.albedo}</b><input type="range" min={0.1} max={0.9} step={0.05} value={p.albedo} onChange={(e) => setP({ ...p, albedo: Number(e.target.value) })} /></label>
            <label className="small">Distance, AU <b className="block text-[var(--ink)] num">{p.distance_au}</b><input type="range" min={200} max={1200} step={20} value={p.distance_au} onChange={(e) => setP({ ...p, distance_au: Number(e.target.value) })} /></label>
          </div>
          {bright && (
            <dl className="kv">
              <dt>Visual magnitude</dt><dd className="num">{String(bright.V_mag)}</dd>
              <dt>Roughly, at 1.2 µm (AB)</dt><dd className="num">{String(bright.J_AB_approx)}</dd>
              <dt>SPHEREx reach per channel, approx.</dt><dd className="num">{String(bright.spherex_depth_ab_approx)} AB</dd>
              <dt>Margin</dt><dd className={`num ${Number(bright.margin_mag) > 0 ? "text-[var(--green)]" : "warn-text"}`}>{Number(bright.margin_mag) > 0 ? "+" : ""}{String(bright.margin_mag)} mag — {bright.detectable_in_single_exposure ? "within reach of a single image" : "too faint for a single image"}</dd>
              <dt>Yearly parallax motion</dt><dd className="num">{String(bright.annual_parallax_arcsec)}″, about {String(bright.parallax_in_spherex_pixels)} SPHEREx pixels</dd>
            </dl>
          )}
          <ul className="note list-disc pl-5">{((bright?.notes as string[]) ?? []).map((n, k) => <li key={k}>{n}</li>)}</ul>
          <p className="small measure">So the motion would be obvious — tens of pixels a year — but the planet itself is a few magnitudes fainter than SPHEREx records in one pass. SPHEREx’s real part in this story is characterising brown dwarfs and known distant objects, and checking the 3–5 µm bands where some atmosphere models predict extra glow.</p>
        </section>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2>What this particular field could have shown</h2>
          <button className="btn btn-primary" disabled={!hasField(q) || injBusy} onClick={() => { setInjErr(null); setInj(null); setInjBusy(true); api.injection(q).then(setInj).catch((e) => setInjErr(String(e.message ?? e))).finally(() => setInjBusy(false)); }}>
            {injBusy ? "Injecting and recovering…" : "Measure completeness on the current field"}
          </button>
          {!hasField(q) && <span className="small">Pick a field in the <Link className="link" href="/">viewer</Link> first.</span>}
        </div>
        <p className="small measure mt-1">Fake stars of known brightness are dropped into the real cutout and the same detector tries to find them again. The result is a completeness curve for this field, which is a more honest answer than a quoted survey depth.</p>
        {injErr && <p className="small warn-text">{injErr}</p>}
        {inj && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] mt-3">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inj.curve} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke="#22304c" />
                  <XAxis dataKey="ab_mag" tick={{ fill: "#a3aec6", fontSize: 12 }} label={{ value: "injected brightness (AB mag)", position: "bottom", fill: "#a3aec6", fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fill: "#a3aec6", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#172339", border: "1px solid #2a3a58", fontSize: 12, color: "#efe7d3" }} />
                  <Line type="linear" dataKey="completeness" stroke="#f2b544" strokeWidth={2} dot={{ fill: "#f2b544" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="small">
              <p>Half of the injected sources are recovered at <b className="num">{inj.depth_50pct_ab ?? "a depth outside the tested range"}</b>{inj.depth_50pct_ab ? " AB" : ""}.</p>
              {inj.is_synthetic && <p className="mt-2"><span className="mark mark-synthetic">measured on the synthetic sample</span></p>}
              <p className="note mt-2">{inj.method}.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
