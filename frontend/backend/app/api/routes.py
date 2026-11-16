from __future__ import annotations

import base64
import csv
import io
import json
import time

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import settings
from ..core import service
from ..core.fits_tools import background_subtracted, noise_sigma
from ..core.render import asinh_stretch, diverging_stretch, reproject_to, to_png_b64
from ..science import detectability, jpl, movers, spectrum

router = APIRouter(prefix="/api")

SPHEREX_ACK = ("This product makes use of data from the Spectro-Photometer for the History of the "
               "Universe, Epoch of Reionization and Ices Explorer (SPHEREx), a joint project of JPL and "
               "Caltech funded by NASA, served by the NASA/IPAC Infrared Science Archive.")

SHOWCASE = [
    {"name": "North Ecliptic Pole (SPHEREx deep field)", "ra": 270.0, "dec": 66.56,
     "why": "SPHEREx revisits the ecliptic poles on almost every orbit, so this field has the most epochs."},
    {"name": "South Ecliptic Pole (SPHEREx deep field)", "ra": 90.0, "dec": -66.56,
     "why": "Second deep field; dozens of epochs within months."},
    {"name": "Ecliptic field near opposition (asteroid-rich)", "ra": 45.0, "dec": 15.0,
     "why": "Main-belt asteroids move tens of arcsec per hour; easy movers."},
    {"name": "Galactic anticentre (low confusion)", "ra": 86.0, "dec": 28.9,
     "why": "Clean star field for variable-star blinking."},
]


def _frame_payload(si, img):
    """Quantised pixels + WCS + wavelength grid for client-side rendering."""
    finite = np.isfinite(img)
    lo, hi = (np.percentile(img[finite], [0.5, 99.95]) if finite.any() else (0.0, 1.0))
    if hi <= lo:
        hi = lo + 1e-6
    q = np.clip((img - lo) / (hi - lo), 0, 1)
    q[~finite] = 0
    data16 = (q * 65535).astype("<u2")
    w = si.wcs.wcs
    cd = w.cd if w.has_cd() else np.diag(w.cdelt) @ w.get_pc()
    wcs = {"crpix": [float(w.crpix[0]), float(w.crpix[1])], "crval": [float(w.crval[0]), float(w.crval[1])],
           "cd": [[float(cd[0, 0]), float(cd[0, 1])], [float(cd[1, 0]), float(cd[1, 1])]],
           "ctype": [str(w.ctype[0]), str(w.ctype[1])]}
    grid = None
    if si.wave is not None:
        n = 16
        ys = np.linspace(0, si.shape[0] - 1, n).astype(int)
        xs = np.linspace(0, si.shape[1] - 1, n).astype(int)
        grid = {"n": n, "values": [[float(si.wave[y, x]) for x in xs] for y in ys]}
    return {"data16": base64.b64encode(data16.tobytes()).decode(), "vmin": float(lo), "vmax": float(hi),
            "wcs": wcs, "wave_grid": grid}


def _field(target: str | None, ra: float | None, dec: float | None, size: float | None, synthetic: bool):
    if target:
        try:
            ra, dec, how = service.resolve_target(target)
        except Exception as exc:
            raise HTTPException(400, f"Could not resolve target '{target}': {exc}")
    if ra is None or dec is None:
        raise HTTPException(400, "Provide target=<name|ra,dec> or ra & dec")
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(400, "ra must be in [0,360), dec in [-90,90]")
    return service.get_field(ra, dec, size, force_synthetic=synthetic)


@router.get("/health")
def health():
    return {"ok": True, "mode": settings.mode, "collections": settings.spherex_collections.split(","),
            "pixel_scale_arcsec": settings.pixel_scale_arcsec, "acknowledgement": SPHEREX_ACK}


<<<<<<< HEAD
_status_cache: dict = {"t": 0.0, "value": None}


