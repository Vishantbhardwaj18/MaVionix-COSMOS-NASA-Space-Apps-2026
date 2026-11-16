"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Frame } from "@/lib/api";
import { decode16, pixelToWorld, sampleGrid } from "@/lib/wcs";

export type Stretch = { black: number; white: number; a: number; invert: boolean };
export type Marker = { x: number; y: number; label?: string; kind: "known" | "candidate" | "track" | "pick"; epoch?: number };
export type Cursor = { x: number; y: number; ra: number; dec: number; value: number; lambda: number | null } | null;
export type ViewMode = "step" | "blink" | "swipe" | "diff" | "movie" | "surface";

type Props = {
  frames: Frame[];
  a: number; b: number;
  mode: ViewMode;
  showB: boolean;            // for blink: which one is visible
  swipe: number;             // 0..1
  diff: { data16: string; shape: number[] } | null;
  stretch: Stretch;
  markers: Marker[];
  caption?: string;           // written under the image when it is saved as a PNG
  fileName?: string;
  ariaLabel?: string;
  showGrid: boolean;
  smooth?: boolean;           // interpolate between pixels instead of showing them as squares
  onCursor: (c: Cursor) => void;
  onClick?: (x: number, y: number) => void;
  controls?: boolean;
};

const LUT_SIZE = 65536;

export function buildGrey(st: Stretch): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const lo = st.black * (LUT_SIZE - 1), hi = Math.max(st.white * (LUT_SIZE - 1), lo + 1);
  const k = 1 / Math.asinh(1 / st.a);
  for (let i = 0; i < LUT_SIZE; i++) {
    let t = (i - lo) / (hi - lo); t = t < 0 ? 0 : t > 1 ? 1 : t;
    let v = Math.asinh(t / st.a) * k;
    if (st.invert) v = 1 - v;
    lut[i] = v * 255;
  }
  return lut;
}

