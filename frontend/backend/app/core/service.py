"""Orchestration: resolve a sky position into loaded epochs (live IRSA or
labelled synthetic), with an in-process LRU so a session's repeated calls
(blink, diff, spectrum, movers) don't re-download."""
from __future__ import annotations

import logging
<<<<<<< HEAD
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
=======
from collections import OrderedDict
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
from dataclasses import dataclass

from astropy.coordinates import SkyCoord, get_icrs_coordinates

from ..config import settings
from ..data.synthetic import demo_epoch_set
from .fits_tools import SpectralImage, load_spectral_image
from .irsa import irsa

log = logging.getLogger("cosmos")


@dataclass
class Field:
    ra: float
    dec: float
    epochs: list[dict]            # metadata dicts (Epoch.to_dict())
    images: list[SpectralImage]
    source: str                   # "irsa" | "synthetic"
    warnings: list[str]


<<<<<<< HEAD
_cache: "OrderedDict[tuple, tuple[float, Field]]" = OrderedDict()   # key -> (expires_at, field)
_CACHE_MAX = 16
_FALLBACK_TTL_S = 90.0        # a fallback caused by an outage must not outlive the outage
_locks: dict[tuple, threading.Lock] = {}
_locks_guard = threading.Lock()
_FETCH_WORKERS = 4            # parallel cutout downloads; kept low to be polite to the archive
=======
_cache: "OrderedDict[tuple, Field]" = OrderedDict()
_CACHE_MAX = 16
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4


def resolve_target(target: str) -> tuple[float, float, str]:
    """Accept 'ra,dec' in degrees or a name resolvable by Sesame (CDS)."""
    t = target.strip()
    if "," in t:
        ra, dec = (float(x) for x in t.split(",", 1))
        return ra, dec, "coordinates"
    parts = t.split()
    if len(parts) == 2:
        try:
            return float(parts[0]), float(parts[1]), "coordinates"
        except ValueError:
            pass
    c = get_icrs_coordinates(t)  # network: CDS Sesame
    return float(c.ra.deg), float(c.dec.deg), "sesame"


<<<<<<< HEAD
def _fetch_one(ep, ra: float, dec: float, size: float):
    data = irsa().fetch_cutout(ep.access_url, ra, dec, size)
    si = load_spectral_image(data)
    if si.mjd is None:
        si.mjd = ep.mjd
    if si.detector is None:
        si.detector = ep.detector
    return si


def get_field(ra: float, dec: float, size_arcsec: float | None = None, force_synthetic: bool = False) -> Field:
    size = size_arcsec or settings.cutout_size_arcsec
    wants_synthetic = force_synthetic or settings.mode == "demo"
    key = (round(ra, 4), round(dec, 4), size, wants_synthetic)
    with _locks_guard:
        lock = _locks.setdefault(key, threading.Lock())
    # One download per field at a time: the start page and the viewer often ask for the same field together.
    with lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            _cache.move_to_end(key)
            return hit[1]
        f = _load_field(ra, dec, size, wants_synthetic)
        fell_back = f.source == "synthetic" and not wants_synthetic
        _cache[key] = (time.monotonic() + (_FALLBACK_TTL_S if fell_back else 6 * 3600.0), f)
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            old, _ = _cache.popitem(last=False)
            with _locks_guard:
                _locks.pop(old, None)
        return f


def _load_field(ra: float, dec: float, size: float, wants_synthetic: bool) -> Field:
=======
def get_field(ra: float, dec: float, size_arcsec: float | None = None, force_synthetic: bool = False) -> Field:
    size = size_arcsec or settings.cutout_size_arcsec
    key = (round(ra, 4), round(dec, 4), size, force_synthetic or settings.mode == "demo")
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
    warnings: list[str] = []
    epochs: list[dict] = []
    images: list[SpectralImage] = []
    source = "irsa"

<<<<<<< HEAD
    if not wants_synthetic:
        try:
            found = irsa().query_epochs(ra, dec, radius_deg=size / 3600.0 / 2)
            warnings.extend(irsa().last_warnings)
            failed = 0
            with ThreadPoolExecutor(max_workers=_FETCH_WORKERS) as pool:
                futures = [pool.submit(_fetch_one, ep, ra, dec, size) for ep in found]
            for ep, fut in zip(found, futures):          # keep time order
                try:
                    images.append(fut.result())
                    epochs.append(ep.to_dict())
                except Exception as exc:  # noqa: BLE001 - one bad cutout must not lose the field
                    failed += 1
                    log.warning("cutout failed for %s: %s", ep.obs_id, exc)
            if failed:
                warnings.append(f"{failed} of {len(found)} images could not be downloaded or read and are left out.")
            if not images:
                warnings.append("The archive returned no usable SPHEREx images for this position.")
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"The archive query failed ({type(exc).__name__}).")
            log.warning("IRSA query failed: %s", exc)

    if not images:
        if wants_synthetic or settings.allow_synthetic_fallback:
=======
    if not (force_synthetic or settings.mode == "demo"):
        try:
            found = irsa().query_epochs(ra, dec, radius_deg=size / 3600.0 / 2)
            for ep in found:
                try:
                    data = irsa().fetch_cutout(ep.access_url, ra, dec, size)
                    si = load_spectral_image(data)
                    if si.mjd is None:
                        si.mjd = ep.mjd
                    if si.detector is None:
                        si.detector = ep.detector
                    images.append(si)
                    epochs.append(ep.to_dict())
                except Exception as exc:
                    warnings.append(f"cutout failed for {ep.obs_id}: {type(exc).__name__}")
            if not images:
                warnings.append("IRSA returned no SPHEREx images for this position (or all cutouts failed)")
        except Exception as exc:
            warnings.append(f"IRSA query failed: {type(exc).__name__}: {exc}")
            log.warning("IRSA query failed: %s", exc)

    if not images:
        if force_synthetic or settings.mode == "demo" or settings.allow_synthetic_fallback:
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
            source = "synthetic"
            warnings.append("SYNTHETIC DATA - NOT SPHEREx. Shown because live data was unavailable or demo mode is on.")
            for meta, data in demo_epoch_set(ra, dec):
                images.append(load_spectral_image(data, is_synthetic=True))
                epochs.append(meta)
        else:
            raise RuntimeError("No SPHEREx data available and synthetic fallback disabled")

<<<<<<< HEAD
    return Field(ra=ra, dec=dec, epochs=epochs, images=images, source=source, warnings=warnings)
=======
    f = Field(ra=ra, dec=dec, epochs=epochs, images=images, source=source, warnings=warnings)
    _cache[key] = f
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return f
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4


def pairs_same_band(field: Field, tol_um: float = 0.25) -> list[tuple[int, int]]:
    """Epoch index pairs whose central wavelengths at the field centre agree to
    within tol_um — the only pairs for which a difference image is meaningful
    given the linear-variable filter."""
    centres = []
    for si in field.images:
        x, y = si.shape[1] / 2, si.shape[0] / 2
        lam, _, _ = si.wavelength_at(x, y)
        centres.append(lam)
    out = []
    for i in range(len(centres)):
        for j in range(i + 1, len(centres)):
            if centres[i] is not None and centres[j] is not None and abs(centres[i] - centres[j]) <= tol_um:
                out.append((i, j))
    return out
