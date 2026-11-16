/** Minimal gnomonic (TAN) WCS for cursor readouts. Pixel coords are 0-based, FITS convention. */
export type TanWcs = { crpix: [number, number]; crval: [number, number]; cd: [[number, number], [number, number]] };

const D2R = Math.PI / 180;

export function pixelToWorld(w: TanWcs, x: number, y: number): { ra: number; dec: number } {
  const dx = x + 1 - w.crpix[0], dy = y + 1 - w.crpix[1];
  const xi = (w.cd[0][0] * dx + w.cd[0][1] * dy) * D2R;   // standard coords, radians
  const eta = (w.cd[1][0] * dx + w.cd[1][1] * dy) * D2R;
  const ra0 = w.crval[0] * D2R, dec0 = w.crval[1] * D2R;
  const den = Math.cos(dec0) - eta * Math.sin(dec0);
  const dra = Math.atan2(xi, den);
  const dec = Math.atan(((Math.sin(dec0) + eta * Math.cos(dec0)) * Math.cos(dra)) / den);
  let ra = (ra0 + dra) / D2R;
  ra = ((ra % 360) + 360) % 360;
  return { ra, dec: dec / D2R };
}

export function fmtRA(deg: number): string {
  const h = deg / 15, hh = Math.floor(h), m = (h - hh) * 60, mm = Math.floor(m), ss = (m - mm) * 60;
  return `${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m ${ss.toFixed(1).padStart(4, "0")}s`;
}
export function fmtDec(deg: number): string {
  const s = deg < 0 ? "−" : "+", a = Math.abs(deg), dd = Math.floor(a), m = (a - dd) * 60, mm = Math.floor(m), ss = (m - mm) * 60;
  return `${s}${String(dd).padStart(2, "0")}° ${String(mm).padStart(2, "0")}′ ${ss.toFixed(0).padStart(2, "0")}″`;
}

export function decode16(b64: string): Uint16Array {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Uint16Array(buf);
}

/** Bilinear sample of a coarse wavelength grid (n×n) covering the image. */
export function sampleGrid(grid: { n: number; values: number[][] } | null, x: number, y: number, nx: number, ny: number): number | null {
  if (!grid) return null;
  const gx = (x / (nx - 1)) * (grid.n - 1), gy = (y / (ny - 1)) * (grid.n - 1);
  const x0 = Math.max(0, Math.min(grid.n - 2, Math.floor(gx))), y0 = Math.max(0, Math.min(grid.n - 2, Math.floor(gy)));
  const fx = gx - x0, fy = gy - y0;
  const v = grid.values;
  return v[y0][x0] * (1 - fx) * (1 - fy) + v[y0][x0 + 1] * fx * (1 - fy) + v[y0 + 1][x0] * (1 - fx) * fy + v[y0 + 1][x0 + 1] * fx * fy;
}