function paintGrey(ctx: CanvasRenderingContext2D, data: Uint16Array, nx: number, ny: number, lut: Uint8ClampedArray) {
  const img = ctx.createImageData(nx, ny);
  const px = img.data;
  for (let y = 0; y < ny; y++) {
    const srcRow = (ny - 1 - y) * nx;          // FITS origin bottom-left
    for (let x = 0; x < nx; x++) {
      const v = lut[data[srcRow + x]];
      const o = (y * nx + x) * 4;
      px[o] = v; px[o + 1] = v; px[o + 2] = v; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintDiff(ctx: CanvasRenderingContext2D, data: Uint16Array, nx: number, ny: number) {
  const img = ctx.createImageData(nx, ny);
  const px = img.data;
  for (let y = 0; y < ny; y++) {
    const srcRow = (ny - 1 - y) * nx;
    for (let x = 0; x < nx; x++) {
      const z = data[srcRow + x] / 65535 * 2 - 1;       // -1..1
      const m = Math.pow(Math.abs(z), 1.7);   // quiet the noise floor, keep real residuals
      const o = (y * nx + x) * 4;
      // amber for brighter-in-B, blue for brighter-in-A, panel tone at zero
      if (z > 0) { px[o] = 23 + (242 - 23) * m; px[o + 1] = 35 + (181 - 35) * m; px[o + 2] = 57 + (68 - 57) * m; }
      else { px[o] = 23 + (92 - 23) * m; px[o + 1] = 35 + (150 - 35) * m; px[o + 2] = 57 + (255 - 57) * m; }
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function SkyCanvas({ frames, a, b, mode, showB, swipe, diff, stretch, markers, showGrid, onCursor, onClick, controls = true, caption, fileName, ariaLabel, smooth = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const offA = useRef<HTMLCanvasElement | null>(null);
  const offB = useRef<HTMLCanvasElement | null>(null);
  const offD = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ scale: 1, ox: 0, oy: 0 });   // image px -> screen px
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [grabbing, setGrabbing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null);

  const fa = frames[a], fb = frames[b];
  const dataA = useMemo(() => fa ? decode16(fa.data16) : null, [fa]);
  const dataB = useMemo(() => fb ? decode16(fb.data16) : null, [fb]);
  const dataD = useMemo(() => diff ? decode16(diff.data16) : null, [diff]);
  const lut = useMemo(() => buildGrey(stretch), [stretch]);
  const nx = fa?.shape[1] ?? 1, ny = fa?.shape[0] ?? 1;

  // resize observer
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const s = Math.min(size.w / nx, size.h / ny);
    setView({ scale: s, ox: (size.w - nx * s) / 2, oy: (size.h - ny * s) / 2 });
  }, [size, nx, ny]);
  useEffect(() => { fit(); }, [fit, fa?.obs_id]);

  // paint offscreen layers
  useEffect(() => {
    const mk = (ref: React.MutableRefObject<HTMLCanvasElement | null>) => {
      if (!ref.current) ref.current = document.createElement("canvas");
      ref.current.width = nx; ref.current.height = ny;
      return ref.current.getContext("2d")!;
    };
    if (dataA) paintGrey(mk(offA), dataA, nx, ny, lut);
    if (dataB && fb) paintGrey(mk(offB), dataB, fb.shape[1], fb.shape[0], lut);
    if (dataD && diff) paintDiff(mk(offD), dataD, diff.shape[1], diff.shape[0]);
  }, [dataA, dataB, dataD, lut, nx, ny, fb, diff]);

  // composite
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0c1426"; ctx.fillRect(0, 0, size.w, size.h);
    ctx.imageSmoothingEnabled = smooth; ctx.imageSmoothingQuality = "high";
    const draw = (src: HTMLCanvasElement | null) => { if (src) ctx.drawImage(src, view.ox, view.oy, nx * view.scale, ny * view.scale); };
    if (mode === "diff") draw(offD.current);
    else if (mode === "blink") draw(showB ? offB.current : offA.current);
    else if (mode === "swipe") {
      draw(offB.current);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size.w * swipe, size.h); ctx.clip(); draw(offA.current); ctx.restore();
      ctx.strokeStyle = "#f2b544"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(size.w * swipe, 0); ctx.lineTo(size.w * swipe, size.h); ctx.stroke();
    } else draw(offA.current);

    // grid: 1 arcmin ticks along edges
    if (showGrid && fa) {
      const pxPerArcmin = 60 / 6.15 * view.scale;
      ctx.strokeStyle = "rgba(163,174,198,0.35)"; ctx.lineWidth = 1;
      for (let x = view.ox; x < size.w; x += pxPerArcmin) { ctx.beginPath(); ctx.moveTo(x, size.h - 8); ctx.lineTo(x, size.h); ctx.stroke(); }
      for (let y = view.oy + ny * view.scale; y > 0; y -= pxPerArcmin) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(8, y); ctx.stroke(); }
      ctx.fillStyle = "rgba(163,174,198,0.8)"; ctx.font = "12px IBM Plex Sans Variable, system-ui";
      ctx.fillText("1′ ticks", 12, size.h - 14);
    }
    // markers
    const toScreen = (x: number, y: number) => ({ sx: view.ox + (x + 0.5) * view.scale, sy: view.oy + (ny - 1 - y + 0.5) * view.scale });
    ctx.font = "12px IBM Plex Sans Variable, system-ui";
    const current = mode === "blink" ? (showB ? b : a) : a;
    const tracks = markers.filter((m) => m.kind === "track");
    if (tracks.length > 1) {
      ctx.strokeStyle = "rgba(242,181,68,0.6)"; ctx.setLineDash([4, 4]); ctx.beginPath();
      tracks.forEach((m, i) => { const p = toScreen(m.x, m.y); if (i) ctx.lineTo(p.sx, p.sy); else ctx.moveTo(p.sx, p.sy); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (const m of markers) {
      if (m.epoch !== undefined && m.epoch !== current && m.kind !== "track") continue;
      const { sx, sy } = toScreen(m.x, m.y);
      const r = Math.max(9, view.scale * 2.5);
      ctx.lineWidth = 1.5;
      if (m.kind === "known") { ctx.strokeStyle = "#7cc48f"; ctx.beginPath(); ctx.rect(sx - r, sy - r, 2 * r, 2 * r); ctx.stroke(); }
      else if (m.kind === "candidate") { ctx.strokeStyle = "#f2b544"; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.stroke(); }
      else if (m.kind === "track") { ctx.fillStyle = m.epoch === current ? "#f2b544" : "rgba(242,181,68,0.45)"; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 2 * Math.PI); ctx.fill(); }
      else if (m.kind === "pick") {
        ctx.strokeStyle = "#ffffff"; ctx.beginPath();
        ctx.moveTo(sx - r - 6, sy); ctx.lineTo(sx - r + 3, sy); ctx.moveTo(sx + r - 3, sy); ctx.lineTo(sx + r + 6, sy);
        ctx.moveTo(sx, sy - r - 6); ctx.lineTo(sx, sy - r + 3); ctx.moveTo(sx, sy + r - 3); ctx.lineTo(sx, sy + r + 6);
        ctx.stroke();
      }
      if (m.label && m.kind !== "track") { ctx.fillStyle = "#efe7d3"; ctx.fillText(m.label, sx + r + 4, sy + 4); }
    }
  }, [size, view, mode, showB, swipe, markers, showGrid, nx, ny, fa, a, b, lut, dataA, dataB, dataD, smooth]);

  const zoomAt = useCallback((sx: number, sy: number, f: number) => setView((v) => {
    const sc = Math.min(Math.max(v.scale * f, 0.5), 60);
    return { scale: sc, ox: sx - (sx - v.ox) * (sc / v.scale), oy: sy - (sy - v.oy) * (sc / v.scale) };
  }), []);

  // Wheel must be a non-passive native listener, or the page scrolls while the image zooms.
  useEffect(() => {
    const c = canvas.current; if (!c || !controls) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    c.addEventListener("wheel", h, { passive: false });
    return () => c.removeEventListener("wheel", h);
  }, [controls, zoomAt]);

  /** Download what is on screen, with a caption strip so the file explains itself wherever it ends up. */
  const savePng = () => {
    const c = canvas.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, strip = Math.round(34 * dpr);
    const out = document.createElement("canvas");
    out.width = c.width; out.height = c.height + strip;
    const g = out.getContext("2d")!;
    g.drawImage(c, 0, 0);
    g.fillStyle = "#101a30"; g.fillRect(0, c.height, out.width, strip);
    g.fillStyle = "#efe7d3"; g.font = `${Math.round(13 * dpr)}px system-ui, sans-serif`; g.textBaseline = "middle";
    g.fillText(caption ?? "", Math.round(10 * dpr), c.height + strip / 2, out.width - 20 * dpr);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${fileName ?? "cosmos-view"}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  };

  const toImage = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const x = (sx - view.ox) / view.scale - 0.5, y = ny - 1 - ((sy - view.oy) / view.scale - 0.5);
    return { x, y, sx, sy };
  };

  const readCursor = (e: { clientX: number; clientY: number }) => {
    if (!fa || !dataA) return onCursor(null);
    const { x, y } = toImage(e);
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= nx || yi >= ny) return onCursor(null);
    const q = dataA[yi * nx + xi] / 65535;
    const value = fa.vmin + q * (fa.vmax - fa.vmin);
    const { ra, dec } = pixelToWorld(fa.wcs, xi, yi);
    onCursor({ x: xi, y: yi, ra, dec, value, lambda: sampleGrid(fa.wave_grid, xi, yi, nx, ny) });
  };

  // Pointer events cover mouse, pen and touch. Two fingers pinch-zoom about their midpoint.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!controls) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) { drag.current = { sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy }; setGrabbing(true); }
    else { drag.current = null; pinch.current = null; }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointers.current;
    if (ps.has(e.pointerId)) ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ps.size >= 2) {
      const [p1, p2] = [...ps.values()];
      const rect = canvas.current!.getBoundingClientRect();
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2 - rect.left, my = (p1.y + p2.y) / 2 - rect.top;
      if (pinch.current && pinch.current.d > 0) {
        const f = d / pinch.current.d, dx = mx - pinch.current.mx, dy = my - pinch.current.my;
        setView((v) => {
          const sc = Math.min(Math.max(v.scale * f, 0.5), 60);
          return { scale: sc, ox: mx - (mx - v.ox) * (sc / v.scale) + dx, oy: my - (my - v.oy) * (sc / v.scale) + dy };
        });
      }
      pinch.current = { d, mx, my };
      return;
    }
    if (drag.current) {
      const d0 = drag.current;
      setView((v) => ({ ...v, ox: d0.ox + e.clientX - d0.sx, oy: d0.oy + e.clientY - d0.sy }));
      if (e.pointerType === "mouse") return;
    }
    readCursor(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId); pinch.current = null;
    const d = drag.current; drag.current = null; setGrabbing(false);
    if (d && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4 && onClick) { const { x, y } = toImage(e); onClick(Math.round(x), Math.round(y)); }
  };

  // + and - zoom, 0 fits, when the image has focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!controls) return;
    if (e.key === "+" || e.key === "=") zoomAt(size.w / 2, size.h / 2, 1.5);
    else if (e.key === "-") zoomAt(size.w / 2, size.h / 2, 1 / 1.5);
    else if (e.key === "0") fit();
  };

  return (
    <div ref={wrap} className="relative w-full h-full select-none" style={{ cursor: grabbing ? "grabbing" : "crosshair" }}>
      <canvas ref={canvas} className="w-full h-full block" style={{ touchAction: controls ? "none" : "auto" }}
        tabIndex={controls ? 0 : -1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") onCursor(null); }}
        onKeyDown={onKeyDown}
        onDoubleClick={controls ? fit : undefined}
        role="img" aria-label={ariaLabel ?? "SPHEREx cutout"} />
      {controls && (
        <div className="absolute right-2 bottom-2 flex gap-2">
          <div className="seg" style={{ background: "rgba(23,35,57,0.9)" }}>
            <button onClick={savePng} title="Download this view as a PNG with a caption">Save image</button>
          </div>
          <div className="seg" style={{ background: "rgba(23,35,57,0.9)" }}>
            <button onClick={fit} title="Fit to window (double-click or 0)">Fit</button>
            <button onClick={() => zoomAt(size.w / 2, size.h / 2, 1.5)} aria-label="Zoom in" title="Zoom in (+)">+</button>
            <button onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.5)} aria-label="Zoom out" title="Zoom out (-)">−</button>
          </div>
        </div>
      )}
    </div>
  );
}
