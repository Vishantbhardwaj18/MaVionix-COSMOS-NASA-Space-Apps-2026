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
from itertools import combinations

import numpy as np
from astropy.coordinates import SkyCoord
from astropy import units as u
from photutils.detection import DAOStarFinder

from ..core.fits_tools import SpectralImage, background_subtracted, noise_sigma


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
    world = si.wcs.pixel_to_world(xs, ys)
    out = []
    for i in range(len(xs)):
        xi, yi = int(round(xs[i])), int(round(ys[i]))
        flagged = False
        if si.flags is not None:
            y0, y1 = max(0, yi - 1), min(si.shape[0], yi + 2)
            x0, x1 = max(0, xi - 1), min(si.shape[1], xi + 2)
            flagged = bool(np.any(si.flags[y0:y1, x0:x1] != 0))
        peak = float(tbl["peak"][i])
        out.append(Detection(
            epoch_index=epoch_index, x=float(xs[i]), y=float(ys[i]),
            ra=float(world[i].ra.deg), dec=float(world[i].dec.deg),
            flux=float(tbl["flux"][i]), snr=peak / sigma if sigma > 0 else 0.0,
            flagged=flagged, mjd=si.mjd,
        ))
    return out


def _sep_arcsec(a: Detection, b: Detection) -> float:
    return float(SkyCoord(a.ra, a.dec, unit="deg").separation(SkyCoord(b.ra, b.dec, unit="deg")).arcsec)


def find_movers(images: list[SpectralImage], *, threshold_sigma: float = 5.0,
                static_tol_arcsec: float = 9.0, max_rate_arcsec_per_day: float = 400.0,
                min_motion_arcsec: float = 9.0) -> tuple[list[Candidate], dict]:
    """Return (candidates, diagnostics)."""
    per_epoch = [detect_sources(si, k, threshold_sigma) for k, si in enumerate(images)]
    all_dets = [d for lst in per_epoch for d in lst]
    diag = {"n_epochs": len(images), "n_detections_per_epoch": [len(l) for l in per_epoch]}

    # Static sources: appear in >=2 epochs at same position
    static_flags = []
    for k, lst in enumerate(per_epoch):
        for d in lst:
            present_elsewhere = any(
                _sep_arcsec(d, o) <= static_tol_arcsec
                for j, other in enumerate(per_epoch) if j != k for o in other
            )
            static_flags.append((d, present_elsewhere))
    transients = [d for d, static in static_flags if not static]
    diag["n_transient_detections"] = len(transients)

    # Link transients across epochs
    cands: list[Candidate] = []
    used: set[int] = set()
    trans_idx = list(range(len(transients)))
    pairs = []
    for i, j in combinations(trans_idx, 2):
        a, b = transients[i], transients[j]
        if a.epoch_index == b.epoch_index or a.mjd is None or b.mjd is None:
            continue
        dt = abs(b.mjd - a.mjd)
        if dt <= 0:
            continue
        sep = _sep_arcsec(a, b)
        rate = sep / dt
        if sep >= min_motion_arcsec and rate <= max_rate_arcsec_per_day:
            pairs.append((rate, i, j, sep))
    pairs.sort()
    for rate, i, j, sep in pairs:
        if i in used or j in used:
            continue
        a, b = sorted([transients[i], transients[j]], key=lambda d: d.mjd)
        chain = [a, b]
        # try to extend with a third+ epoch consistent in direction
        for k in trans_idx:
            if k in (i, j) or k in used:
                continue
            c = transients[k]
            if c.mjd is None or any(c.epoch_index == d.epoch_index for d in chain):
                continue
            pred = _predict(chain, c.mjd)
            if pred is not None and _sep_arcsec(pred, c) <= 3 * static_tol_arcsec:
                chain.append(c)
                used.add(k)
        used.update({i, j})
        chain.sort(key=lambda d: d.mjd)
        cands.append(_make_candidate(chain, len(cands)))
    cands.sort(key=lambda c: -c.score)
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
    sep = float(c1.separation(c2).arcsec)
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
