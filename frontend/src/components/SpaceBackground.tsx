"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sceneFor, useSkyFocus, type SkyScene } from "@/lib/skyScene";
import { bvToRgb, COLOR_BIN_BV, fallbackStars, loadMilkyWay, loadStars, type MwPoly, type SkyStar } from "@/lib/sky";

// Fixed, non-interactive night-sky backdrop (pure canvas). Built from real data:
//  - Hipparcos / Yale Bright Star positions, magnitudes and B-V colours (d3-celestial stars.6 / stars.8)
//  - the Milky Way as measured isophote contours (d3-celestial mw.json), shaded with galactic
//    structure: warm bulge toward the Galactic Centre, Great Rift dust lanes, patchy dust
//  - a true stereographic projection of the celestial sphere; each page looks at a different region
//    of the sky (lib/skyScene.ts) and the camera swings between them; on the start page the sky
//    also turns about the celestial pole (Earth's rotation, sped up); the mouse nudges the camera
//  - magnitude-based star size / brightness, blackbody colours, twinkle, diffraction spikes on the brightest
//  - the Large & Small Magellanic Clouds (SPHEREx's first science targets) and 47 Tucanae at their true
//    sky positions and angular sizes, with HII regions (30 Doradus, N11/NGC 1763, N44, N159, NGC 346) placed
//    at catalogue coordinates; their shading is procedural, anchored to those real positions and sizes
//  - occasional meteors
// If the data cannot be loaded (offline) it falls back to a statistical starfield + analytic Galactic band.
// Sits behind all page content.

type RGB = [number, number, number];
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const FOV = (66 * Math.PI) / 180; // field of view across the larger screen dimension
const SKY_RATE = (0.02 * Math.PI) / 180 / 1000; // rad per ms (~1.2 deg / minute)
const MW_SCALE = 5; // CSS px per Milky Way sample (it is a diffuse layer)
const MW_W = 720, MW_H = 360;
const FAINT_ALPHA = [0.62, 0.42, 0.26, 0.15]; // by magnitude bin: 5.2-6.0, 6.0-6.8, 6.8-7.6, >7.6
const FAINT_RGB = COLOR_BIN_BV.map((bv) => bvToRgb(bv));

/* ---------- noise ---------- */
const sm = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, v: number) => sm(clamp((v - a) / (b - a)));

function hash3(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed + 1, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const h = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k, seed);
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
    l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  );
}
function fbm(x: number, y: number, z: number, oct: number, seed: number) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    a += amp * noise3(x * f, y * f, z * f, seed + i * 7);
    f *= 2;
    amp *= 0.5;
  }
  return a / (1 - Math.pow(0.5, oct)); // 0..1, centred near 0.5
}
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mkCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/* ---------- galactic geometry ---------- */
// J2000 equatorial -> galactic rotation
function toGalactic(x: number, y: number, z: number): [number, number, number] {
  return [
    -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z,
    0.4941094279 * x - 0.44482963 * y + 0.7469822445 * z,
    -0.867666149 * x - 0.1980763734 * y + 0.4559837762 * z,
  ];
}

function boxBlur(src: Float32Array, W: number, H: number, rad: number, passes: number) {
  let a = src, b = new Float32Array(src.length);
  const win = rad * 2 + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) { // horizontal, wraps in longitude
      let sum = 0;
      for (let k = -rad; k <= rad; k++) sum += a[y * W + ((k + W) % W)];
      for (let x = 0; x < W; x++) {
        b[y * W + x] = sum / win;
        sum += a[y * W + ((x + rad + 1) % W)] - a[y * W + ((x - rad + W) % W)];
      }
    }
    const c = new Float32Array(src.length);
    for (let x = 0; x < W; x++) { // vertical, clamped at the poles
      for (let y = 0; y < H; y++) {
        let s = 0;
        for (let k = -rad; k <= rad; k++) s += b[Math.min(H - 1, Math.max(0, y + k)) * W + x];
        c[y * W + x] = s / win;
      }
    }
    a = c;
    b = new Float32Array(src.length);
  }
  return a;
}

