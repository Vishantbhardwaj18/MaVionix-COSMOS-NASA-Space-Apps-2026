// Empty by default: requests go to this site's own /api proxy (src/app/api/[...path]/route.ts).
export const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export type Frame = {
  index: number; obs_id: string; detector: number | null; collection: string; mjd: number | null;
  date_iso: string | null; wavelength_um_at_centre: number | null; bandwidth_um: number | null;
  wavelength_source: string; png: string; noise_sigma: number; is_synthetic: boolean; notes: string[];
  shape: number[]; band_lo_um: number | null; band_hi_um: number | null;
  data16: string; vmin: number; vmax: number;
  wcs: { crpix: [number, number]; crval: [number, number]; cd: [[number, number], [number, number]]; ctype: string[] };
  wave_grid: { n: number; values: number[][] } | null;
};
export type DiffResponse = { a: number; b: number; sigma: number; png: string; data16: string; shape: number[]; span_sigma: number; warnings: string[]; is_synthetic: boolean };
export type KnownResponse = { epoch: number; mjd?: number; objects: { name: string; x: number; y: number; ra: number; dec: number; vmag: string | null }[]; note?: string };
export type EpochsResponse = {
  ra: number; dec: number; source: "irsa" | "synthetic"; warnings: string[]; frames: Frame[];
  same_band_pairs: [number, number][]; elapsed_s: number; acknowledgement: string;
};
export type Detection = { epoch_index: number; x: number; y: number; ra: number; dec: number; flux: number; snr: number; flagged: boolean; mjd: number | null };
export type Candidate = {
  id: string; detections: Detection[]; rate_arcsec_per_day: number | null; pa_deg: number | null;
  total_motion_arcsec: number; score: number; status: string; match: Record<string, unknown> | null;
  reasons: string[]; thumbnails: { epoch_index: number; png: string }[];
  distance_hint?: { d_au_if_parallax_only: number | null; caveat?: string };
};
export type MoversResponse = { ra: number; dec: number; source: string; warnings: string[]; diagnostics: Record<string, unknown>; candidates: Candidate[]; disclaimer: string };
export type SpectrumPoint = { epoch_index: number; mjd: number | null; detector: number | null; wavelength_um: number | null; bandwidth_um: number | null; wavelength_source: string; flux_jy: number; flux_err_jy: number; ab_mag: number | null; snr: number | null; is_synthetic: boolean };
export type SpectrumResponse = { points: SpectrumPoint[]; classification: { best: string | null; chi2_reduced?: Record<string, number>; note: string }; source: string; warnings: string[] };
export type TNO = { name: string; a: number; e: number; i: number; om: number; w: number; q: number; ad: number | null; per_y: number | null; H: number | null };

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  let r: Response;
  try {
    r = await fetch(`${API}${path}${qs ? `?${qs}` : ""}`);
  } catch {
    throw new Error("Could not reach the data server. Check your connection, then try again.");
  }
  if (!r.ok) {
    let msg = r.statusText || `Request failed (${r.status})`;
    try {
      const d = (await r.json()).detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d) && d[0]?.msg) msg = d.map((x: { msg: string }) => x.msg).join("; ");
    } catch { /* not JSON */ }
    throw new Error(msg);
  }
  return r.json();
}

export type ArchiveStatus = { mode: "live" | "demo"; serving: "spherex" | "synthetic" | "none"; message: string; irsa: { ok: boolean; ms: number } | null; jpl: { ok: boolean; ms: number } | null };
export type FieldQuery = { target?: string; ra?: number; dec?: number; synthetic?: boolean };

export const api = {
  status: () => get<ArchiveStatus>("/api/status", {}),
  health: () => get<{ ok: boolean; mode: string }>("/api/health", {}),
  showcase: () => get<{ fields: { name: string; ra: number; dec: number; why: string }[] }>("/api/showcase", {}),
  epochs: (q: FieldQuery) => get<EpochsResponse>("/api/sky/epochs", q),
  diff: (q: FieldQuery, a: number, b: number) => get<DiffResponse>("/api/sky/diff", { ...q, a, b }),
  known: (q: FieldQuery, epoch: number) => get<KnownResponse>("/api/sky/known", { ...q, epoch }),
  movers: (q: FieldQuery) => get<MoversResponse>("/api/movers", q),
  spectrum: (q: FieldQuery, ra_src: number, dec_src: number, track?: string) => get<SpectrumResponse>("/api/spectrum", { ...q, ra_src, dec_src, track }),
  tnos: (a_min = 150) => get<{ n: number; objects: TNO[] }>("/api/planetx/tnos", { a_min }),
  brightness: (p: { mass_earth: number; albedo: number; distance_au: number }) => get<Record<string, unknown>>("/api/planetx/brightness", p),
  injection: (q: FieldQuery) => get<{ curve: { ab_mag: number; completeness: number }[]; depth_50pct_ab: number | null; is_synthetic: boolean; method: string }>("/api/planetx/injection", { ...q, n_per_mag: 8 }),
  reportUrl: (q: FieldQuery) => `${API}/api/report.csv?${Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`,
};

export const mjdToDate = (mjd: number | null) => mjd === null ? "—" : new Date((mjd - 40587) * 86400000).toISOString().slice(0, 10);
