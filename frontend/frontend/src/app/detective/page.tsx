"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Provenance, fieldParams, hasField, useFieldQuery } from "@/components/FieldPicker";
import { api, Candidate, MoversResponse, mjdToDate } from "@/lib/api";
import { fmtDec, fmtRA } from "@/lib/wcs";

export default function Movers() {
  const q = useFieldQuery();
  const [data, setData] = useState<MoversResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Candidate | null>(null);
<<<<<<< HEAD
  const [reload, setReload] = useState(0);
=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

  useEffect(() => {
    if (!hasField(q)) return;
    setLoading(true); setErr(null); setData(null); setSel(null);
    api.movers(q).then((d) => { setData(d); setSel(d.candidates[0] ?? null); })
      .catch((e) => setErr(String(e.message ?? e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
<<<<<<< HEAD
  }, [q.ra, q.dec, q.target, q.synthetic, reload]);
=======
  }, [q.ra, q.dec, q.target, q.synthetic]);
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

  const spectrumHref = (c: Candidate) => `/spectrum?${fieldParams(q, {
    ra_src: String(c.detections[0].ra), dec_src: String(c.detections[0].dec),
    track: JSON.stringify(c.detections.map((d) => ({ epoch_index: d.epoch_index, ra: d.ra, dec: d.dec }))),
  })}`;

  if (!hasField(q)) return (
    <div className="py-6 max-w-[70ch]">
      <h1>Things that moved</h1>
      <p className="lede mt-3">Choose a field first. Each visit is searched for point sources; anything that appears in one visit and not the others is linked into a track and checked against JPL’s list of known asteroids, comets and trans-Neptunian objects.</p>
      <p className="small mt-3"><Link className="link" href="/">Pick a field on the viewer</Link></p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1>Things that moved</h1>
        {data && <span className="small num">{fmtRA(data.ra)} {fmtDec(data.dec)}</span>}
        {data && <Provenance source={data.source} warnings={data.warnings} compact />}
        {data && <a className="btn ml-auto" href={api.reportUrl(q)}>Download the candidate list (CSV)</a>}
      </div>
<<<<<<< HEAD
      <p className="small measure">Each visit is searched at five times the noise. A source with no counterpart in any other visit is a transient; transients are linked into a track when the motion between them is physically plausible. Every track is then compared with JPL’s predicted positions of catalogued bodies. A track that matches is <em>known</em>; one that does not is <em>unmatched</em>, which usually means an artefact or an ephemeris mismatch and is never, on its own, a discovery.</p>

      {loading && <p className="small" role="status">Extracting sources from every visit, linking tracks and asking JPL what should be there…</p>}
      {err && (
        <div className="callout max-w-2xl" role="alert">
          <p>The search for moving objects did not finish</p>
          <p className="small mt-1">{err}</p>
          <button className="btn btn-primary mt-3" onClick={() => setReload((r) => r + 1)}>Try again</button>
        </div>
      )}

      {data && (
        <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
=======
      <p className="small measure">Each visit is searched at five times the noise. A source with no counterpart in any other visit is a transient; transients are linked into a track when the motion between them is physically plausible. Every track is then compared with JPL’s predicted positions of catalogued bodies. A track that matches is <em>known</em>; one that does not is <em>unmatched</em> — which usually means an artefact or an ephemeris mismatch, and never, on its own, a discovery.</p>

      {loading && <p className="small">Extracting sources from every visit, linking tracks and asking JPL what should be there…</p>}
      {err && <p className="small warn-text">{err}</p>}

      {data && (
        <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
          <div className="panel p-2">
            <div className="flex items-baseline justify-between px-1 pb-1">
              <h3>{data.candidates.length} track{data.candidates.length === 1 ? "" : "s"}</h3>
              <span className="note">{String((data.diagnostics as Record<string, unknown>).n_transient_detections ?? 0)} transient detections over {String((data.diagnostics as Record<string, unknown>).n_epochs)} visits</span>
            </div>
            {data.candidates.length === 0 && (
              <p className="small p-2">Nothing moved above the threshold here. Fields near the ecliptic and close to opposition have the most asteroids; fields with more visits give longer tracks.</p>
            )}
            <ul className="flex flex-col">
              {data.candidates.map((c) => (
                <li key={c.id} className="rule first:border-0">
                  <button onClick={() => setSel(c)} className={`w-full text-left px-2 py-2 rounded-sm ${sel?.id === c.id ? "bg-[var(--panel-2)]" : "hover:bg-[var(--panel-2)]"}`}>
                    <div className="flex items-center gap-2">
                      <span>{c.status === "known" && c.match && "name" in c.match ? String(c.match.name) : c.id}</span>
                      <span className={`mark ${c.status === "known" ? "mark-known" : "mark-unmatched"}`}>{c.status}</span>
                      <span className="note ml-auto num">score {c.score.toFixed(2)}</span>
                    </div>
                    <div className="note num">{c.detections.length} visits · {c.total_motion_arcsec.toFixed(0)}″ · {c.rate_arcsec_per_day ? `${c.rate_arcsec_per_day.toFixed(2)}″ per day` : "no rate"} · PA {c.pa_deg?.toFixed(0)}°</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            {sel ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2>{sel.status === "known" && sel.match && "name" in sel.match ? String(sel.match.name) : sel.id}</h2>
                  <span className={`mark ${sel.status === "known" ? "mark-known" : "mark-unmatched"}`}>{sel.status}</span>
<<<<<<< HEAD
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Link className="btn" href={`/?${fieldParams(q, { overlay: "movers", mode: "blink", a: String(sel.detections[0].epoch_index), b: String(sel.detections[sel.detections.length - 1].epoch_index) })}`}>Show in the viewer</Link>
=======
                  <div className="ml-auto flex gap-2">
                    <Link className="btn" href={`/?${fieldParams(q)}`}>Show in the viewer</Link>
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
                    <Link className="btn btn-primary" href={spectrumHref(sel)}>Build its spectrum</Link>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  {sel.thumbnails.map((t, k) => (
                    <figure key={k}>
                      <img className="pix h-28 w-28 rounded-sm border border-[var(--rule)]" src={`data:image/png;base64,${t.png}`} alt={`Visit ${t.epoch_index}`} />
                      <figcaption className="note num mt-1">{mjdToDate(sel.detections[k]?.mjd ?? null)} · visit {t.epoch_index}</figcaption>
                    </figure>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="mb-1">Why it was flagged</h3>
                    <ul className="small list-disc pl-5">{sel.reasons.map((r, k) => <li key={k}>{r}</li>)}</ul>
                    {sel.distance_hint?.d_au_if_parallax_only && (
                      <p className="note mt-2">If all of this motion were Earth’s own parallax, the object would sit near {sel.distance_hint.d_au_if_parallax_only} AU. Real objects also move along their orbits, so treat this as a rough scale, not a distance.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1">Identification</h3>
                    {sel.match && "name" in sel.match ? (
                      <dl className="kv">
                        <dt>JPL object</dt><dd>{String(sel.match.name)}</dd>
                        <dt>Visits matched</dt><dd className="num">{String(sel.match.epochs_matched)}</dd>
                        <dt>Mean offset</dt><dd className="num">{String(sel.match.mean_sep_arcsec)}″</dd>
                        <dt>Predicted V</dt><dd className="num">{String(sel.match.vmag ?? "—")}</dd>
                      </dl>
                    ) : sel.match && "ambiguous" in sel.match ? (
                      <p className="small">More than one catalogued object fits: {(sel.match.ambiguous as string[]).join(", ")}.</p>
                    ) : <p className="small">No catalogued body at these positions and times{data.source === "synthetic" ? " (JPL is not consulted for the synthetic sample)" : ""}.</p>}
                  </div>
                </div>

<<<<<<< HEAD
                <div className="scroll-x"><table className="data">
=======
                <table className="data">
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
                  <thead><tr><th>Visit</th><th>MJD</th><th>RA</th><th>Dec</th><th>SNR</th><th>Pixel flags</th></tr></thead>
                  <tbody>
                    {sel.detections.map((d, k) => (
                      <tr key={k} className="num"><td>{d.epoch_index}</td><td>{d.mjd?.toFixed(3)}</td><td>{d.ra.toFixed(5)}°</td><td>{d.dec.toFixed(5)}°</td><td>{d.snr.toFixed(1)}</td><td>{d.flagged ? <span className="warn-text">flagged</span> : "clean"}</td></tr>
                    ))}
                  </tbody>
<<<<<<< HEAD
                </table></div>
=======
                </table>
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
                <p className="note">{data.disclaimer}</p>
              </div>
            ) : <p className="small">Select a track to see its evidence.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