/** Equirectangular RGBA Milky Way map (x: RA wrapped to -180..180, y: Dec +90..-90). */
function buildMilkyWayTexture(polys: MwPoly[] | null) {
  const N = MW_W * MW_H;
  const lonOf = (x: number) => ((x + 0.5) / MW_W) * 2 * Math.PI - Math.PI;
  const latOf = (y: number) => Math.PI / 2 - ((y + 0.5) / MW_H) * Math.PI;
  const vec = (x: number, y: number): [number, number, number] => {
    const lo = lonOf(x), la = latOf(y), c = Math.cos(la);
    return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
  };
  // Galactic-band intensity: from the measured contours, or analytic if the data is missing
  const analytic = () => {
    const f = new Float32Array(N);
    for (let y = 0; y < MW_H; y++) for (let x = 0; x < MW_W; x++) {
      const [vx, vy, vz] = vec(x, y);
      const [gx, gy, gz] = toGalactic(vx, vy, vz);
      const b = Math.asin(Math.max(-1, Math.min(1, gz)));
      const l = Math.atan2(gy, gx);
      f[y * MW_W + x] = Math.exp(-(b * b) / (2 * 0.16 * 0.16)) * (0.55 + 0.45 * Math.cos(l)) ;
    }
    return f;
  };
  const fromContours = (mirror: boolean) => {
    const c = mkCanvas(MW_W, MW_H);
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(255,255,255,0.3)"; // 5 nested isophotes accumulate to the brightest core
    for (const poly of polys!) {
      g.beginPath();
      for (const ring of poly.rings) {
        ring.forEach(([lon, lat], i) => {
          const X = (((mirror ? -lon : lon) + 180) / 360) * MW_W, Y = ((90 - lat) / 180) * MW_H;
          if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
        });
        g.closePath();
      }
      g.fill("evenodd");
    }
    const d = g.getImageData(0, 0, MW_W, MW_H).data;
    const f = new Float32Array(N);
    for (let i = 0; i < N; i++) f[i] = d[i * 4 + 3] / 255;
    return f;
  };
  const at = (f: Float32Array, raDeg: number, decDeg: number) => {
    const lon = raDeg > 180 ? raDeg - 360 : raDeg;
    const x = Math.min(MW_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MW_W)));
    const y = Math.min(MW_H - 1, Math.max(0, Math.floor(((90 - decDeg) / 180) * MW_H)));
    return f[y * MW_W + x];
  };
  // sanity check against known geometry: Galactic Centre (RA 266.4, Dec -28.9) bright, North Galactic Pole (192.9, +27.1) dark
  const plausible = (f: Float32Array) => at(f, 266.4, -28.9) > 0.35 && at(f, 192.9, 27.1) < 0.12;

  let I: Float32Array;
  let real = false;
  if (polys && polys.length) {
    let f = fromContours(false);
    if (!plausible(f)) f = fromContours(true);
    if (plausible(f)) { I = boxBlur(f, MW_W, MW_H, 6, 3); real = true; } else I = boxBlur(analytic(), MW_W, MW_H, 2, 1);
  } else I = boxBlur(analytic(), MW_W, MW_H, 2, 1);

  const out = new Uint8ClampedArray(N * 4);
  const cool: RGB = [138, 156, 214], warm: RGB = [255, 222, 174];
  for (let y = 0; y < MW_H; y++) {
    for (let x = 0; x < MW_W; x++) {
      const k = y * MW_W + x;
      const Iv = Math.pow(clamp(I[k]), 1.15);
      if (Iv < 0.004) continue;
      const [vx, vy, vz] = vec(x, y);
      const [gx, gy, gz] = toGalactic(vx, vy, vz);
      const ang = Math.acos(clamp(gx, -1, 1));
      const g = Math.exp(-Math.pow(ang / 0.95, 2)); // brighter + warmer toward the bulge
      const l = Math.atan2(gy, gx), b = Math.asin(clamp(gz, -1, 1));
      const mott = fbm(vx * 4 + 3, vy * 4, vz * 4, 4, 31);
      const dn = fbm(vx * 9 + 7.7, vy * 9, vz * 9, 4, 23);
      const gate = smoothstep(-0.55, -0.1, l) * (1 - smoothstep(0.8, 1.3, l)); // the Great Rift sits at l ~ -20..+60 deg
      const lane = Math.exp(-Math.pow((b - 0.012) / 0.045, 2)) * gate * clamp((dn - 0.42) * 3.2) * 0.6;
      const patch = clamp((dn - 0.52) * 2.4) * Iv * 0.4;
      const B = clamp(Iv * (0.34 + 0.95 * g) * (0.68 + 0.64 * mott) * (1 - lane - patch));
      const col = mix(cool, warm, clamp(g * 1.15));
      const o = k * 4;
      out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2];
      out[o + 3] = Math.round(B * 0.52 * 255);
    }
  }
  return { data: out, real };
}

