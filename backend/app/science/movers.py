"""Explainable moving-object detection across SPHEREx epochs.

Method (deliberately classical and inspectable, see docs/METHODOLOGY.md):
 1. Background-subtract each epoch (zodi model + robust median).
 2. Detect point sources with DAOStarFinder at k-sigma using the VARIANCE map.
 3. Convert detections to sky coordinates with the WCS (works across detectors
    and across differently-oriented pointings).
 4. A source present in epoch B with no counterpart in epoch A within
    `static_tol` arcsec (and vice-versa) is a "transient" detection.
 5. Transient detections in different epochs are linked if their implied
    rate of motion is physically plausible (<= max_rate arcsec/day) and
    consistent in direction when 3+ epochs exist.
 6. Each candidate gets an evidence record: per-epoch cutout positions,
    SNR, flags under the source, motion vector, and (later) JPL match.

Nothing here claims discovery: an unmatched candidate is "unmatched", which
may mean uncatalogued, an artefact, or an ephemeris mismatch.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict

import numpy as np
from astropy.coordinates import SkyCoord
from astropy import units as u
from photutils.detection import DAOStarFinder

from ..core.fits_tools import SpectralImage, background_subtracted, noise_sigma, valid_mask


@dataclass
class Detection:
    epoch_index: int
    x: float
    y: float
    ra: float
    dec: float
    flux: float
    snr: float
    flagged: bool
    mjd: float | None


@dataclass
class Candidate:
    id: str
    detections: list[Detection]
    rate_arcsec_per_day: float | None
    pa_deg: float | None
    total_motion_arcsec: float
    score: float
    status: str = "unmatched"          # unmatched | known | artefact
    match: dict | None = None
    reasons: list[str] = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d


def detect_sources(si: SpectralImage, epoch_index: int, threshold_sigma: float = 5.0,
                   fwhm_px: float = 1.6) -> list[Detection]:
    img = background_subtracted(si)
    sigma = noise_sigma(si, img)
    finder = DAOStarFinder(fwhm=fwhm_px, threshold=threshold_sigma * sigma, exclude_border=True)
    tbl = finder(img)
    if tbl is None or len(tbl) == 0:
        return []
    xcol = "x_centroid" if "x_centroid" in tbl.colnames else "xcentroid"
    ycol = "y_centroid" if "y_centroid" in tbl.colnames else "ycentroid"
    xs = np.asarray(tbl[xcol], dtype=float)
    ys = np.asarray(tbl[ycol], dtype=float)
    world_ra, world_dec = si.wcs.pixel_to_world_values(xs, ys)
    world_ra, world_dec = np.atleast_1d(world_ra), np.atleast_1d(world_dec)
    out = []
    ok = valid_mask(si)
    for i in range(len(xs)):
        xi, yi = int(round(xs[i])), int(round(ys[i]))
        if not (0 <= xi < si.shape[1] and 0 <= yi < si.shape[0]):
            continue
        # a peak touching padded pixels is the edge of the data, not a source
        if not ok[max(0, yi - 2): yi + 3, max(0, xi - 2): xi + 3].all():
            continue
        flagged = False
        if si.flags is not None:
            y0, y1 = max(0, yi - 1), min(si.shape[0], yi + 2)
            x0, x1 = max(0, xi - 1), min(si.shape[1], xi + 2)
            flagged = bool(np.any(si.flags[y0:y1, x0:x1] != 0))
        peak = float(tbl["peak"][i])
        out.append(Detection(
            epoch_index=epoch_index, x=float(xs[i]), y=float(ys[i]),
            ra=float(world_ra[i]) % 360.0, dec=float(world_dec[i]),
            flux=float(tbl["flux"][i]), snr=peak / sigma if sigma > 0 else 0.0,
            flagged=flagged, mjd=si.mjd,
        ))
    return out


def _unit(ra_deg, dec_deg) -> np.ndarray:
    ra, dec = np.radians(np.asarray(ra_deg, dtype=float)), np.radians(np.asarray(dec_deg, dtype=float))
    return np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=-1)


def _sep_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Angular separations in arcsec between two sets of unit vectors (chord formula, exact at any size)."""
    d = np.linalg.norm(a[:, None, :] - b[None, :, :], axis=-1)
    return np.degrees(2 * np.arcsin(np.clip(d / 2, 0, 1))) * 3600.0


def _sep_arcsec(a: Detection, b: Detection) -> float:
    return float(_sep_matrix(_unit([a.ra], [a.dec]), _unit([b.ra], [b.dec]))[0, 0])


MAX_DETECTIONS_PER_EPOCH = 600      # brightest kept; a crowded field must not stall the search
MAX_TRANSIENTS = 1500
MAX_CANDIDATES = 40


