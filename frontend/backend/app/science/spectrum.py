"""Spectral fingerprint of a (moving or static) source from SPHEREx epochs.

SPHEREx uses linear-variable filters: the wavelength a pixel sees depends on
where it is on the detector. So every epoch (and every detector) in which a
source appears samples a DIFFERENT wavelength. Stacking forced aperture
photometry over all epochs yields a sparse 0.75-5.0 µm spectrum.

Units: IMAGE is in MJy/sr. For a point source we sum over an aperture and
multiply by the pixel solid angle to get flux density in Jy, then AB mag.
Templates are deliberately simple and labelled "indicative" in the API.
"""
from __future__ import annotations

import numpy as np
from photutils.aperture import CircularAperture, CircularAnnulus, aperture_photometry

from ..core.fits_tools import SpectralImage, background_subtracted, noise_sigma

PIXEL_SR = (6.15 / 206265.0) ** 2  # steradian per SPHEREx pixel


def forced_photometry(si: SpectralImage, ra: float, dec: float, r_px: float = 2.5) -> dict | None:
    x, y = si.wcs.world_to_pixel_values(ra, dec)
    x, y = float(x), float(y)
    ny, nx = si.shape
    if not (r_px * 2 <= x < nx - r_px * 2 and r_px * 2 <= y < ny - r_px * 2):
        return None
    img = background_subtracted(si, subtract_zodi=True)
    ap = CircularAperture((x, y), r=r_px)
    ann = CircularAnnulus((x, y), r_in=r_px + 2, r_out=r_px + 5)
    t = aperture_photometry(img, [ap, ann])
    sky_per_px = float(t["aperture_sum_1"][0]) / ann.area
    net = float(t["aperture_sum_0"][0]) - sky_per_px * ap.area  # MJy/sr * px
    sig = noise_sigma(si, img) * np.sqrt(ap.area)
    flux_jy = net * 1e6 * PIXEL_SR
    err_jy = sig * 1e6 * PIXEL_SR
    lam, bw, src = si.wavelength_at(x, y)
    ab = -2.5 * np.log10(flux_jy / 3631.0) if flux_jy > 0 else None
    return {
        "x": x, "y": y, "mjd": si.mjd, "detector": si.detector,
        "wavelength_um": lam, "bandwidth_um": bw, "wavelength_source": src,
        "flux_jy": flux_jy, "flux_err_jy": err_jy, "ab_mag": ab,
        "snr": net / sig if sig > 0 else None, "is_synthetic": si.is_synthetic,
    }


# ---------------------------------------------------------------- templates
def _planck_fnu(lam_um: np.ndarray, T: float) -> np.ndarray:
    h, c, k = 6.626e-34, 2.998e8, 1.381e-23
    nu = c / (lam_um * 1e-6)
    x = h * nu / (k * T)
    return nu**3 / np.expm1(np.clip(x, 1e-6, 700))


def templates(lam_um: np.ndarray) -> dict[str, np.ndarray]:
    """Normalised F_nu shapes. Indicative only (no real spectral libraries)."""
    solar = _planck_fnu(lam_um, 5772.0)
    out = {
        "solar-reflectance (neutral asteroid/TNO)": solar,
        # water ice: broad absorption near 3.1 µm plus 1.5/2.0 µm dips on a solar continuum
        "icy surface (H2O ice features)": solar * (1 - 0.6 * np.exp(-((lam_um - 3.1) / 0.25) ** 2)
                                                  - 0.2 * np.exp(-((lam_um - 2.0) / 0.08) ** 2)
                                                  - 0.15 * np.exp(-((lam_um - 1.5) / 0.08) ** 2)),
        "red (organic-rich) TNO": solar * (lam_um / 1.0) ** 0.8,
        "cool star / M dwarf (3300 K)": _planck_fnu(lam_um, 3300.0),
        "brown dwarf-like (1200 K)": _planck_fnu(lam_um, 1200.0),
    }
    return {k: v / np.nanmax(v) for k, v in out.items()}


def classify(points: list[dict]) -> dict:
    pts = [p for p in points if p and p["wavelength_um"] is not None and p["flux_jy"] > 0]
    if len(pts) < 3:
        return {"best": None, "chi2": {}, "note": "need >=3 positive-flux points with wavelengths"}
    lam = np.array([p["wavelength_um"] for p in pts])
    f = np.array([p["flux_jy"] for p in pts])
    e = np.array([max(p["flux_err_jy"], 1e-12) for p in pts])
    chi = {}
    for name, shape in templates(lam).items():
        # best-fit scale factor (weighted least squares)
        s = np.sum(f * shape / e**2) / np.sum(shape**2 / e**2)
        chi[name] = float(np.sum(((f - s * shape) / e) ** 2) / max(len(pts) - 1, 1))
    best = min(chi, key=chi.get)
    return {"best": best, "chi2_reduced": chi, "n_points": len(pts),
            "note": "indicative template comparison; not a spectral classification"}