def _probe(url: str, params: dict) -> dict:
    """One short request to an upstream service; never raises."""
    import httpx
    t0 = time.perf_counter()
    try:
        r = httpx.get(url, params=params, timeout=8.0, follow_redirects=True)
        ok = r.status_code < 400
        return {"ok": ok, "http": r.status_code, "ms": round((time.perf_counter() - t0) * 1000)}
    except Exception as e:  # noqa: BLE001 - report any failure as "unreachable"
        return {"ok": False, "error": type(e).__name__, "ms": round((time.perf_counter() - t0) * 1000)}


@router.get("/status")
def status():
    """Can this server reach the archives right now? Cached for two minutes.

    The web header uses this to tell visitors, before they search, whether they
    will see SPHEREx data or the labelled synthetic sample.
    """
    now = time.time()
    if _status_cache["value"] is not None and now - _status_cache["t"] < 120:
        return _status_cache["value"]
    if settings.mode == "demo":
        value = {"mode": "demo", "irsa": None, "jpl": None, "serving": "synthetic",
                 "message": "Sample mode: the server is configured to serve the labelled synthetic sample only."}
    else:
        first = settings.spherex_collections.split(",")[0].strip()
        irsa_p = _probe(settings.irsa_sia_url, {"COLLECTION": first, "POS": "circle 270 66.56 0.01", "MAXREC": 1})
        jpl_p = _probe(settings.jpl_sbdb_query_url, {"fields": "full_name", "sb-kind": "a", "limit": 1})
        serving = "spherex" if irsa_p["ok"] else ("synthetic" if settings.allow_synthetic_fallback else "none")
        msg = ("The SPHEREx archive is answering." if irsa_p["ok"] else
               "The SPHEREx archive is not answering from this server; searches will show the labelled synthetic sample."
               if settings.allow_synthetic_fallback else
               "The SPHEREx archive is not answering from this server.")
        value = {"mode": "live", "irsa": irsa_p, "jpl": jpl_p, "serving": serving, "message": msg}
    value["checked_unix"] = int(now)
    _status_cache.update(t=now, value=value)
    return value


=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
@router.get("/showcase")
def showcase():
    return {"fields": SHOWCASE}


@router.get("/sky/epochs")
def sky_epochs(target: str | None = None, ra: float | None = None, dec: float | None = None,
               size: float | None = Query(None, le=3000), synthetic: bool = False):
    t0 = time.time()
    f = _field(target, ra, dec, size, synthetic)
    frames = []
    for k, (meta, si) in enumerate(zip(f.epochs, f.images)):
        img = background_subtracted(si)
        cx, cy = si.shape[1] / 2, si.shape[0] / 2
        lam, bw, lsrc = si.wavelength_at(cx, cy)
        frames.append({
            "index": k, **meta,
            "mjd": si.mjd if si.mjd is not None else meta.get("mjd"),
            "detector": si.detector, "shape": list(si.shape),
            "wavelength_um_at_centre": lam, "bandwidth_um": bw, "wavelength_source": lsrc,
            "png": to_png_b64(asinh_stretch(img), upscale=2),
            "noise_sigma": noise_sigma(si, img), "is_synthetic": si.is_synthetic, "notes": si.notes,
            **_frame_payload(si, img),
        })
    return {"ra": f.ra, "dec": f.dec, "source": f.source, "warnings": f.warnings, "frames": frames,
            "same_band_pairs": service.pairs_same_band(f), "elapsed_s": round(time.time() - t0, 2),
            "acknowledgement": SPHEREX_ACK}


