"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
<<<<<<< HEAD
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Provenance, fieldParams, hasField, useFieldQuery } from "@/components/FieldPicker";
import dynamic from "next/dynamic";
import SkyCanvas, { buildGrey, Cursor, Marker, Stretch, ViewMode } from "@/components/SkyCanvas";
import type { GlobeField } from "@/components/SkyGlobe";
import { setSkyFocus } from "@/lib/skyScene";
import { api, Candidate, DiffResponse, EpochsResponse, Frame, mjdToDate, SpectrumResponse } from "@/lib/api";
import { decode16, fmtDec, fmtRA, pixelToWorld } from "@/lib/wcs";

// three.js is only downloaded when a 3D view is actually opened
const Surface3D = dynamic(() => import("@/components/Surface3D"), { ssr: false, loading: () => <div className="h-full grid place-items-center note">Loading the 3D view…</div> });
const SkyGlobe = dynamic(() => import("@/components/SkyGlobe"), { ssr: false, loading: () => <div className="h-full grid place-items-center note">Loading the sky globe…</div> });

const DEFAULT_STRETCH: Stretch = { black: 0.0, white: 0.6, a: 0.08, invert: false };

const MODES: ViewMode[] = ["step", "blink", "swipe", "diff", "movie", "surface"];
const MODE_LABEL: Record<ViewMode, string> = { step: "step", blink: "blink", swipe: "swipe", diff: "difference", movie: "timelapse", surface: "3D surface" };
type Pick = { x: number; y: number; ra: number; dec: number; res: SpectrumResponse | null; err: string | null };