def find_movers(images: list[SpectralImage], *, threshold_sigma: float = 5.0,
                static_tol_arcsec: float = 9.0, max_rate_arcsec_per_day: float = 400.0,
                min_motion_arcsec: float = 9.0) -> tuple[list[Candidate], dict]:
    """Return (candidates, diagnostics)."""
    per_epoch = []
    for k, si in enumerate(images):
        dets = detect_sources(si, k, threshold_sigma)
        if len(dets) > MAX_DETECTIONS_PER_EPOCH:
            dets = sorted(dets, key=lambda d: -d.snr)[:MAX_DETECTIONS_PER_EPOCH]
        per_epoch.append(dets)
    diag: dict = {"n_epochs": len(images), "n_detections_per_epoch": [len(l) for l in per_epoch]}

    # Static sources: a detection with a counterpart at the same sky position in any other epoch.
    vecs = [_unit([d.ra for d in lst], [d.dec for d in lst]) if lst else np.zeros((0, 3)) for lst in per_epoch]
    transients: list[Detection] = []
    for k, lst in enumerate(per_epoch):
        if not lst:
            continue
        others = [v for j, v in enumerate(vecs) if j != k and len(v)]
        if others:
            static = (_sep_matrix(vecs[k], np.concatenate(others)) <= static_tol_arcsec).any(axis=1)
        else:
            static = np.zeros(len(lst), dtype=bool)
        transients.extend(d for d, s in zip(lst, static) if not s and d.mjd is not None)
    if len(transients) > MAX_TRANSIENTS:
        transients = sorted(transients, key=lambda d: -d.snr)[:MAX_TRANSIENTS]
        diag["note"] = f"Only the {MAX_TRANSIENTS} brightest single-visit detections were linked."
    diag["n_transient_detections"] = len(transients)

    cands: list[Candidate] = []
    n_t = len(transients)
    # With three or more visits a real mover should be confirmed by a third point on the same
    # line; two unrelated noise peaks can always be joined by some straight line.
    n_dated = len({si.mjd for si in images if si.mjd is not None})
    min_len = 3 if n_dated >= 3 else 2
    diag["min_detections_per_track"] = min_len
    if n_t >= 2:
        tv = _unit([d.ra for d in transients], [d.dec for d in transients])
        sep = _sep_matrix(tv, tv)
        mjd = np.array([d.mjd for d in transients], dtype=float)
        ep = np.array([d.epoch_index for d in transients])
        dt = np.abs(mjd[:, None] - mjd[None, :])
        with np.errstate(divide="ignore", invalid="ignore"):
            rate = np.where(dt > 0, sep / dt, np.inf)
        ok = (ep[:, None] != ep[None, :]) & (dt > 0) & (sep >= min_motion_arcsec) & (rate <= max_rate_arcsec_per_day)
        ii, jj = np.where(np.triu(ok, 1))
        order = np.argsort(rate[ii, jj], kind="stable")
        used: set[int] = set()
        for i, j in zip(ii[order].tolist(), jj[order].tolist()):
            if i in used or j in used:
                continue
            a, b = sorted([transients[i], transients[j]], key=lambda d: d.mjd)
            chain = [a, b]
            members = [i, j]
            for k in range(n_t):
                if k in used or k in members:
                    continue
                c = transients[k]
                if any(c.epoch_index == d.epoch_index for d in chain):
                    continue
                pred = _predict(chain, c.mjd)
                if pred is not None and _sep_arcsec(pred, c) <= 3 * static_tol_arcsec:
                    chain.append(c)
                    members.append(k)
            if len(chain) < min_len:
                continue
            used.update(members)
            chain.sort(key=lambda d: d.mjd)
            cands.append(_make_candidate(chain, len(cands)))
    cands.sort(key=lambda c: -c.score)
    if len(cands) > MAX_CANDIDATES:
        diag["note_candidates"] = f"{len(cands)} tracks found; the {MAX_CANDIDATES} strongest are listed."
        cands = cands[:MAX_CANDIDATES]
    for n, c in enumerate(cands):
        c.id = f"cand-{n:03d}"
    diag["n_candidates"] = len(cands)
    return cands, diag


def _predict(chain: list[Detection], mjd: float) -> Detection | None:
    a, b = chain[0], chain[-1]
    if b.mjd == a.mjd:
        return None
    f = (mjd - a.mjd) / (b.mjd - a.mjd)
    return Detection(-1, 0, 0, a.ra + f * (b.ra - a.ra), a.dec + f * (b.dec - a.dec), 0, 0, False, mjd)


def _make_candidate(chain: list[Detection], n: int) -> Candidate:
    a, b = chain[0], chain[-1]
    c1, c2 = SkyCoord(a.ra, a.dec, unit="deg"), SkyCoord(b.ra, b.dec, unit="deg")
    sep = _sep_arcsec(a, b)
    dt = (b.mjd - a.mjd) if (a.mjd is not None and b.mjd is not None) else None
    rate = sep / dt if dt else None
    pa = float(c1.position_angle(c2).deg)
    snr = float(np.mean([d.snr for d in chain]))
    reasons = [f"{len(chain)} epochs linked", f"mean SNR {snr:.1f}", f"moved {sep:.0f}\" over {dt:.0f} d" if dt else "no timing"]
    flagged = any(d.flagged for d in chain)
    if flagged:
        reasons.append("warning: flagged pixels under at least one detection")
    score = min(1.0, (len(chain) - 1) * 0.3 + min(snr, 20) / 40) * (0.6 if flagged else 1.0)
    return Candidate(id=f"cand-{n:03d}", detections=chain, rate_arcsec_per_day=rate, pa_deg=pa,
                     total_motion_arcsec=sep, score=round(score, 3), reasons=reasons)


def heliocentric_distance_from_parallax(rate_arcsec_per_day: float, dt_days: float) -> dict:
    """Very rough distance scale from apparent motion, assuming the motion is
    dominated by Earth's reflex parallax (true for distant TNOs near
    opposition). Returned as an ORDER-OF-MAGNITUDE indicator only.

    Parallax amplitude ~ 206265 / d_AU arcsec per AU of baseline; Earth's
    baseline changes ~ 2*sin(pi*dt/365) AU over dt days.
    """
    baseline_au = abs(2 * np.sin(np.pi * dt_days / 365.25))
    total = rate_arcsec_per_day * dt_days
    if total <= 0 or baseline_au <= 0:
        return {"d_au_if_parallax_only": None}
    d_au = 206265.0 * baseline_au / total
    return {"d_au_if_parallax_only": round(float(d_au), 1),
            "caveat": "assumes motion is pure reflex parallax; real objects also move on their orbit"}