@router.get("/sky/diff")
def sky_diff(a: int, b: int, target: str | None = None, ra: float | None = None, dec: float | None = None,
             size: float | None = None, synthetic: bool = False):
    f = _field(target, ra, dec, size, synthetic)
    if not (0 <= a < len(f.images) and 0 <= b < len(f.images)):
        raise HTTPException(400, "epoch index out of range")
    A, B = f.images[a], f.images[b]
    ia, ib = background_subtracted(A), background_subtracted(B)
    ib_on_a = reproject_to(B, ib, A)
    diff = ib_on_a - ia
    sig = float(np.sqrt(noise_sigma(A, ia) ** 2 + noise_sigma(B, ib) ** 2))
    la, _, _ = A.wavelength_at(A.shape[1] / 2, A.shape[0] / 2)
    lb, _, _ = B.wavelength_at(B.shape[1] / 2, B.shape[0] / 2)
    warn = []
    if la is not None and lb is not None and abs(la - lb) > 0.25:
        warn.append(f"Epochs sample different wavelengths ({la:.2f} vs {lb:.2f} µm): colour terms will leave residuals on stars.")
    z = np.clip(diff / (6 * sig), -1, 1)
    z[~np.isfinite(z)] = 0
    data16 = ((z + 1) / 2 * 65535).astype("<u2")
    return {"a": a, "b": b, "sigma": sig, "png": to_png_b64(diverging_stretch(diff, sig), upscale=2),
            "data16": base64.b64encode(data16.tobytes()).decode(), "shape": list(A.shape), "span_sigma": 6,
            "warnings": warn, "is_synthetic": A.is_synthetic or B.is_synthetic,
            "positive_means": "brighter in epoch B (red); negative = brighter in epoch A (blue)"}


@router.get("/sky/known")
def sky_known(epoch: int, target: str | None = None, ra: float | None = None, dec: float | None = None,
              size: float | None = None, synthetic: bool = False):
    """Known small bodies (JPL SBIdent) predicted inside one epoch's cutout, in pixel coordinates."""
    f = _field(target, ra, dec, size, synthetic)
    if not (0 <= epoch < len(f.images)):
        raise HTTPException(400, "epoch out of range")
    si = f.images[epoch]
    if f.source != "irsa" or si.mjd is None:
        return {"epoch": epoch, "objects": [], "note": "JPL lookup is skipped for synthetic data"}
    half = (size or settings.cutout_size_arcsec) / 3600.0 / 2 * 1.2
    try:
        bodies = jpl.sbident(f.ra, f.dec, si.mjd, half)
    except Exception as exc:
        raise HTTPException(503, f"JPL SBIdent unavailable: {type(exc).__name__}")
    from astropy.coordinates import SkyCoord
    from astropy import units as u
    out = []
    for b in bodies:
        try:
            sc = SkyCoord(b["ra_str"], b["dec_str"], unit=(u.hourangle, u.deg))
            x, y = si.wcs.world_to_pixel_values(sc.ra.deg, sc.dec.deg)
        except Exception:
            continue
        if 0 <= x < si.shape[1] and 0 <= y < si.shape[0]:
            out.append({"name": b["name"], "x": float(x), "y": float(y), "ra": float(sc.ra.deg),
                        "dec": float(sc.dec.deg), "vmag": b["vmag"]})
    return {"epoch": epoch, "mjd": si.mjd, "objects": out}


@router.get("/movers")
def get_movers(target: str | None = None, ra: float | None = None, dec: float | None = None,
               size: float | None = None, synthetic: bool = False, match_jpl: bool = True,
               threshold: float = Query(None, ge=3, le=20)):
    f = _field(target, ra, dec, size, synthetic)
    cands, diag = movers.find_movers(f.images, threshold_sigma=threshold or settings.detect_threshold_sigma)
    if match_jpl and f.source == "irsa":
        jpl.match_candidates(cands)
    elif match_jpl:
        for c in cands:
            c.reasons.append("JPL matching skipped for synthetic data")
    out = []
    for c in cands:
        d = c.to_dict()
        if c.rate_arcsec_per_day and len(c.detections) >= 2:
            dt = c.detections[-1].mjd - c.detections[0].mjd
            d["distance_hint"] = movers.heliocentric_distance_from_parallax(c.rate_arcsec_per_day, dt)
        # evidence thumbnails: 15x15 px around each detection
        thumbs = []
        for det in c.detections:
            si = f.images[det.epoch_index]
            img = background_subtracted(si)
            x, y = int(round(det.x)), int(round(det.y))
            r = 7
            sub = img[max(0, y - r): y + r + 1, max(0, x - r): x + r + 1]
            thumbs.append({"epoch_index": det.epoch_index, "png": to_png_b64(asinh_stretch(sub), upscale=8)})
        d["thumbnails"] = thumbs
        out.append(d)
    return {"ra": f.ra, "dec": f.dec, "source": f.source, "warnings": f.warnings, "diagnostics": diag,
            "candidates": out, "disclaimer": "Unmatched candidates are not discoveries: they may be "
            "uncatalogued objects, image artefacts, or ephemeris mismatches. Independent follow-up is required."}


