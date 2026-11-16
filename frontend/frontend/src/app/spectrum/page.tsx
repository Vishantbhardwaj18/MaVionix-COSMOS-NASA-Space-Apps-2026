"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CartesianGrid, ErrorBar, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Provenance, hasField, useFieldQuery } from "@/components/FieldPicker";
import { api, SpectrumResponse } from "@/lib/api";

const BANDS = [[0.75, 1.09], [1.10, 1.62], [1.63, 2.41], [2.42, 3.82], [3.83, 4.41], [4.42, 5.00]];

const tidy = (v: string | null) => (v && Number.isFinite(Number(v)) ? String(Number(Number(v).toFixed(5))) : v ?? "");

export default function Spectrum() {
  const q = useFieldQuery();
  const sp = useSearchParams();
  const [raSrc, setRaSrc] = useState(tidy(sp.get("ra_src")));
  const [decSrc, setDecSrc] = useState(tidy(sp.get("dec_src")));
  const track = sp.get("track") ?? undefined;
  const [data, setData] = useState<SpectrumResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    if (!hasField(q) || !raSrc || !decSrc) return;
    setLoading(true); setErr(null);
    api.spectrum(q, Number(raSrc), Number(decSrc), track).then(setData).catch((e) => setErr(String(e.message ?? e))).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, [q.ra, q.dec, q.target, q.synthetic, track]);

  // Say plainly when the comparison means little: few points, or a poor fit even for the best shape.
  const chi = Object.values(data?.classification.chi2_reduced ?? {});
  const bestChi = chi.length ? Math.min(...chi) : null;
  const nGood = (data?.points ?? []).filter((p) => p.wavelength_um !== null && p.flux_jy > 0).length;
  const verdict = nGood < 6
    ? { fits: false, why: `Only ${nGood} usable point${nGood === 1 ? "" : "s"}, too few to tell shapes apart.` }
    : bestChi !== null && bestChi > 5
      ? { fits: false, why: `None of the shapes fits well (best reduced χ² ${bestChi.toFixed(1)}).` }
      : { fits: true, why: "" };

  const pts = (data?.points ?? []).filter((p) => p.wavelength_um !== null && p.flux_jy > 0).map((p) => ({
    x: p.wavelength_um as number, y: p.flux_jy * 1e3, err: p.flux_err_jy * 1e3, det: p.detector,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1>A spectrum from repeat visits</h1>
        {data && <Provenance source={data.source} warnings={data.warnings} compact />}
      </div>
      <p className="small measure">SPHEREx’s filters change wavelength across each detector, so the same patch of sky is recorded at a different colour on every visit. Measuring one source in every visit — or following a moving object along its track — builds a sparse spectrum from 0.75 to 5 microns out of plain images.</p>

      <div className="panel p-3 flex flex-col md:flex-row gap-2 md:items-end">
        <label className="small flex-1">Source RA (degrees)<input className="input" value={raSrc} onChange={(e) => setRaSrc(e.target.value)} /></label>
        <label className="small flex-1">Source Dec (degrees)<input className="input" value={decSrc} onChange={(e) => setDecSrc(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={run} disabled={!hasField(q) || !raSrc || !decSrc}>Measure in every visit</button>
      </div>
      {track && <p className="note">Following the moving object’s track: the aperture is placed at a different position in each visit.</p>}
      {!hasField(q) && <p className="small">Choose a field first — <Link className="link" href="/">open the viewer</Link>, or pick a track on the Movers page and it will bring you here with the positions filled in.</p>}
      {loading && <p className="small" role="status">Placing an aperture in each visit and summing the light…</p>}
      {err && <div className="callout max-w-2xl" role="alert"><p>The spectrum could not be measured</p><p className="small mt-1">{err}</p></div>}

      {data && (
        <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="panel p-3 h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                {BANDS.map(([lo, hi], i) => <ReferenceArea key={i} x1={lo} x2={hi} fill={i % 2 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)"} strokeOpacity={0} label={{ value: `D${i + 1}`, position: "insideTop", fill: "#6e7a95", fontSize: 11 }} />)}
                <CartesianGrid stroke="#22304c" />
                <XAxis type="number" dataKey="x" domain={[0.7, 5.05]} tick={{ fill: "#a3aec6", fontSize: 12 }} tickCount={10} label={{ value: "wavelength (µm)", position: "bottom", fill: "#a3aec6", fontSize: 12 }} />
                <YAxis type="number" dataKey="y" tick={{ fill: "#a3aec6", fontSize: 12 }} label={{ value: "flux density (mJy)", angle: -90, position: "insideLeft", fill: "#a3aec6", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#172339", border: "1px solid #2a3a58", fontSize: 12, color: "#efe7d3" }} formatter={(v, n) => [Number(v).toFixed(3), String(n)]} />
                <Scatter data={pts} fill="#f2b544">
                  <ErrorBar dataKey="err" width={4} strokeWidth={1} stroke="#a3aec6" direction="y" />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <aside className="panel p-3 flex flex-col gap-3">
            <div>
              <h3>Closest simple shape</h3>
              {data.classification.best ? (
                <>
                  {verdict.fits
                    ? <p className="mt-1">{data.classification.best}</p>
                    : <p className="mt-1 small">{verdict.why} The least bad is “{data.classification.best}”.</p>}
                  <table className="data mt-2"><tbody>
                    {Object.entries(data.classification.chi2_reduced ?? {}).sort((a, b) => a[1] - b[1]).map(([k, v]) => <tr key={k} className="num"><td>{k}</td><td className="text-right">χ²ᵣ {v.toFixed(2)}</td></tr>)}
                  </tbody></table>
                </>
              ) : <p className="small mt-1">{data.classification.note}</p>}
              <p className="note mt-2">These are analytic shapes, not a spectral library. They suggest a family, not a classification.</p>
            </div>
            <div>
              <h3>Measurements</h3>
              <div className="scroll-x"><table className="data mt-1">
                <thead><tr><th>µm</th><th>Det</th><th>mJy</th><th>AB</th><th>SNR</th></tr></thead>
                <tbody>{data.points.map((p, k) => <tr key={k} className="num"><td>{p.wavelength_um?.toFixed(2)}</td><td>{p.detector}</td><td>{(p.flux_jy * 1e3).toFixed(2)}</td><td>{p.ab_mag?.toFixed(2) ?? "—"}</td><td>{p.snr?.toFixed(1)}</td></tr>)}</tbody>
              </table></div>
              <p className="note mt-2">Aperture radius 2.5 px with a sky annulus; flux is the aperture sum times the pixel solid angle (6.15″)². Zodiacal model subtracted. No aperture correction, so treat values as relative.</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
