"""Could SPHEREx see Planet Nine?  Two honest calculations.

1. Brightness of a hypothetical planet (reflected sunlight, V band) from the
   standard absolute-magnitude relation used for small bodies:
       H = 5 log10(1329 km / (D_km * sqrt(p_V)))
       V = H + 5 log10(r * Delta)   (phase angle ~0 at opposition)
   compared with the approximate SPHEREx per-channel depth (config).
   Thermal emission: a ~40-50 K body peaks at ~60-70 µm, so SPHEREx's
   0.75-5 µm bands see essentially reflected light only unless atmospheric
   models with methane depletion and 3-5 µm excess apply (Fortney+2016).
2. Injection-recovery: insert PSF-shaped sources at a grid of magnitudes into
   a REAL cutout and run our detector, giving a measured completeness curve.
"""
from __future__ import annotations

import dataclasses

import numpy as np

from ..config import settings
from ..core.fits_tools import SpectralImage
from .movers import detect_sources

R_EARTH_KM = 6371.0


def planet_brightness(mass_earth: float = 7.0, radius_earth: float | None = None,
                      albedo: float = 0.4, distance_au: float = 600.0) -> dict:
    # Mass-radius for ice giants / super-Earths is uncertain; use a simple
    # power-law R ~ M^0.5 (Earth radii) when radius isn't supplied.
    r_e = radius_earth or mass_earth ** 0.5
    d_km = 2 * r_e * R_EARTH_KM
    H = 5 * np.log10(1329.0 / (d_km * np.sqrt(albedo)))
    V = H + 5 * np.log10(distance_au * (distance_au - 1))
    # A neutral reflector has V-J ~ +1.0 (solar colours), so J_AB ~ V + 0.1
    j_ab = V + 0.1
    parallax_amp = 206265.0 / distance_au  # arcsec, annual peak amplitude
    depth = settings.survey_depth_ab
    return {
        "inputs": {"mass_earth": mass_earth, "radius_earth": round(r_e, 2), "albedo": albedo,
                   "distance_au": distance_au},
        "H_mag": round(float(H), 2), "V_mag": round(float(V), 2), "J_AB_approx": round(float(j_ab), 2),
        "spherex_depth_ab_approx": depth,
        "margin_mag": round(float(depth - j_ab), 2),
        "detectable_in_single_exposure": bool(j_ab < depth),
        "annual_parallax_arcsec": round(float(parallax_amp), 1),
        "parallax_in_spherex_pixels": round(float(parallax_amp / settings.pixel_scale_arcsec), 1),
        "orbital_motion_arcsec_per_yr_approx": round(float(360 * 3600 / (distance_au ** 1.5)), 2),
        "notes": [
            "Reflected-light estimate at opposition, phase angle 0; thermal emission negligible at <5 µm for ~40 K.",
            "SPHEREx depth is an approximate per-channel 5-sigma value; coadding channels/epochs helps by ~1-2 mag.",
            "Brown & Batygin (2021) predict V of about 22 to 25 for most of the allowed orbits. Searches of ZTF, DES and Pan-STARRS data together rule out about 78% of them (Brown, Holman & Batygin 2024).",
        ],
    }


def injection_recovery(si: SpectralImage, mags_ab: list[float] | None = None, n_per_mag: int = 20,
                       seed: int = 1, fwhm_px: float = 1.6) -> dict:
    mags = mags_ab or [15, 16, 17, 18, 18.5, 19, 19.5, 20, 21]
    rng = np.random.default_rng(seed)
    ny, nx = si.shape
    pix_sr = (settings.pixel_scale_arcsec / 206265.0) ** 2
    sig_px = fwhm_px / 2.3548
    # Work on a private copy: the image in memory is shared by every other request for this field.
    base = np.nan_to_num(si.image.astype(np.float32), nan=0.0)
    work = dataclasses.replace(si, image=base.copy())
    yy, xx = np.mgrid[0:ny, 0:nx]
    out = []
    for m in mags:
        flux_jy = 3631.0 * 10 ** (-0.4 * m)
        total_mjysr_px = flux_jy / 1e6 / pix_sr  # integrated MJy/sr * px
        amp = total_mjysr_px / (2 * np.pi * sig_px**2)
        recovered = 0
        for _ in range(n_per_mag):
            x0, y0 = rng.uniform(6, nx - 6), rng.uniform(6, ny - 6)
            work.image = base + (amp * np.exp(-((xx - x0) ** 2 + (yy - y0) ** 2) / (2 * sig_px**2))).astype(base.dtype)
            dets = detect_sources(work, 0, settings.detect_threshold_sigma, fwhm_px)
            if any(np.hypot(d.x - x0, d.y - y0) <= 1.5 for d in dets):
                recovered += 1
        out.append({"ab_mag": m, "completeness": recovered / n_per_mag})
    # 50% completeness depth by linear interpolation
    depth50 = None
    for a, b in zip(out, out[1:]):
        if a["completeness"] >= 0.5 > b["completeness"]:
            depth50 = a["ab_mag"] + (a["completeness"] - 0.5) / (a["completeness"] - b["completeness"]) * (b["ab_mag"] - a["ab_mag"])
            break
    return {"curve": out, "depth_50pct_ab": round(depth50, 2) if depth50 is not None else None,
            "is_synthetic": si.is_synthetic, "n_per_mag": n_per_mag,
            "method": "Gaussian PSF injection into the cutout, DAOStarFinder recovery within 1.5 px"}