@router.get("/spectrum")
def get_spectrum(ra_src: float, dec_src: float, target: str | None = None, ra: float | None = None,
                 dec: float | None = None, size: float | None = None, synthetic: bool = False,
                 track: str | None = None):
    """Forced photometry at (ra_src, dec_src) in every epoch. If `track` is a
    JSON list of {epoch_index, ra, dec}, photometry follows the moving object."""
    f = _field(target, ra, dec, size, synthetic)
    pos = {k: (ra_src, dec_src) for k in range(len(f.images))}
    if track:
        for t in json.loads(track):
            pos[int(t["epoch_index"])] = (float(t["ra"]), float(t["dec"]))
    pts = []
    for k, si in enumerate(f.images):
        r, d = pos[k]
        p = spectrum.forced_photometry(si, r, d)
        if p:
            p["epoch_index"] = k
            pts.append(p)
    pts.sort(key=lambda p: (p["wavelength_um"] or 0))
    return {"points": pts, "classification": spectrum.classify(pts), "source": f.source,
            "warnings": f.warnings, "units": "flux_jy = Jy; ab_mag = AB magnitudes; wavelength_um = microns"}


@router.get("/planetx/tnos")
def planetx_tnos(a_min: float = 30.0):
    try:
        rows = jpl.tno_elements(a_min)
        return {"source": "JPL SBDB", "n": len(rows), "objects": rows}
    except Exception as exc:
        raise HTTPException(503, f"JPL SBDB unavailable: {type(exc).__name__}")


@router.get("/planetx/brightness")
def planetx_brightness(mass_earth: float = 7.0, albedo: float = 0.4, distance_au: float = 600.0,
                       radius_earth: float | None = None):
    return detectability.planet_brightness(mass_earth, radius_earth, albedo, distance_au)


@router.get("/planetx/injection")
def planetx_injection(target: str | None = None, ra: float | None = None, dec: float | None = None,
                      epoch: int = 0, synthetic: bool = False, n_per_mag: int = Query(12, le=40)):
    f = _field(target, ra, dec, None, synthetic)
    if not (0 <= epoch < len(f.images)):
        raise HTTPException(400, "epoch out of range")
    return detectability.injection_recovery(f.images[epoch], n_per_mag=n_per_mag)


@router.get("/report.csv")
def report_csv(target: str | None = None, ra: float | None = None, dec: float | None = None,
               synthetic: bool = False):
    f = _field(target, ra, dec, None, synthetic)
    cands, _ = movers.find_movers(f.images)
    if f.source == "irsa":
        jpl.match_candidates(cands)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# MaVionix COSMOS mover report", f"ra={f.ra}", f"dec={f.dec}", f"source={f.source}"])
    w.writerow(["# " + SPHEREX_ACK])
    w.writerow(["candidate", "status", "match", "epoch_index", "mjd", "ra", "dec", "snr", "flagged",
                "rate_arcsec_per_day", "pa_deg", "score"])
    for c in cands:
        for d in c.detections:
            w.writerow([c.id, c.status, (c.match or {}).get("name", ""), d.epoch_index, d.mjd, f"{d.ra:.6f}",
                        f"{d.dec:.6f}", f"{d.snr:.1f}", d.flagged, c.rate_arcsec_per_day, c.pa_deg, c.score])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=cosmos_report.csv"})
