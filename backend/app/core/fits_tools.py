"""Reading SPHEREx Level-2 spectral-image MEFs (and cutouts of them).

Documented layout (SPHEREx Archive User Guide, "Spectral Image MEF"):
  HDU IMAGE     calibrated surface brightness, MJy/sr   (zodi NOT subtracted)
  HDU FLAGS     per-pixel status/processing bitmap
  HDU VARIANCE  (MJy/sr)^2
  HDU ZODI      modelled zodiacal background, MJy/sr
  HDU PSF/EPSF  PSF zones
  HDU WCS-WAVE  lookup table: pixel -> central wavelength & bandwidth
Pixel scale 6.15"/px, 2040x2040 per detector, 6 detectors per pointing.

Every accessor here degrades gracefully: if an extension is missing we return
None and record it in `notes`, so the API never fabricates a value.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

# Nominal detector bands (µm). Used only as a fallback label when WCS-WAVE
# cannot be read; the API reports `wavelength_source` so the UI can say so.
BANDS = {
    1: (0.75, 1.09, 39),
    2: (1.10, 1.62, 41),
    3: (1.63, 2.41, 41),
    4: (2.42, 3.82, 35),
    5: (3.83, 4.41, 112),
    6: (4.42, 5.00, 128),
}


@dataclass
class SpectralImage:
    image: np.ndarray                 # MJy/sr
    wcs: WCS
    header: fits.Header
    flags: np.ndarray | None = None
    variance: np.ndarray | None = None
    zodi: np.ndarray | None = None
    wave: np.ndarray | None = None    # central wavelength per pixel (µm) if available
    bandwidth: np.ndarray | None = None
    detector: int | None = None
    obs_id: str | None = None
    mjd: float | None = None
    is_synthetic: bool = False
    notes: list[str] = field(default_factory=list)

    @property
    def shape(self) -> tuple[int, int]:
        return self.image.shape

    def wavelength_at(self, x: float, y: float) -> tuple[float | None, float | None, str]:
        """Return (lambda_um, bandwidth_um, source) at 0-based pixel (x, y)."""
        if self.wave is not None:
            yi, xi = int(round(y)), int(round(x))
            if 0 <= yi < self.wave.shape[0] and 0 <= xi < self.wave.shape[1]:
                bw = float(self.bandwidth[yi, xi]) if self.bandwidth is not None else None
                return float(self.wave[yi, xi]), bw, "wcs-wave"
        if self.detector in BANDS:
            lo, hi, _ = BANDS[self.detector]
            return (lo + hi) / 2.0, hi - lo, "band-range-only"
        return None, None, "unknown"


def _find_hdu(hdul: fits.HDUList, *names: str):
    for h in hdul:
        if (h.name or "").upper() in {n.upper() for n in names}:
            return h
    return None


def _read_wave_table(hdul: fits.HDUList, shape: tuple[int, int], notes: list[str]):
    """Try to materialise the WCS-WAVE lookup table onto the image grid.

    The product is a -TAB style lookup; many readers cannot handle it. We try
    (a) a full-size image extension, (b) a coarse grid we bilinearly upsample,
    (c) a table extension with wavelength columns. Anything else -> None.
    """
    h = _find_hdu(hdul, "WCS-WAVE", "WCS_WAVE", "WAVE")
    if h is None:
        notes.append("WCS-WAVE extension not present (cutout may omit it)")
        return None, None
    try:
        data = h.data
        if data is None:
            return None, None
        if isinstance(data, np.ndarray) and data.dtype.names is None:
            arr = np.asarray(data, dtype=float)
            if arr.ndim == 3 and arr.shape[0] >= 2:
                wave, bw = arr[0], arr[1]
            elif arr.ndim == 2:
                wave, bw = arr, None
            else:
                notes.append("WCS-WAVE array has unexpected ndim")
                return None, None
            if wave.shape != shape:
                from scipy.ndimage import zoom
                fy, fx = shape[0] / wave.shape[0], shape[1] / wave.shape[1]
                wave = zoom(wave, (fy, fx), order=1)
                bw = zoom(bw, (fy, fx), order=1) if bw is not None else None
                notes.append("WCS-WAVE grid resampled to image grid")
            return wave, bw
        # Table with columns
        cols = {c.upper(): c for c in data.dtype.names}
        for wk, bk in (("WAVE", "BANDWIDTH"), ("LAMBDA", "DLAMBDA"), ("CWAVE", "CBAND")):
            if wk in cols:
                w = np.asarray(data[cols[wk]], dtype=float).squeeze()
                b = np.asarray(data[cols[bk]], dtype=float).squeeze() if bk in cols else None
                if w.shape == shape:
                    return w, b
        notes.append("WCS-WAVE table layout not recognised; using band range")
    except Exception as exc:  # pragma: no cover - defensive
        notes.append(f"WCS-WAVE unreadable: {exc}")
    return None, None


def load_spectral_image(src: bytes | str, *, is_synthetic: bool = False) -> SpectralImage:
    """Load a SPHEREx MEF or cutout from bytes or a path."""
    notes: list[str] = []
    buf = io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else src
    with fits.open(buf, memmap=False) as hdul:
        img_hdu = _find_hdu(hdul, "IMAGE") or (hdul[1] if len(hdul) > 1 and hdul[1].data is not None else hdul[0])
        if img_hdu.data is None:
            raise ValueError("The file has no image data")
        image = np.asarray(img_hdu.data, dtype=np.float32)
        while image.ndim > 2 and image.shape[0] == 1:      # drop degenerate leading axes
            image = image[0]
        if image.ndim != 2 or min(image.shape) < 8:
            raise ValueError(f"Expected a 2-D image, got shape {image.shape}")
        header = img_hdu.header.copy()
        wcs = WCS(header, naxis=2)

        def opt(*names):
            h = _find_hdu(hdul, *names)
            return np.asarray(h.data) if h is not None and h.data is not None else None

        flags = opt("FLAGS")
        variance = opt("VARIANCE", "VAR")
        zodi = opt("ZODI")
        wave, bw = _read_wave_table(hdul, image.shape, notes)
        phdr = hdul[0].header
        det = header.get("DETECTOR", phdr.get("DETECTOR"))
        try:
            det = int(det) if det is not None else None
        except (TypeError, ValueError):
            det = None
        obs_id = header.get("OBSID", phdr.get("OBSID"))
        mjd = header.get("MJD-OBS", phdr.get("MJD-OBS", header.get("MJD", phdr.get("MJD"))))
        mjd = float(mjd) if mjd is not None else None
        synthetic = is_synthetic or bool(phdr.get("SYNTHETC", False))
    return SpectralImage(
        image=image, wcs=wcs, header=header, flags=flags, variance=variance, zodi=zodi,
        wave=wave, bandwidth=bw, detector=det, obs_id=obs_id, mjd=mjd,
        is_synthetic=synthetic, notes=notes,
    )


def background_subtracted(si: SpectralImage, subtract_zodi: bool = True) -> np.ndarray:
    """Image minus zodiacal model (if present) minus a robust sky median."""
    img = si.image.astype(np.float64).copy()
    if subtract_zodi and si.zodi is not None and si.zodi.shape == img.shape:
        img -= si.zodi
    finite = np.isfinite(img)
    if si.flags is not None and si.flags.shape == img.shape:
        finite &= si.flags == 0
    med = np.nanmedian(img[finite]) if finite.any() else 0.0
    img -= med
    img[~np.isfinite(img)] = 0.0
    return img


def valid_mask(si: SpectralImage) -> np.ndarray:
    """True where the original image has a real measurement (cutouts that reach the edge of a
    detector are padded with NaN, and those pixels must not count as sky)."""
    return np.isfinite(si.image)


def noise_sigma(si: SpectralImage, img: np.ndarray) -> float:
    """Robust per-pixel noise from VARIANCE if present else MAD of the valid pixels."""
    ok = valid_mask(si) if si.image.shape == img.shape else np.isfinite(img)
    if si.variance is not None and si.variance.shape == img.shape:
        v = si.variance[ok & np.isfinite(si.variance) & (si.variance > 0)]
        if v.size:
            return float(np.sqrt(np.median(v)))
    vals = img[ok & np.isfinite(img)]
    if vals.size < 16:
        return 1.0
    mad = float(np.median(np.abs(vals - np.median(vals))))
    if mad > 0:
        return 1.4826 * mad
    sd = float(np.std(vals))
    return sd if sd > 0 else 1.0