/* ---------- Magellanic Clouds: real positions and sizes, procedural shading ---------- */
const D2R = Math.PI / 180;
type Sprite = { canvas: HTMLCanvasElement; span: number; v: [number, number, number]; n: [number, number, number]; a: number };

/** Gnomonic offset (degrees) of (ra,dec) from a tangent point; x is toward the WEST (screen-right when north is up), y toward north. */
function tangent(ra: number, dec: number, ra0: number, dec0: number): [number, number] {
  const a = ra * D2R, d = dec * D2R, a0 = ra0 * D2R, d0 = dec0 * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc;
  return [-xi / D2R, eta / D2R];
}
const unitVec = (ra: number, dec: number): [number, number, number] => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const northAt = (ra: number, dec: number): [number, number, number] => [-Math.sin(dec * D2R) * Math.cos(ra * D2R), -Math.sin(dec * D2R) * Math.sin(ra * D2R), Math.cos(dec * D2R)];

type Hii = { ra: number; dec: number; sigma: number; amp: number };
// HII regions at approximate catalogue positions (J2000, degrees)
const LMC = { ra: 80.894, dec: -69.756, span: 17, size: 560 };
const LMC_HII: Hii[] = [
  { ra: 84.676, dec: -69.101, sigma: 0.32, amp: 1.0 }, // 30 Doradus / Tarantula Nebula
  { ra: 84.78, dec: -69.77, sigma: 0.2, amp: 0.5 }, // N159
  { ra: 74.45, dec: -66.4, sigma: 0.3, amp: 0.55 }, // N11 (contains NGC 1763, in SPHEREx's first science images)
  { ra: 80.5, dec: -67.95, sigma: 0.25, amp: 0.5 }, // N44
  { ra: 79.6, dec: -69.1, sigma: 0.18, amp: 0.3 }, // N119
  { ra: 85.8, dec: -67.5, sigma: 0.22, amp: 0.35 }, // N70
  { ra: 82.3, dec: -68.4, sigma: 0.18, amp: 0.22 },
];
const SMC = { ra: 13.187, dec: -72.829, span: 8, size: 300 };

function renderSprite(size: number, span: number, shade: (x: number, y: number) => [number, number, number, number]) {
  const c = mkCanvas(size, size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const ppd = size / span;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5 - size / 2) / ppd, y = (size / 2 - (j + 0.5)) / ppd;
      const [r, gg, b, a] = shade(x, y);
      const o = (j * size + i) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = Math.round(clamp(a) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeLMC(): Sprite {
  const rand = rng(1701);
  const hii = LMC_HII.map((h) => { const [x, y] = tangent(h.ra, h.dec, LMC.ra, LMC.dec); return { x, y, s: h.sigma, a: h.amp }; });
  const clumps: { x: number; y: number; s: number; a: number }[] = [];
  for (let i = 0; i < 70; i++) { // smaller star-forming knots, skewed toward the active east/north side
    const ang = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 4;
    const x = Math.cos(ang) * rr * 0.9 - 0.5, y = Math.sin(ang) * rr * 0.75 + 0.2;
    clumps.push({ x, y, s: 0.07 + rand() * 0.12, a: 0.03 + rand() * 0.08 });
  }
  const PA = 170 * D2R, BAR = 118 * D2R; // disk major axis / bar position angle (E of N)
  const maj = [-Math.sin(PA), Math.cos(PA)], mnr = [Math.cos(PA), Math.sin(PA)];
  const bj = [-Math.sin(BAR), Math.cos(BAR)], bn = [Math.cos(BAR), Math.sin(BAR)];
  const t30 = hii[0];
  const stellar: RGB = [226, 222, 232], bar: RGB = [255, 226, 186], pink: RGB = [236, 92, 128], core: RGB = [200, 218, 255];
  const canvas = renderSprite(LMC.size, LMC.span, (x, y) => {
    const xm = x * maj[0] + y * maj[1], ym = x * mnr[0] + y * mnr[1];
    const rr = Math.hypot(xm, ym / 0.85);
    const disk = Math.exp(-Math.pow(rr / 3.4, 1.4)) * (1 - smoothstep(3.2, 6.8, rr));
    const bm = x * bj[0] + y * bj[1], bnn = x * bn[0] + y * bn[1];
    const barI = Math.exp(-Math.pow(bm / 2.1, 2) - Math.pow(bnn / 0.55, 2));
    const mott = 0.55 + 0.9 * fbm(x * 0.9 + 3, y * 0.9, 5, 4, 41);
    const dd = fbm(x * 1.5 + 9, y * 1.5, 12, 4, 51);
    const dust = clamp((dd - 0.56) * 3) * 0.35 * clamp(disk * 3);
    const star = (0.62 * disk + 0.7 * barI) * mott * (1 - dust);
    let h = 0, c30 = 0;
    for (const k of hii) {
      const d2 = (x - k.x) * (x - k.x) + (y - k.y) * (y - k.y);
      h += k.a * Math.exp(-d2 / (2 * k.s * k.s)) * (0.7 + 0.6 * fbm(x * 6, y * 6, 2 + k.s * 10, 3, 61));
    }
    for (const k of clumps) h += k.a * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s)) * clamp(disk * 4);
    {
      const dx = x - t30.x, dy = y - t30.y, r30 = Math.hypot(dx, dy);
      const shell = Math.exp(-Math.pow((r30 - 0.3) / 0.09, 2)) * clamp((fbm(x * 9, y * 9, 7, 4, 71) - 0.35) * 3);
      h += 0.45 * shell + 0.25 * Math.exp(-Math.pow((r30 - 0.62) / 0.12, 2)) * clamp((fbm(x * 7, y * 7, 3, 3, 72) - 0.4) * 3);
      c30 = Math.exp(-(r30 * r30) / (2 * 0.05 * 0.05)); // R136 star cluster at the core
    }
    const sw = star * 0.85, hw = h * 0.55, cw = c30 * 0.9;
    const tot = sw + hw + cw + 1e-6;
    const sc = mix(stellar, bar, clamp(barI * 1.3));
    const r = (sc[0] * sw + pink[0] * hw + core[0] * cw) / tot;
    const g = (sc[1] * sw + pink[1] * hw + core[1] * cw) / tot;
    const b = (sc[2] * sw + pink[2] * hw + core[2] * cw) / tot;
    return [r, g, b, tot * 0.9];
  });
  return { canvas, span: LMC.span, v: unitVec(LMC.ra, LMC.dec), n: northAt(LMC.ra, LMC.dec), a: 0.95 };
}

