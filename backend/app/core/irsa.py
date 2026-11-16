"""IRSA access for SPHEREx spectral images.

Two documented programmatic routes exist (IRSA SPHEREx QR overview):
  * IRSA SIAv2 ("Program Interface via SIA")   -> list images covering a position
  * IBE file access with cutout parameters      -> fetch a small MEF cutout

We use SIAv2 directly over HTTP (no astroquery dependency at runtime) so the
service can run in a slim container. Discovery of the exact collection names
is done at startup via `list_collections()` and cached; the defaults in
config.py are the names documented for QR3/DR1 and are verified on first use.
"""
from __future__ import annotations

import hashlib
import io
import os
import threading
import time
from dataclasses import dataclass, asdict

import httpx
import numpy as np
from astropy.io.votable import parse_single_table
from astropy.time import Time

from ..config import settings


@dataclass
class Epoch:
    obs_id: str
    detector: int | None
    collection: str
    mjd: float | None
    date_iso: str | None
    access_url: str
    band_lo_um: float | None = None
    band_hi_um: float | None = None
    exptime_s: float | None = None
    is_synthetic: bool = False

    def to_dict(self):
        return asdict(self)


class IRSAClient:
    def __init__(self):
        self._client = httpx.Client(timeout=settings.http_timeout_s, follow_redirects=True,
                                    headers={"User-Agent": "MaVionix-COSMOS/1.0 (SpaceApps 2026)"})
        os.makedirs(settings.cache_dir, exist_ok=True)
        self._collections: list[str] | None = None
        self._tl = threading.local()       # warnings belong to the request that made the query

    # ------------------------------------------------------------------ SIA
    def list_collections(self) -> list[str]:
        """Return the SPHEREx collections actually served by IRSA SIA."""
        if self._collections is not None:
            return self._collections
        wanted = [c.strip() for c in settings.spherex_collections.split(",") if c.strip()]
        try:
            r = self._client.get(settings.irsa_sia_url, params={"COLLECTION": "", "MAXREC": 0})
            # IRSA returns the list of collections in an error/metadata VOTable for an
            # empty COLLECTION; parse leniently and keep anything mentioning spherex.
            text = r.text.lower()
            found = [c for c in wanted if c.lower() in text]
            self._collections = found or wanted
        except Exception:
            self._collections = wanted
        return self._collections

    @property
    def last_warnings(self) -> list[str]:
        return list(getattr(self._tl, "warnings", []))

    def query_epochs(self, ra: float, dec: float, radius_deg: float = 0.05) -> list[Epoch]:
        """All spectral images covering a position, oldest first.

        Each configured collection is asked separately. A collection that errors (for example a
        release that has been retired) is skipped with a warning; only if every one fails does
        the call raise.
        """
        epochs: list[Epoch] = []
        problems: list[str] = []
        self._last_counts: dict[str, list] = {}
        last_exc: Exception | None = None
        for coll in self.list_collections():
            params = {
                "COLLECTION": coll,
                "POS": f"circle {ra} {dec} {radius_deg}",
                "RESPONSEFORMAT": "votable",
                "MAXREC": settings.max_epochs * 6,
            }
            try:
                r = self._client.get(settings.irsa_sia_url, params=params)
                r.raise_for_status()
                rows = self._parse_sia(r.content, coll)
                self._last_counts[coll] = rows
                epochs.extend(rows)
            except httpx.HTTPError as exc:
                last_exc = exc
                problems.append(f"The archive did not answer for release {coll} ({type(exc).__name__}); it is left out.")
        if last_exc is not None and len(problems) == len(self.list_collections()):
            raise last_exc
        self._tl.warnings = problems
        # The same exposure can appear in two releases; keep the first (collections are listed newest first).
        seen: set[tuple] = set()
        unique: list[Epoch] = []
        for e in epochs:
            k = (round(e.mjd, 5) if e.mjd else e.obs_id, e.detector)
            if k in seen:
                continue
            seen.add(k)
            unique.append(e)
        unique.sort(key=lambda e: (e.mjd or 0.0, e.detector or 0))
        if any(len(self._last_counts.get(c, [])) >= settings.max_epochs * 6 for c in self._last_counts):
            problems.append("The archive holds more images of this position than one query returns; a sample is shown.")
        if len(unique) > settings.max_epochs:
            problems.append(f"{len(unique)} images cover this position; {settings.max_epochs} spread evenly in time are shown.")
            # Too many to show: sample evenly in time rather than keeping only the oldest.
            step = (len(unique) - 1) / (settings.max_epochs - 1)
            unique = [unique[round(i * step)] for i in range(settings.max_epochs)]
        return unique

    @staticmethod
    def _parse_sia(content: bytes, coll: str) -> list[Epoch]:
        try:
            table = parse_single_table(io.BytesIO(content)).to_table()
        except Exception:
            return []
        cols = {c.lower(): c for c in table.colnames}

        def get(row, *names, default=None):
            for n in names:
                if n in cols:
                    v = row[cols[n]]
                    if v is None or v is np.ma.masked:
                        continue
                    if isinstance(v, bytes):
                        v = v.decode("utf-8", "replace")
                    if isinstance(v, (float, np.floating)) and not np.isfinite(v):
                        continue
                    if isinstance(v, str) and not v.strip():
                        continue
                    return v
            return default

        out = []
        for row in table:
            url = get(row, "access_url", "accessurl", "url")
            if not url:
                continue
            mjd = get(row, "t_min", "mjd_obs", "mjd")
            try:
                mjd = float(mjd) if mjd is not None else None
            except (TypeError, ValueError):
                mjd = None
            det = get(row, "detector", "band")
            try:
                det = int(det) if det is not None else None
            except (TypeError, ValueError):
                det = None
            if det is None:
                # Fall back to the documented filename pattern ...D<n>_spx_l2b...
                import re
                m = re.search(r"D(\d)_spx", str(url))
                det = int(m.group(1)) if m else None
            em_min = get(row, "em_min")
            em_max = get(row, "em_max")
            out.append(Epoch(
                obs_id=str(get(row, "obs_id", "obsid", "obs_publisher_did", default=os.path.basename(str(url)))),
                detector=det, collection=coll, mjd=mjd,
                date_iso=Time(mjd, format="mjd").iso if mjd else None,
                access_url=str(url),
                band_lo_um=float(em_min) * 1e6 if em_min is not None else None,  # SIA gives metres
                band_hi_um=float(em_max) * 1e6 if em_max is not None else None,
                exptime_s=float(get(row, "t_exptime")) if get(row, "t_exptime") is not None else None,
            ))
        return out

    # --------------------------------------------------------------- cutout
    def fetch_cutout(self, access_url: str, ra: float, dec: float,
                     size_arcsec: float | None = None) -> bytes:
        """Fetch an IBE cutout of a spectral image MEF (all HDUs trimmed)."""
        size = size_arcsec or settings.cutout_size_arcsec
        key = hashlib.sha1(f"{access_url}|{ra:.5f}|{dec:.5f}|{size}".encode()).hexdigest()
        path = os.path.join(settings.cache_dir, key + ".fits")
        if os.path.exists(path):
            with open(path, "rb") as f:
                return f.read()
        sep = "&" if "?" in access_url else "?"
        url = f"{access_url}{sep}center={ra},{dec}&size={size}arcsec&gzip=false"
        for attempt in range(3):
            try:
                r = self._client.get(url)
                r.raise_for_status()
                data = r.content
                break
            except httpx.HTTPError:
                if attempt == 2:
                    raise
                time.sleep(1.5 * (attempt + 1))
        if not (data.startswith(b"SIMPLE") or data.startswith(b"\x1f\x8b")):   # FITS, or gzipped FITS
            raise ValueError("The archive answered, but not with a FITS file")
        tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
        with open(tmp, "wb") as f:      # write-then-rename so a second worker never reads half a file
            f.write(data)
        os.replace(tmp, path)
        return data


_client: IRSAClient | None = None


def irsa() -> IRSAClient:
    global _client
    if _client is None:
        _client = IRSAClient()
    return _client