export default function Viewer() {
  const q = useFieldQuery();
  const sp = useSearchParams();
  // The link carries the view (visits and mode) as well as the field, so a shared link opens on the same thing.
  const want = useRef({ a: Number(sp.get("a") ?? 0), b: Number(sp.get("b") ?? 1), mode: sp.get("mode") as ViewMode | null, overlay: sp.get("overlay") });
  const [copied, setCopied] = useState(false);
=======
import Link from "next/link";
import { Provenance, fieldParams, hasField, useFieldQuery } from "@/components/FieldPicker";
import SkyCanvas, { Cursor, Marker, Stretch, ViewMode } from "@/components/SkyCanvas";
import { api, Candidate, DiffResponse, EpochsResponse, Frame, mjdToDate } from "@/lib/api";
import { fmtDec, fmtRA } from "@/lib/wcs";

const DEFAULT_STRETCH: Stretch = { black: 0.0, white: 0.6, a: 0.08, invert: false };

export default function Viewer() {
  const q = useFieldQuery();
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  const [data, setData] = useState<EpochsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [mode, setMode] = useState<ViewMode>("step");
  const [showB, setShowB] = useState(false);
<<<<<<< HEAD
  // People who ask their system for less motion get a paused blink they can start themselves.
  const [playing, setPlaying] = useState(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
=======
  const [playing, setPlaying] = useState(true);
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  const [blinkMs, setBlinkMs] = useState(700);
  const [swipe, setSwipe] = useState(0.5);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [stretch, setStretch] = useState<Stretch>(DEFAULT_STRETCH);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [known, setKnown] = useState<Record<number, Marker[]>>({});
  const [showKnown, setShowKnown] = useState(false);
  const [knownNote, setKnownNote] = useState<string | null>(null);
  const [movers, setMovers] = useState<Candidate[] | null>(null);
  const [showMovers, setShowMovers] = useState(false);
  const [moversBusy, setMoversBusy] = useState(false);
  const startedAt = useRef(0);
<<<<<<< HEAD
  const [waited, setWaited] = useState(0);
  const [pick, setPick] = useState<Pick | null>(null);
  const [relief, setRelief] = useState(0.45);
  const [smooth, setSmooth] = useState(false);
  const [no3d, setNo3d] = useState(false);
  const [reload, setReload] = useState(0);
=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

  // load epochs
  useEffect(() => {
    if (!hasField(q)) return;
<<<<<<< HEAD
    setLoading(true); setErr(null); setData(null); setDiff(null); setMovers(null); setKnown({}); setShowMovers(false); setShowKnown(false); setPick(null);
    startedAt.current = Date.now();
    api.epochs(q).then((d) => {
      const last = d.frames.length - 1, w = want.current;
      const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= last;
      setSkyFocus({ ra: d.ra, dec: d.dec });        // the page background turns to this part of the sky
      setData(d); setA(ok(w.a) ? w.a : 0); setB(ok(w.b) ? w.b : Math.min(1, last));
      if (w.mode && MODES.includes(w.mode)) setMode(w.mode);
      if (w.overlay === "movers") {
        setMoversBusy(true);
        api.movers(q).then((r) => { setMovers(r.candidates); setShowMovers(true); }).catch(() => {}).finally(() => setMoversBusy(false));
      }
      want.current = { a: 0, b: 1, mode: null, overlay: null };   // only honour the link once
    })
      .catch((e) => setErr(String(e.message ?? e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.ra, q.dec, q.target, q.synthetic, reload]);

  // seconds counter while the archive is being asked
  useEffect(() => {
    if (!loading) return;
    setWaited(0);
    const t = window.setInterval(() => setWaited(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [loading]);

  // blink clock; in timelapse the same clock steps through every visit in date order
  const nFrames = data?.frames.length ?? 0;
  useEffect(() => {
    if (!playing) return;
    if (mode === "blink") { const t = window.setInterval(() => setShowB((s) => !s), blinkMs); return () => window.clearInterval(t); }
    if (mode === "movie" && nFrames > 1) { const t = window.setInterval(() => setA((v) => (v + 1) % nFrames), blinkMs); return () => window.clearInterval(t); }
  }, [mode, playing, blinkMs, nFrames]);
  useEffect(() => () => setSkyFocus(null), []);

  // click a spot: measure it in every visit
  const measure = (x: number, y: number) => {
    const f = data?.frames[a]; if (!f || x < 0 || y < 0 || x >= f.shape[1] || y >= f.shape[0]) return;
    const { ra, dec } = pixelToWorld(f.wcs, x, y);
    setPick({ x, y, ra, dec, res: null, err: null });
    api.spectrum(q, ra, dec).then((res) => setPick((p) => (p && p.x === x && p.y === y ? { ...p, res } : p)))
      .catch((e) => setPick((p) => (p && p.x === x && p.y === y ? { ...p, err: String(e.message ?? e) } : p)));
  };
=======
    setLoading(true); setErr(null); setData(null); setDiff(null); setMovers(null); setKnown({}); setShowMovers(false); setShowKnown(false);
    startedAt.current = Date.now();
    api.epochs(q).then((d) => { setData(d); setA(0); setB(Math.min(1, d.frames.length - 1)); })
      .catch((e) => setErr(String(e.message ?? e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.ra, q.dec, q.target, q.synthetic]);

  // blink clock
  useEffect(() => {
    if (mode !== "blink" || !playing) return;
    const t = window.setInterval(() => setShowB((s) => !s), blinkMs);
    return () => window.clearInterval(t);
  }, [mode, playing, blinkMs]);
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

  // difference image
  useEffect(() => {
    if (mode !== "diff" || !data) return;
    setDiff(null);
    api.diff(q, a, b).then(setDiff).catch((e) => setErr(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, a, b, data]);

  // known objects for the visible epoch
  useEffect(() => {
    if (!showKnown || !data) return;
    const idx = mode === "blink" && showB ? b : a;
    if (known[idx]) return;
    api.known(q, idx).then((r) => {
      setKnown((k) => ({ ...k, [idx]: r.objects.map((o) => ({ x: o.x, y: o.y, label: o.name, kind: "known" as const, epoch: idx })) }));
      setKnownNote(r.note ?? (r.objects.length ? null : "No catalogued small bodies predicted in this cutout at this time."));
    }).catch((e) => setKnownNote(`JPL lookup did not answer (${e.message}). Try again in a moment.`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKnown, a, b, showB, mode, data]);

  const loadMovers = () => {
    if (movers) { setShowMovers((s) => !s); return; }
    setMoversBusy(true);
    api.movers(q).then((r) => { setMovers(r.candidates); setShowMovers(true); }).catch((e) => setErr(String(e.message ?? e))).finally(() => setMoversBusy(false));
  };

  // keyboard
  const frames = data?.frames ?? [];
  const n = frames.length;
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (!n) return;
    if (e.key === "ArrowRight") setA((v) => (v + 1) % n);
    else if (e.key === "ArrowLeft") setA((v) => (v - 1 + n) % n);
    else if (e.key === "]") setB((v) => (v + 1) % n);
    else if (e.key === "[") setB((v) => (v - 1 + n) % n);
<<<<<<< HEAD
    else if (e.key === " ") { e.preventDefault(); if (mode === "blink" || mode === "movie") setPlaying((p) => !p); else setMode("blink"); }
    else if (e.key >= "1" && e.key <= "6") setMode(MODES[Number(e.key) - 1]);
=======
    else if (e.key === " ") { e.preventDefault(); if (mode === "blink") setPlaying((p) => !p); else setMode("blink"); }
    else if (e.key === "1") setMode("step"); else if (e.key === "2") setMode("blink"); else if (e.key === "3") setMode("swipe"); else if (e.key === "4") setMode("diff");
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
    else if (e.key.toLowerCase() === "i") setStretch((s) => ({ ...s, invert: !s.invert }));
  }, [n, mode]);
  useEffect(() => { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onKey]);

  const markers: Marker[] = useMemo(() => {
    const m: Marker[] = [];
    if (showKnown) Object.values(known).forEach((arr) => m.push(...arr));
<<<<<<< HEAD
    if (pick) m.push({ x: pick.x, y: pick.y, kind: "pick" });
=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
    if (showMovers && movers) {
      for (const c of movers) {
        c.detections.forEach((d) => m.push({ x: d.x, y: d.y, kind: "track", epoch: d.epoch_index }));
        c.detections.forEach((d) => m.push({ x: d.x, y: d.y, kind: "candidate", epoch: d.epoch_index, label: c.status === "known" && c.match && "name" in c.match ? String(c.match.name) : c.id }));
      }
    }
    return m;
<<<<<<< HEAD
  }, [showKnown, known, showMovers, movers, pick]);

  // keep the address bar in step with the view, without adding history entries
  useEffect(() => {
    if (!data) return;
    const u = new URL(window.location.href);
    u.searchParams.set("a", String(a)); u.searchParams.set("b", String(b)); u.searchParams.set("mode", mode);
    if (showMovers) u.searchParams.set("overlay", "movers"); else u.searchParams.delete("overlay");
    window.history.replaceState(window.history.state, "", u);
  }, [a, b, mode, data, showMovers]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy this link", window.location.href); }
  };
=======
  }, [showKnown, known, showMovers, movers]);
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

  const A = frames[a], B = frames[b];
  const visible = mode === "blink" && showB ? B : A;
  const sameBand = (x: number, y: number) => data?.same_band_pairs.some(([p, r]) => (p === x && r === y) || (p === y && r === x));

<<<<<<< HEAD
  const lut = useMemo(() => buildGrey(stretch), [stretch]);
  const surfaceData = useMemo(() => (mode === "surface" && A ? decode16(A.data16) : null), [mode, A]);
  const when = (f?: Frame) => f ? (f.date_iso?.slice(0, 10) ?? mjdToDate(f.mjd)) : "";
  const caption = data ? [
    data.source === "synthetic" ? "SYNTHETIC SAMPLE, NOT SPHEREx DATA" : "SPHEREx (NASA/JPL-Caltech/IPAC), via IRSA",
    `${fmtRA(data.ra)} ${fmtDec(data.dec)}`,
    mode === "diff" ? `difference ${when(B)} minus ${when(A)}` : mode === "swipe" ? `${when(A)} | ${when(B)}` : when(visible),
    "COSMOS viewer",
  ].join("   ") : "";

=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  if (!hasField(q)) return <Landing />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1>{data ? `${fmtRA(data.ra)}  ${fmtDec(data.dec)}` : "Looking up the field"}</h1>
        {data && <span className="small">{n} SPHEREx visit{n === 1 ? "" : "s"} · {frames.length && frames[0].mjd && frames[n - 1].mjd ? `${mjdToDate(frames[0].mjd)} to ${mjdToDate(frames[n - 1].mjd)}` : ""}</span>}
        {data && <Provenance source={data.source} warnings={data.warnings} />}
      </div>

<<<<<<< HEAD
      {loading && (
        <div className="panel p-4 max-w-2xl" role="status">
          <p>Finding every SPHEREx image of this position…</p>
          <p className="small mt-1">The archive is asked which images cover it, then a 10′ cutout of each is downloaded. A field seen for the first time usually takes 20 to 60 seconds. After that it is cached and opens at once.</p>
          <p className="note mt-2 num">{waited} s</p>
        </div>
      )}
      {err && !loading && (
        <div className="callout max-w-2xl" role="alert">
          <p>{data ? "That step did not work" : "This field could not be loaded"}</p>
          <p className="small mt-1">{err}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => { setErr(null); setReload((r) => r + 1); }}>Try again</button>
            {!data && !q.synthetic && <Link className="btn" href={`/?${fieldParams({ ...q, synthetic: true })}`}>Open the offline sample instead</Link>}
            {data && <button className="btn btn-quiet" onClick={() => setErr(null)}>Dismiss</button>}
          </div>
        </div>
      )}
      {data && n === 1 && <p className="small">Only one visit covers this position so far, so there is nothing to compare it with yet. The ecliptic poles have the most visits.</p>}

      {data && (
        <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_300px]">
=======
      {loading && <p className="small">Asking IRSA which spectral images cover this position, then fetching a 10′ cutout of each. The first visit to a field usually takes 20–60 seconds; after that it is cached.</p>}
      {err && <p className="small warn-text">{err}</p>}

      {data && (
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
          {/* Visits log */}
          <aside className="panel p-2 flex flex-col max-h-[78vh]">
            <div className="flex items-baseline justify-between px-1 pb-1">
              <h3>Visits</h3>
              <span className="note">A · B</span>
            </div>
            <ol className="overflow-y-auto flex-1 flex flex-col gap-0.5">
              {frames.map((f) => (
                <li key={f.index} className={`flex items-center gap-2 px-1 py-1 rounded-sm text-sm ${f.index === a || f.index === b ? "bg-[var(--panel-2)]" : ""}`}>
                  <img src={`data:image/png;base64,${f.png}`} alt="" className="pix w-8 h-8 rounded-sm border border-[var(--rule)]" />
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="num">{f.date_iso?.slice(0, 10) ?? mjdToDate(f.mjd)}</div>
                    <div className="note">D{f.detector ?? "?"} · {f.wavelength_um_at_centre ? `${f.wavelength_um_at_centre.toFixed(2)} µm` : "λ unknown"}</div>
                  </div>
                  <div className="flex gap-0.5">
                    <button className={`kbd ${f.index === a ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`} onClick={() => setA(f.index)} title="Set as A">A</button>
                    <button className={`kbd ${f.index === b ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`} onClick={() => setB(f.index)} title="Set as B">B</button>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          {/* Viewer */}
          <section className="panel flex flex-col min-h-[560px]">
            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-[var(--rule-soft)]">
              <div className="seg" role="group" aria-label="View mode">
<<<<<<< HEAD
                {MODES.map((m, i) => (
                  <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} title={`Key ${i + 1}`}>{MODE_LABEL[m]}</button>
                ))}
              </div>
              {(mode === "blink" || mode === "movie") && (
=======
                {(["step", "blink", "swipe", "diff"] as ViewMode[]).map((m, i) => (
                  <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} title={`Key ${i + 1}`}>{m === "diff" ? "difference" : m}</button>
                ))}
              </div>
              {mode === "blink" && (
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
                <>
                  <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
                  <label className="small flex items-center gap-2">speed<input type="range" min={150} max={1500} step={50} value={1650 - blinkMs} onChange={(e) => setBlinkMs(1650 - Number(e.target.value))} className="!w-24" /></label>
                </>
              )}
<<<<<<< HEAD
              {mode === "surface" && <label className="small flex items-center gap-2">height<input type="range" min={0.05} max={1} step={0.01} value={relief} onChange={(e) => setRelief(Number(e.target.value))} className="!w-28" /></label>}
              {mode === "swipe" && <input type="range" min={0} max={1} step={0.005} value={swipe} onChange={(e) => setSwipe(Number(e.target.value))} className="!w-40" aria-label="Swipe position" />}
              <button className="btn btn-quiet ml-auto" onClick={copyLink} title="Copy a link that opens this field, these two visits and this mode">{copied ? "Link copied" : "Copy link"}</button>
              <span className="small" aria-live="polite">
                {mode === "diff" ? "B minus A" : mode === "blink" ? (showB ? "showing B" : "showing A") : mode === "swipe" ? "A left, B right" : mode === "movie" ? `visit ${a + 1} of ${n}, ${when(A)}` : "showing A"}
              </span>
            </div>
            <div className="flex-1 min-h-[480px]">
              {mode === "surface" && !no3d ? (
                <div className="h-full min-h-[480px]"><Surface3D data={surfaceData} nx={A?.shape[1] ?? 1} ny={A?.shape[0] ?? 1} lut={lut} height={relief} onUnavailable={() => setNo3d(true)} /></div>
              ) : (
              <SkyCanvas frames={frames} a={a} b={b} mode={mode === "surface" ? "step" : mode} showB={showB} swipe={swipe} diff={mode === "diff" ? diff : null}
                stretch={stretch} markers={markers} showGrid={showGrid} smooth={smooth} onCursor={setCursor} onClick={measure}
                caption={caption} fileName={`cosmos_${data.ra.toFixed(3)}_${data.dec.toFixed(3)}_${mode}`}
                ariaLabel={`Infrared image of the sky at ${fmtRA(data.ra)} ${fmtDec(data.dec)}, ${mode} view`} />
              )}
=======
              {mode === "swipe" && <input type="range" min={0} max={1} step={0.005} value={swipe} onChange={(e) => setSwipe(Number(e.target.value))} className="!w-40" aria-label="Swipe position" />}
              <span className="ml-auto small">
                {mode === "diff" ? "B minus A" : mode === "blink" ? (showB ? "showing B" : "showing A") : mode === "swipe" ? "A left, B right" : "showing A"}
              </span>
            </div>
            <div className="flex-1 min-h-[480px]">
              <SkyCanvas frames={frames} a={a} b={b} mode={mode} showB={showB} swipe={swipe} diff={mode === "diff" ? diff : null}
                stretch={stretch} markers={markers} showGrid={showGrid} onCursor={setCursor} />
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
            </div>
            <div className="p-2 border-t border-[var(--rule-soft)] flex flex-wrap gap-x-4 gap-y-1 small">
              {mode === "diff" && diff && (
                <>
                  <span>Amber: brighter in B. Blue: brighter in A. A moving object shows as a blue–amber pair.</span>
                  {!sameBand(a, b) && <span className="warn-text">These two visits sample different wavelengths, so stars will leave colour residuals; use the difference only to spot things that moved.</span>}
                </>
              )}
              {mode === "diff" && !diff && <span>Reprojecting B onto A…</span>}
<<<<<<< HEAD
              {mode === "surface" && <span>{no3d ? "This browser cannot draw 3D, so the flat image is shown." : "Brightness is height. A star is a rounded peak as wide as the telescope’s blur; a single-pixel spike is usually a cosmic-ray hit. Drag to turn, scroll to zoom. The Display sliders change the stretch here too."}</span>}
              {mode === "movie" && <span>Every visit in date order. Each one recorded a different wavelength, so stars change brightness from frame to frame; watch for things that change position.</span>}
              {mode !== "diff" && mode !== "surface" && mode !== "movie" && <span>Click a star to measure it in every visit. Scroll or pinch to zoom, drag to pan, double-click to fit. Keys: <span className="kbd">←</span><span className="kbd">→</span> change A, <span className="kbd">[</span><span className="kbd">]</span> change B, <span className="kbd">space</span> blink, <span className="kbd">1</span>–<span className="kbd">6</span> modes, <span className="kbd">i</span> invert.</span>}
=======
              {mode !== "diff" && <span>Scroll to zoom, drag to pan, double-click to fit. Keys: <span className="kbd">←</span><span className="kbd">→</span> change A, <span className="kbd">[</span><span className="kbd">]</span> change B, <span className="kbd">space</span> blink, <span className="kbd">i</span> invert.</span>}
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
            </div>
          </section>

          {/* Inspector */}
          <aside className="flex flex-col gap-3">
            <div className="panel p-3">
              <h3 className="mb-1">Under the cursor</h3>
              {cursor ? (
                <dl className="kv">
                  <dt>RA</dt><dd className="num">{fmtRA(cursor.ra)}</dd>
                  <dt>Dec</dt><dd className="num">{fmtDec(cursor.dec)}</dd>
                  <dt>Pixel</dt><dd className="num">{cursor.x}, {cursor.y}</dd>
                  <dt>Surface brightness</dt><dd className="num">{cursor.value.toFixed(4)} MJy/sr</dd>
                  <dt>Wavelength here</dt><dd className="num">{cursor.lambda ? `${cursor.lambda.toFixed(3)} µm` : "not in cutout"}</dd>
                </dl>
              ) : <p className="note">Move over the image to read position, brightness and the wavelength this pixel recorded.</p>}
            </div>

<<<<<<< HEAD
            {pick && (
              <div className="panel p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3>This spot in every visit</h3>
                  <button className="btn btn-quiet !py-0" onClick={() => setPick(null)} aria-label="Clear the measurement">Clear</button>
                </div>
                <p className="note num">{fmtRA(pick.ra)} {fmtDec(pick.dec)}</p>
                {pick.err && <p className="small warn-text mt-1">{pick.err}</p>}
                {!pick.res && !pick.err && <p className="small mt-1" role="status">Measuring…</p>}
                {pick.res && pick.res.points.length === 0 && <p className="small mt-1">This spot is too close to the edge of the cutout to measure: the sky ring round the aperture would fall outside the image. Choose something at least 8 pixels in from the edge.</p>}
                {pick.res && pick.res.points.length > 0 && (
                  <>
                    <div className="scroll-x mt-1"><table className="data">
                      <thead><tr><th>Date</th><th>µm</th><th>mJy</th><th>SNR</th></tr></thead>
                      <tbody>{[...pick.res.points].sort((x, y) => (x.mjd ?? 0) - (y.mjd ?? 0)).map((p, k) => (
                        <tr key={k} className="num"><td>{mjdToDate(p.mjd)}</td><td>{p.wavelength_um?.toFixed(2) ?? "—"}</td><td>{(p.flux_jy * 1e3).toFixed(2)}</td><td>{p.snr?.toFixed(1) ?? "—"}</td></tr>
                      ))}</tbody>
                    </table></div>
                    <p className="note mt-2">Each visit recorded a different wavelength, so a change here can be colour as much as time. Compare rows with similar µm before calling anything variable.</p>
                    <Link className="link small" href={`/spectrum?${fieldParams(q, { ra_src: pick.ra.toFixed(5), dec_src: pick.dec.toFixed(5) })}`}>Plot these as a spectrum</Link>
                  </>
                )}
              </div>
            )}

=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
            <div className="panel p-3">
              <h3 className="mb-1">Visit {visible === A ? "A" : "B"}</h3>
              {visible && <EpochDetails f={visible} />}
            </div>

            <div className="panel p-3 flex flex-col gap-2">
              <h3>Display</h3>
              <label className="small">Black point<input type="range" min={0} max={0.5} step={0.005} value={stretch.black} onChange={(e) => setStretch({ ...stretch, black: Number(e.target.value) })} /></label>
              <label className="small">White point<input type="range" min={0.05} max={1} step={0.005} value={stretch.white} onChange={(e) => setStretch({ ...stretch, white: Number(e.target.value) })} /></label>
              <label className="small">Contrast (asinh)<input type="range" min={0.01} max={1} step={0.01} value={stretch.a} onChange={(e) => setStretch({ ...stretch, a: Number(e.target.value) })} /></label>
<<<<<<< HEAD
              <div className="flex flex-wrap gap-x-3 gap-y-1 small">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={stretch.invert} onChange={(e) => setStretch({ ...stretch, invert: e.target.checked })} />invert</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />scale ticks</label>
                <label className="flex items-center gap-1.5" title="Blend neighbouring pixels. Easier on the eye, but the squares are the real measurements."><input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />smooth</label>
=======
              <div className="flex gap-3 small">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={stretch.invert} onChange={(e) => setStretch({ ...stretch, invert: e.target.checked })} />invert</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />scale ticks</label>
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
                <button className="btn btn-quiet ml-auto" onClick={() => setStretch(DEFAULT_STRETCH)}>Reset</button>
              </div>
            </div>

            <div className="panel p-3 flex flex-col gap-2">
              <h3>Overlays</h3>
              <label className="flex items-center gap-2 small"><input type="checkbox" checked={showKnown} onChange={(e) => setShowKnown(e.target.checked)} />Catalogued asteroids and TNOs predicted here (JPL)</label>
              {showKnown && knownNote && <p className="note">{knownNote}</p>}
              <label className="flex items-center gap-2 small">
                <input type="checkbox" checked={showMovers || moversBusy} disabled={moversBusy} onChange={loadMovers} />
                {moversBusy ? "Searching for things that moved…" : "Things that moved between visits"}
              </label>
              {showMovers && movers && (
                <p className="note">{movers.length ? `${movers.length} track${movers.length === 1 ? "" : "s"} found.` : "Nothing moved above the detection threshold."} <Link className="link" href={`/detective?${fieldParams(q)}`}>Open the evidence</Link></p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function EpochDetails({ f }: { f: Frame }) {
  return (
    <dl className="kv">
      <dt>Date</dt><dd className="num">{f.date_iso?.slice(0, 19).replace("T", " ") ?? mjdToDate(f.mjd)} UTC</dd>
      <dt>MJD</dt><dd className="num">{f.mjd?.toFixed(4) ?? "—"}</dd>
      <dt>Detector</dt><dd>{f.detector ?? "—"}{f.band_lo_um ? ` (${f.band_lo_um.toFixed(2)}–${f.band_hi_um?.toFixed(2)} µm)` : ""}</dd>
      <dt>λ at centre</dt><dd className="num">{f.wavelength_um_at_centre ? `${f.wavelength_um_at_centre.toFixed(3)} µm` : "—"}{f.wavelength_source === "band-range-only" && <span className="note"> (band centre; table absent)</span>}</dd>
      <dt>Release</dt><dd>{f.collection}</dd>
      <dt>Image</dt><dd className="num break-all">{f.obs_id}</dd>
      <dt>Noise</dt><dd className="num">{f.noise_sigma.toExponential(2)} MJy/sr</dd>
      {f.notes.length > 0 && <><dt>Notes</dt><dd className="note">{f.notes.join("; ")}</dd></>}
    </dl>
  );
}

function Landing() {
  const [last, setLast] = useState<{ ra?: number; dec?: number; target?: string } | null>(null);
  const [preview, setPreview] = useState<EpochsResponse | null>(null);
  const [showB, setShowB] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem("cosmos:last-field"); if (v) setLast(JSON.parse(v)); } catch { /* ignore */ } }, []);
<<<<<<< HEAD
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  useEffect(() => { api.epochs({ ra: 270, dec: 66.56 }).then(setPreview).catch((e) => setPreviewErr(String(e.message ?? e))); }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setShowB((s) => !s), 800); return () => window.clearInterval(t);
  }, []);
=======
  useEffect(() => { api.epochs({ ra: 270, dec: 66.56 }).then(setPreview).catch(() => {}); }, []);
  useEffect(() => { const t = window.setInterval(() => setShowB((s) => !s), 800); return () => window.clearInterval(t); }, []);
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  const fields = [
    { label: "North Ecliptic Pole", sub: "SPHEREx deep field, visited on most orbits", ra: 270, dec: 66.56 },
    { label: "South Ecliptic Pole", sub: "the other deep field", ra: 90, dec: -66.56 },
    { label: "Ecliptic, near opposition", sub: "main-belt asteroids move visibly", ra: 45, dec: 15 },
    { label: "Galactic anticentre", sub: "a quiet star field", ra: 86, dec: 28.9 },
  ];
  const pf = preview?.frames ?? [];
  const pb = pf.length > 1 ? 1 : 0;
<<<<<<< HEAD
  const [spot, setSpot] = useState<{ ra: number; dec: number } | null>(null);
  const [noGlobe, setNoGlobe] = useState(false);
  const globeFields: GlobeField[] = [
    { label: "north ecliptic pole", ra: 270, dec: 66.56 }, { label: "south ecliptic pole", ra: 90, dec: -66.56 },
    { label: "ecliptic field", ra: 45, dec: 15 }, { label: "anticentre", ra: 86, dec: 28.9 },
  ];
  return (
    <div className="flex flex-col gap-10 py-4">
    <div className="grid lg:grid-cols-[minmax(0,46ch)_minmax(0,1fr)] gap-x-12 gap-y-8 items-start">
=======
  return (
    <div className="grid lg:grid-cols-[minmax(0,46ch)_minmax(0,1fr)] gap-x-12 gap-y-8 py-4 items-start">
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-4xl leading-tight">The infrared sky, one visit at a time.</h1>
          <p className="lede mt-4">Since 2025 NASA’s SPHEREx has been photographing the whole sky every six months in 102 infrared colours. Put in a position and this viewer fetches every SPHEREx image of it from the archive, so you can flick between visits and see what moved, brightened or vanished.</p>
<<<<<<< HEAD
          <p className="small mt-4">Asteroids and comets shift between visits. Distant trans-Neptunian objects creep. Variable stars pulse. A planet far beyond Neptune, if one exists, would drift too, although the Planet Nine page shows why it would be fainter than SPHEREx can reach.</p>
=======
          <p className="small mt-4">Asteroids and comets shift between visits. Distant trans-Neptunian objects creep. Variable stars pulse. A planet far beyond Neptune, if one exists, would drift too — though, as the Planet Nine page shows, it would be fainter than SPHEREx can reach.</p>
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
        </div>
        <div className="panel p-4">
          <h3>Start with a field that has many visits</h3>
          <ul className="mt-2 flex flex-col">
            {fields.map((f) => (
              <li key={f.label} className="rule first:border-0">
                <Link href={`/?ra=${f.ra}&dec=${f.dec}`} className="block py-2.5 hover:text-[var(--accent)]">
                  <span>{f.label}</span>
                  <span className="block note">{f.sub} · {f.ra}°, {f.dec}°</span>
                </Link>
              </li>
            ))}
          </ul>
          {last && hasField(last) && <p className="note mt-3">Last time you were looking at <Link className="link" href={`/?${fieldParams(last)}`}>{last.target ?? `${last.ra}, ${last.dec}`}</Link>.</p>}
        </div>
      </div>
      <div className="panel overflow-hidden">
<<<<<<< HEAD
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 border-b border-[var(--rule-soft)]">
=======
        <div className="flex items-baseline gap-3 px-3 py-2 border-b border-[var(--rule-soft)]">
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
          <h3>North Ecliptic Pole, two visits, blinking</h3>
          {preview && <span className="note num">{pf[0]?.date_iso?.slice(0, 10) ?? mjdToDate(pf[0]?.mjd ?? null)} and {pf[pb]?.date_iso?.slice(0, 10) ?? mjdToDate(pf[pb]?.mjd ?? null)}</span>}
          {preview && <span className="ml-auto"><Provenance source={preview.source} compact /></span>}
        </div>
        <div className="aspect-square w-full">
          {preview && pf.length ? (
<<<<<<< HEAD
            <SkyCanvas frames={pf} a={0} b={pb} mode="blink" showB={showB} swipe={0.5} diff={null} stretch={DEFAULT_STRETCH} markers={[]} showGrid={false} onCursor={() => {}} controls={false} ariaLabel="Two visits of the North Ecliptic Pole field, alternating" />
          ) : previewErr ? (
            <div className="h-full grid place-items-center p-6 text-center"><p className="small max-w-sm">The preview could not be loaded: {previewErr} You can still search for a field above.</p></div>
          ) : <div className="h-full grid place-items-center note" role="status">Fetching the deep field from the archive…</div>}
        </div>
        <div className="px-3 py-2 flex items-center gap-3 border-t border-[var(--rule-soft)]">
          <span className="small">Anything that jumps between the two frames moved.</span>
          <Link className="btn btn-primary ml-auto whitespace-nowrap" href="/?ra=270&dec=66.56">Open this field</Link>
        </div>
      </div>
    </div>

    {!noGlobe && (
      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44ch)] gap-x-12 gap-y-4 items-center">
        <div className="aspect-square w-full max-w-[640px] mx-auto"><SkyGlobe fields={globeFields} picked={spot} onPick={(ra, dec) => setSpot({ ra, dec })} onUnavailable={() => setNoGlobe(true)} /></div>
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl">Or pick a spot on the sky</h2>
          <p className="small">This is the whole sky as a globe, with the real bright stars and constellations. Drag to turn it and click where you want to look. Like any star globe it is seen from outside, so the patterns are mirror images of what you see overhead.</p>
          <p className="small">The amber line is the ecliptic, the plane of the planets, where most asteroids are found. SPHEREx circles the Earth from pole to pole and passes over the two ecliptic poles on every orbit. The small circles there mark its deep fields, which is why those positions have by far the most visits.</p>
          <div className="panel p-3 flex flex-wrap items-center gap-3" aria-live="polite">
            {spot ? (
              <>
                <span className="num">{fmtRA(spot.ra)} {fmtDec(spot.dec)}</span>
                <span className="note num">RA {spot.ra}°, Dec {spot.dec}°</span>
                <Link className="btn btn-primary ml-auto whitespace-nowrap" href={`/?ra=${spot.ra}&dec=${spot.dec}`}>Look here</Link>
              </>
            ) : <span className="small">Nothing chosen yet. Click the globe.</span>}
          </div>
        </div>
      </section>
    )}
    </div>
=======
            <SkyCanvas frames={pf} a={0} b={pb} mode="blink" showB={showB} swipe={0.5} diff={null} stretch={DEFAULT_STRETCH} markers={[]} showGrid={false} onCursor={() => {}} controls={false} />
          ) : <div className="h-full grid place-items-center note">Fetching the deep field from the archive…</div>}
        </div>
        <div className="px-3 py-2 flex items-center gap-3 border-t border-[var(--rule-soft)]">
          <span className="small">Anything that jumps between the two frames moved.</span>
          <Link className="btn btn-primary ml-auto" href="/?ra=270&dec=66.56">Open this field</Link>
        </div>
      </div>
    </div>
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  );
}