function makeSMC(): Sprite {
  const [nx, ny] = tangent(14.77, -72.18, SMC.ra, SMC.dec); // NGC 346, its brightest HII region
  const PA = 45 * D2R;
  const maj = [-Math.sin(PA), Math.cos(PA)], mnr = [Math.cos(PA), Math.sin(PA)];
  const canvas = renderSprite(SMC.size, SMC.span, (x, y) => {
    const xm = x * maj[0] + y * maj[1], ym = x * mnr[0] + y * mnr[1];
    const body = Math.exp(-(Math.pow(xm / 1.35, 2) + Math.pow(ym / 0.75, 2)));
    const wing = Math.exp(-(Math.pow((x + 1.9) / 1.1, 2) + Math.pow((y - 0.4) / 0.5, 2))) * 0.35; // toward the LMC
    const mott = 0.55 + 0.9 * fbm(x * 1.4 + 20, y * 1.4, 9, 4, 81);
    const s = (body + wing) * mott;
    const h = 0.6 * Math.exp(-((x - nx) ** 2 + (y - ny) ** 2) / (2 * 0.1 * 0.1));
    const w = s * 0.55 + h, tot = w + 1e-6;
    const r = (228 * s * 0.55 + 236 * h) / tot, g = (224 * s * 0.55 + 100 * h) / tot, b = (230 * s * 0.55 + 135 * h) / tot;
    return [r, g, b, tot * 0.85];
  });
  return { canvas, span: SMC.span, v: unitVec(SMC.ra, SMC.dec), n: northAt(SMC.ra, SMC.dec), a: 0.9 };
}
// Real globular clusters that sit in the Magellanic field: 47 Tucanae (naked-eye, mag 4.1) and NGC 362
const GLOBULARS = [{ ra: 6.024, dec: -72.081, r: 0.28, a: 0.75 }, { ra: 15.809, dec: -70.849, r: 0.12, a: 0.4 }];

