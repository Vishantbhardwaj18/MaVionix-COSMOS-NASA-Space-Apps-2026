"""Synthetic SPHEREx-like cutouts for offline demos and tests.

EVERYTHING produced here carries SYNTHETC=True in the primary header and
is_synthetic=True in API responses. The UI shows a persistent "SYNTHETIC
DATA - NOT SPHEREx" badge whenever it is used. The layout mimics the
documented MEF (IMAGE / FLAGS / VARIANCE / ZODI / WCS-WAVE) so the same code
path is exercised, but the pixels are not observations.
"""
from __future__ import annotations

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

from ..core.fits_tools import BANDS

PIX = 6.15 / 3600.0  # deg


def make_wcs(ra: float, dec: float, n: int) -> WCS:
    w = WCS(naxis=2)
    w.wcs.crpix = [n / 2 + 0.5, n / 2 + 0.5]
    w.wcs.cdelt = [-PIX, PIX]
    w.wcs.crval = [ra, dec]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return w


def gaussian(n: int, x0: float, y0: float, amp: float, fwhm_px: float = 1.6) -> np.ndarray:
    yy, xx = np.mgrid[0:n, 0:n]
    s = fwhm_px / 2.3548
    return amp * np.exp(-((xx - x0) ** 2 + (yy - y0) ** 2) / (2 * s * s))


def synthetic_cutout(ra: float, dec: float, *, n: int = 96, detector: int = 1, mjd: float = 60800.0,
                     seed: int = 0, movers: list[dict] | None = None, stars: int = 25,
                     sky: float = 0.4, noise: float = 0.02) -> bytes:
    """Build a MEF cutout. `movers` = [{"x":..,"y":..,"amp":..}] in pixel coords."""
    rng = np.random.default_rng(seed)
    img = np.full((n, n), sky, dtype=np.float32)
    # Fixed star field, deterministic per sky position so epochs agree
    srng = np.random.default_rng(int(abs(ra * 1000 + dec * 7)) % (2**31))
    for _ in range(stars):
        x0, y0 = srng.uniform(3, n - 3, 2)
        amp = 10 ** srng.uniform(-1.2, 0.6)
        img += gaussian(n, x0, y0, amp)
    for m in movers or []:
        img += gaussian(n, m["x"], m["y"], m["amp"])
    img += rng.normal(0, noise, (n, n)).astype(np.float32)
    var = np.full((n, n), noise**2, dtype=np.float32) + np.abs(img) * 1e-4
    flags = np.zeros((n, n), dtype=np.int32)
    zodi = np.full((n, n), sky, dtype=np.float32)
    lo, hi, _ = BANDS[detector]
    # Linear-variable filter: wavelength varies along the y axis of the detector
    wave = np.linspace(lo, hi, n, dtype=np.float32)[:, None].repeat(n, axis=1)
    bw = np.full((n, n), (hi - lo) / 17.0, dtype=np.float32)
    w = make_wcs(ra, dec, n)
    hdr = w.to_header()
    hdr["BUNIT"] = "MJy/sr"
    hdr["DETECTOR"] = detector
    hdr["MJD-OBS"] = mjd
    hdr["OBSID"] = f"SYNTH_{int(mjd)}_D{detector}"
    prim = fits.PrimaryHDU()
    prim.header["SYNTHETC"] = (True, "Synthetic demo data - NOT SPHEREx")
    prim.header["DETECTOR"] = detector
    prim.header["MJD-OBS"] = mjd
    hdus = fits.HDUList([
        prim,
        fits.ImageHDU(img, header=hdr, name="IMAGE"),
        fits.ImageHDU(flags, name="FLAGS"),
        fits.ImageHDU(var, name="VARIANCE"),
        fits.ImageHDU(zodi, name="ZODI"),
        fits.ImageHDU(np.stack([wave, bw]), name="WCS-WAVE"),
    ])
    import io
    buf = io.BytesIO()
    hdus.writeto(buf)
    return buf.getvalue()


def demo_epoch_set(ra: float, dec: float, n_epochs: int = 4) -> list[tuple[dict, bytes]]:
    """A labelled synthetic sequence with one mover crossing the field.

    Returns [(epoch_meta, fits_bytes), ...]. The mover moves +3.0 px/epoch in x
    and -1.2 px/epoch in y (i.e. ~18"/epoch, a slow-mover-like track).
    """
    out = []
    base_mjd = 60780.0
    for k in range(n_epochs):
        det = 1 + (k % 3)  # rotate detectors so the spectrum demo spans bands
        mjd = base_mjd + k * 182.6  # six-month cadence
        mover = {"x": 30 + 3.0 * k, "y": 60 - 1.2 * k, "amp": 1.8}
        data = synthetic_cutout(ra, dec, detector=det, mjd=mjd, seed=k, movers=[mover])
        meta = {
            "obs_id": f"SYNTH_{k}", "detector": det, "collection": "synthetic", "mjd": mjd,
            "date_iso": None, "access_url": f"synthetic://{k}", "band_lo_um": BANDS[det][0],
            "band_hi_um": BANDS[det][1], "exptime_s": None, "is_synthetic": True,
        }
        out.append((meta, data))
    return out