export default function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  // each page looks at a different part of the same real sky (see lib/skyScene.ts)
  const path = usePathname();
  const sp = useSearchParams();
  const focus = useSkyFocus();
  const ra = sp.get("ra"), dec = sp.get("dec");
  const field = path === "/" ? (focus ?? (ra !== null && dec !== null && Number.isFinite(Number(ra)) && Number.isFinite(Number(dec)) ? { ra: Number(ra), dec: Number(dec) } : null)) : null;
  const scene = sceneFor(path, field);
  const sceneRef = useRef<SkyScene>(scene);
  useEffect(() => { sceneRef.current = scene; });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, disposed = false;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const ac = new AbortController();

    const r = rng(2026);

    /* ---- real sky data (loaded async; the page never waits for it) ---- */
    let stars: SkyStar[] = [];
    let mwTex: Uint8ClampedArray | null = null;
    let sprites: Sprite[] = [];
    let skyReadyAt = 0; // timestamp when data first became drawable (for fade-in)
    let skyReady = false;
    const markReady = () => {
      if (!skyReady) { skyReady = true; skyReadyAt = performance.now(); }
      if (reduce) draw(0);
    };
    (async () => {
      const [s6, mw] = await Promise.allSettled([loadStars("stars.6.json", ac.signal), loadMilkyWay(ac.signal)]);
      if (disposed) return;
      stars = s6.status === "fulfilled" && s6.value.length > 500 ? s6.value : fallbackStars(r);
      const polys = mw.status === "fulfilled" ? mw.value : null;
      setTimeout(() => {
        if (disposed) return;
        mwTex = buildMilkyWayTexture(polys).data; // ~0.2 s, once
        markReady();
        setTimeout(() => { if (!disposed) { sprites = [makeLMC(), makeSMC()]; if (reduce) draw(0); } }, 0);
        // deeper catalogue (to mag 8) arrives later and replaces the first one
        loadStars("stars.8.json", ac.signal).then((s8) => { if (!disposed && s8.length > stars.length) { stars = s8; if (reduce) draw(0); } }).catch(() => {});
      }, 0);
    })();

    /* ---- camera: base pointing + roll, as an orthonormal basis in equatorial coordinates ---- */
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = (a: number[]) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
    let F0 = [1, 0, 0], U0 = [0, 0, 1], R0 = [0, -1, 0];
    const rot = (v: number[], k: number[], ang: number) => { // Rodrigues rotation
      const c = Math.cos(ang), sn = Math.sin(ang), kd = dot(k, v) * (1 - c), kx = cross(k, v);
      return [v[0] * c + kx[0] * sn + k[0] * kd, v[1] * c + kx[1] * sn + k[1] * kd, v[2] * c + kx[2] * sn + k[2] * kd];
    };
    type Basis = { F: number[]; R: number[]; U: number[] };
    let cur: SkyScene = sceneRef.current;
    let theta = 0;                       // how far the sky has turned about the celestial pole
    let from: Basis | null = null, to: Basis | null = null, blend = 1;
    const basisFor = (sc: SkyScene): Basis => {
      // Look straight at the scene's target with north up (east to the left), apply the roll,
      // then tilt the camera so the target lands at the scene's screen position.
      const n0 = unitVec(sc.ra, sc.dec);
      const cT = Math.cos(theta), sT = Math.sin(theta);
      const N = [n0[0] * cT - n0[1] * sT, n0[0] * sT + n0[1] * cT, n0[2]];
      const f = N;
      const polar = Math.abs(f[2]) > 0.9999;
      const u = polar ? [1, 0, 0] : norm([-f[0] * f[2], -f[1] * f[2], 1 - f[2] * f[2]]);
      const r = cross(f, u);
      const roll = (sc.roll * Math.PI) / 180;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const rN = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr];
      const uN = [u[0] * cr - r[0] * sr, u[1] * cr - r[1] * sr, u[2] * cr - r[2] * sr];
      const X = ((sc.at.x - 0.5) * w) / K, Y = ((0.5 - sc.at.y) * h) / K; // stereographic coords of the target
      const rho2 = X * X + Y * Y, cz = (4 - rho2) / (4 + rho2), q = (1 + cz) / 2;
      const cxn = X * q, cyn = Y * q; // desired camera-frame coordinates of the target
      const M = [cxn * rN[0] + cyn * uN[0] + cz * f[0], cxn * rN[1] + cyn * uN[1] + cz * f[1], cxn * rN[2] + cyn * uN[2] + cz * f[2]];
      const ang = Math.acos(clamp(dot(M, N), -1, 1));
      if (ang < 1e-6) return { F: f, R: rN, U: uN };
      const k = norm(cross(M, N));
      return { F: rot(f, k, ang), R: rot(rN, k, ang), U: rot(uN, k, ang) };
    };
    const setCamera = () => {
      const b = basisFor(cur);
      F0 = b.F; R0 = b.R; U0 = b.U; from = to = null; blend = 1;
    };

    /* low-res Milky Way render target + camera-space ray table */
    let lw = 0, lh = 0, K = 1;
    let mwCanvas = mkCanvas(2, 2);
    let mwCtx = mwCanvas.getContext("2d")!;
    let mwImg = mwCtx.createImageData(2, 2);
    let rays = new Float32Array(0);
    let lastMw = -1e9;

    /* meteors */
    const meteors: Meteor[] = [];
    let nextMeteor = 3500;


    const buildSky = () => {
      K = (Math.max(w, h) / 2) / (2 * Math.tan(FOV / 4));
      lw = Math.ceil(w / MW_SCALE) + 1;
      lh = Math.ceil(h / MW_SCALE) + 1;
      mwCanvas = mkCanvas(lw, lh);
      mwCtx = mwCanvas.getContext("2d")!;
      mwImg = mwCtx.createImageData(lw, lh);
      rays = new Float32Array(lw * lh * 3);
      for (let j = 0; j < lh; j++) {
        for (let i = 0; i < lw; i++) {
          const X = ((i + 0.5) * MW_SCALE - w / 2) / K, Y = (h / 2 - (j + 0.5) * MW_SCALE) / K;
          const rho2 = X * X + Y * Y, cz = (4 - rho2) / (4 + rho2), q = (1 + cz) / 2;
          const o = (j * lw + i) * 3;
          rays[o] = X * q; rays[o + 1] = Y * q; rays[o + 2] = cz;
        }
      }
      setCamera();
      lastMw = -1e9;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSky();
      if (reduce) draw(0);
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    };


    function draw(t: number) {
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const big = Math.max(w, h);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);
      // deepen the page's navy into a natural near-black sky with a faint airglow toward the horizon
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(1,3,9,0.82)");
      bg.addColorStop(0.7, "rgba(4,7,17,0.7)");
      bg.addColorStop(1, "rgba(9,14,26,0.62)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // camera basis: base pointing nudged by the mouse (the sky is at infinity, so parallax = a tiny rotation)
      const ax = -mouse.x * 0.05, ay = mouse.y * 0.035;
      const f2 = norm([F0[0] + ax * R0[0] + ay * U0[0], F0[1] + ax * R0[1] + ay * U0[1], F0[2] + ax * R0[2] + ay * U0[2]]);
      const k1 = dot(R0, f2);
      const r2 = norm([R0[0] - k1 * f2[0], R0[1] - k1 * f2[1], R0[2] - k1 * f2[2]]);
      const u2 = cross(r2, f2);
      // a new page: swing the camera to its part of the sky
      if (sceneRef.current.key !== cur.key) {
        cur = sceneRef.current;
        if (reduce) setCamera();
        else { from = { F: F0, R: R0, U: U0 }; to = basisFor(cur); blend = 0; }
      }
      if (from && to && blend < 1) {
        blend = Math.min(1, blend + dt / 1700);
        const e = blend < 0.5 ? 2 * blend * blend : 1 - Math.pow(-2 * blend + 2, 2) / 2;
        const lf = [from.F[0] + (to.F[0] - from.F[0]) * e, from.F[1] + (to.F[1] - from.F[1]) * e, from.F[2] + (to.F[2] - from.F[2]) * e];
        if (Math.hypot(lf[0], lf[1], lf[2]) < 0.08 || blend >= 1) { F0 = to.F; R0 = to.R; U0 = to.U; if (blend >= 1) from = to = null; }
        else {
          F0 = norm(lf);
          const lr = [from.R[0] + (to.R[0] - from.R[0]) * e, from.R[1] + (to.R[1] - from.R[1]) * e, from.R[2] + (to.R[2] - from.R[2]) * e];
          const kk = dot(lr, F0);
          R0 = norm([lr[0] - kk * F0[0], lr[1] - kk * F0[1], lr[2] - kk * F0[2]]);
          U0 = cross(R0, F0);
        }
        lastMw = -1e9;
      }
      if (!reduce && cur.drift) theta += dt * SKY_RATE; // Earth-rotation turn of the sky, on the pages that use it
      const cT = Math.cos(theta), sT = Math.sin(theta);
      const fade = skyReady ? clamp((performance.now() - skyReadyAt) / 1400) : 0;

      if (fade > 0) {
        /* Milky Way: sample the real-data map through the inverse projection, at low resolution */
        if (mwTex && (reduce ? lastMw < 0 : t - lastMw > 33)) {
          lastMw = t;
          const d = mwImg.data;
          const n = lw * lh;
          for (let p = 0; p < n; p++) {
            const o3 = p * 3;
            const cx = rays[o3], cy = rays[o3 + 1], cz = rays[o3 + 2];
            const ex = cx * r2[0] + cy * u2[0] + cz * f2[0];
            const ey = cx * r2[1] + cy * u2[1] + cz * f2[1];
            const ez = cx * r2[2] + cy * u2[2] + cz * f2[2];
            const x0 = ex * cT + ey * sT, y0 = -ex * sT + ey * cT;
            let tx = Math.floor((Math.atan2(y0, x0) / (Math.PI * 2) + 0.5) * MW_W);
            if (tx >= MW_W) tx = MW_W - 1;
            const ty = Math.min(MW_H - 1, Math.max(0, Math.floor((0.5 - Math.asin(ez > 1 ? 1 : ez < -1 ? -1 : ez) / Math.PI) * MW_H)));
            const ti = (ty * MW_W + tx) * 4, o = p * 4;
            d[o] = mwTex[ti]; d[o + 1] = mwTex[ti + 1]; d[o + 2] = mwTex[ti + 2]; d[o + 3] = mwTex[ti + 3];
          }
          mwCtx.putImageData(mwImg, 0, 0);
        }
        if (mwTex) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = fade;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(mwCanvas, 0, 0, lw * MW_SCALE, lh * MW_SCALE);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        /* Magellanic Clouds + globular clusters, anchored to their sky coordinates */
        if (sprites.length) {
          ctx.globalCompositeOperation = "lighter";
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const P = (vx: number, vy: number, vz: number) => {
            const x = vx * cT - vy * sT, y = vx * sT + vy * cT;
            const cz = x * f2[0] + y * f2[1] + vz * f2[2];
            const den = 1 + cz;
            return [w / 2 + (K * 2 * (x * r2[0] + y * r2[1] + vz * r2[2])) / den, h / 2 - (K * 2 * (x * u2[0] + y * u2[1] + vz * u2[2])) / den, cz];
          };
          for (const sp of sprites) {
            const [px, py, cz] = P(sp.v[0], sp.v[1], sp.v[2]);
            if (cz < -0.5) continue;
            const ppd = ((2 * K) / (1 + cz)) * D2R; // screen px per degree at this point of the stereographic projection
            const half = (sp.span / 2) * ppd * 1.42;
            if (px < -half || px > w + half || py < -half || py > h + half) continue;
            const [qx, qy] = P(sp.v[0] + sp.n[0] * 0.01, sp.v[1] + sp.n[1] * 0.01, sp.v[2] + sp.n[2] * 0.01); // a point just north of it
            const ang = Math.atan2(qy - py, qx - px) + Math.PI / 2;
            const sc = (sp.span * ppd) / sp.canvas.width;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(ang);
            ctx.scale(sc, sc);
            ctx.globalAlpha = fade * sp.a;
            ctx.drawImage(sp.canvas, -sp.canvas.width / 2, -sp.canvas.height / 2);
            ctx.restore();
          }
          for (const gc of GLOBULARS) {
            const v = unitVec(gc.ra, gc.dec);
            const [px, py, cz] = P(v[0], v[1], v[2]);
            if (cz < -0.5 || px < -40 || px > w + 40 || py < -40 || py > h + 40) continue;
            const rad = Math.max(3, gc.r * ((2 * K) / (1 + cz)) * D2R * 2.2);
            const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
            g.addColorStop(0, "rgba(255,244,222," + (gc.a * fade).toFixed(3) + ")");
            g.addColorStop(0.3, "rgba(255,232,196," + (gc.a * 0.3 * fade).toFixed(3) + ")");
            g.addColorStop(1, "rgba(255,226,190,0)");
            ctx.fillStyle = g;
            ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
          }
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        /* stars: real positions through the same projection; size and brightness follow magnitude */
        const cxs = w / 2, cys = h / 2, sc = clamp(big / 1100, 0.8, 1.5);
        const faint = Array.from({ length: 20 }, () => new Path2D());
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const x = s.x * cT - s.y * sT, y = s.x * sT + s.y * cT, z = s.z;
          const cz = x * f2[0] + y * f2[1] + z * f2[2];
          if (cz < -0.92) continue;
          const den = 1 + cz;
          const px = cxs + (K * 2 * (x * r2[0] + y * r2[1] + z * r2[2])) / den;
          if (px < -24 || px > w + 24) continue;
          const py = cys - (K * 2 * (x * u2[0] + y * u2[1] + z * u2[2])) / den;
          if (py < -24 || py > h + 24) continue;
          const m = s.mag;
          if (m > 5.2) { // faint stars: batched into 20 colour x brightness paths, one fill each
            const bi = s.cbin * 4 + (m < 6 ? 0 : m < 6.8 ? 1 : m < 7.6 ? 2 : 3);
            faint[bi].rect(px - 0.4 * sc, py - 0.4 * sc, 0.8 * sc, 0.8 * sc);
            continue;
          }
          const tw = m < 3.2 && !reduce ? 0.93 + 0.07 * Math.sin(t * 0.0012 * (1 + (i % 7) * 0.3) + i) : 1;
          const a = clamp(0.62 + (5.2 - m) * 0.13) * tw * fade;
          const rad = (0.55 + Math.max(0, 5.2 - m) * 0.21) * sc;
          if (m < 3.4) {
            const gr = rad * (4 + (3.4 - m) * 1.6);
            const g = ctx.createRadialGradient(px, py, 0, px, py, gr);
            g.addColorStop(0, "rgba(" + s.css + "," + (a * 0.5).toFixed(3) + ")");
            g.addColorStop(0.25, "rgba(" + s.css + "," + (a * 0.14).toFixed(3) + ")");
            g.addColorStop(1, "rgba(" + s.css + ",0)");
            ctx.fillStyle = g;
            ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2);
            if (m < 0.9) { // diffraction spikes on the very brightest (Sirius, Vega, Arcturus...)
              const len = rad * 14;
              ctx.strokeStyle = "rgba(" + s.css + "," + (a * 0.32).toFixed(3) + ")";
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(px - len, py); ctx.lineTo(px + len, py);
              ctx.moveTo(px, py - len); ctx.lineTo(px, py + len);
              ctx.stroke();
            }
          }
          ctx.fillStyle = "rgba(" + s.css + "," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let bi = 0; bi < 20; bi++) {
          const c = FAINT_RGB[Math.floor(bi / 4)];
          ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (FAINT_ALPHA[bi % 4] * fade).toFixed(3) + ")";
          ctx.fill(faint[bi]);
        }

        /* reference lines that belong to this page's patch of sky (ecliptic, a hypothesised orbit plane) */
        for (const ln of cur.lines) {
          ctx.save();
          ctx.strokeStyle = "rgba(" + ln.rgb + "," + (ln.alpha * fade).toFixed(3) + ")";
          ctx.lineWidth = 1.1;
          ctx.setLineDash(ln.dash);
          ctx.beginPath();
          let pen = false, lx = 0, ly = 0;
          for (const [lra, ldec] of ln.pts) {
            const v = unitVec(lra, ldec);
            const x = v[0] * cT - v[1] * sT, y = v[0] * sT + v[1] * cT, z = v[2];
            const cz = x * f2[0] + y * f2[1] + z * f2[2];
            if (cz < -0.2) { pen = false; continue; }
            const den = 1 + cz;
            const px = cxs + (K * 2 * (x * r2[0] + y * r2[1] + z * r2[2])) / den;
            const py = cys - (K * 2 * (x * u2[0] + y * u2[1] + z * u2[2])) / den;
            if (pen && Math.hypot(px - lx, py - ly) < big) ctx.lineTo(px, py); else ctx.moveTo(px, py);
            pen = true; lx = px; ly = py;
          }
          ctx.stroke();
          ctx.restore();
        }
      }


      // meteors
      if (!reduce) {
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          const ang = (Math.PI / 180) * (20 + r() * 30);
          const dir = r() < 0.5 ? 1 : -1;
          const sp = 0.9 + r() * 0.6; // px per ms
          meteors.push({ x: dir > 0 ? r() * w * 0.6 : w * 0.4 + r() * w * 0.6, y: r() * h * 0.45, vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp, life: 0, max: 600 + r() * 400 });
          nextMeteor = 7000 + r() * 11000;
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.life += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const f = m.life / m.max;
          if (f >= 1) { meteors.splice(i, 1); continue; }
          const fade = Math.sin(Math.PI * f);
          const mag = Math.hypot(m.vx, m.vy);
          const tx = m.x - (m.vx / mag) * 130, ty = m.y - (m.vy / mag) * 130;
          const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(1, `rgba(255,248,235,${(0.9 * fade).toFixed(3)})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
      }


      if (!reduce) raf = requestAnimationFrame(draw);
    }



    resize();
    if (!reduce) raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      disposed = true;
      ac.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="sky-bg"
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
}
