"""JPL Solar System Dynamics clients: SBIdent (known bodies in a field at a
time) and SBDB query (orbital elements of TNOs / ETNOs for the Planet X page).

Both are public REST APIs with no key. Documentation:
  https://ssd-api.jpl.nasa.gov/doc/sbident.html
  https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
"""
from __future__ import annotations

import json
import os
import time

import httpx
from astropy.time import Time
from astropy.coordinates import SkyCoord
from astropy import units as u

from ..config import settings

_client = httpx.Client(timeout=settings.http_timeout_s, follow_redirects=True)


def sbident(ra: float, dec: float, mjd: float, half_width_deg: float = 0.1) -> list[dict]:
    """Known small bodies predicted inside a square FOV at epoch `mjd`."""
    jd = Time(mjd, format="mjd").jd
    params = {
        "mpc-code": settings.observer_mpc_code,
        "obs-time": f"{jd:.6f}",
        "fov-ra-center": f"{ra:.6f}",
        "fov-dec-center": f"{dec:.6f}",
        "fov-ra-hwidth": f"{half_width_deg:.5f}",
        "fov-dec-hwidth": f"{half_width_deg:.5f}",
        "two-pass": "true", "suppress-first-pass": "true",
        "req-elem": "false",
    }
    r = _client.get(settings.jpl_sbident_url, params=params)
    r.raise_for_status()
    js = r.json()
    fields = js.get("fields_second", js.get("fields_first", []))
    rows = js.get("data_second_pass", js.get("data_first_pass", []))
    out = []
    for row in rows:
        rec = dict(zip(fields, row))
        out.append({
            "name": rec.get("Object name"),
            "ra_str": rec.get("Astrometric RA (hh:mm:ss)"),
            "dec_str": rec.get("Astrometric Dec (dd mm'ss\")"),
            "ra_rate": rec.get("RA rate (\"/h)"),
            "dec_rate": rec.get("Dec rate (\"/h)"),
            "vmag": rec.get("Vis mag (V)"),
            "raw": rec,
        })
    return out


def match_candidates(candidates: list, half_width_deg: float = 0.12, tol_arcsec: float = 30.0) -> None:
    """Attach JPL matches to Candidate objects in place (best match per epoch)."""
    cache: dict[tuple[float, float, float], list[dict]] = {}
    for c in candidates:
        matches = []
        for d in c.detections:
            if d.mjd is None:
                continue
            key = (round(d.ra, 2), round(d.dec, 2), round(d.mjd, 2))
            if key not in cache:
                try:
                    cache[key] = sbident(d.ra, d.dec, d.mjd, half_width_deg)
                except Exception as exc:  # network failure -> record, don't fake
                    c.reasons.append(f"JPL SBIdent unavailable: {type(exc).__name__}")
                    cache[key] = []
            best = None
            for k in cache[key]:
                try:
                    sc = SkyCoord(k["ra_str"], k["dec_str"], unit=(u.hourangle, u.deg))
                    sep = sc.separation(SkyCoord(d.ra, d.dec, unit="deg")).arcsec
                except Exception:
                    continue
                if sep <= tol_arcsec and (best is None or sep < best["sep_arcsec"]):
                    best = {"name": k["name"], "sep_arcsec": round(float(sep), 1), "vmag": k["vmag"]}
            if best:
                matches.append(best)
        if matches:
            names = {m["name"] for m in matches}
            if len(names) == 1:
                c.status = "known"
                c.match = {"name": matches[0]["name"], "epochs_matched": len(matches),
                           "mean_sep_arcsec": round(sum(m["sep_arcsec"] for m in matches) / len(matches), 1),
                           "vmag": matches[0]["vmag"]}
                c.reasons.append(f"matches JPL ephemeris of {matches[0]['name']} in {len(matches)} epoch(s)")
            else:
                c.match = {"ambiguous": sorted(names)}
                c.reasons.append("ambiguous JPL matches: " + ", ".join(sorted(names)))


def tno_elements(a_min_au: float = 30.0, limit: int = 4000, cache_hours: float = 24.0) -> list[dict]:
    """Osculating elements for TNOs with a > a_min from JPL SBDB (cached)."""
    os.makedirs(settings.cache_dir, exist_ok=True)
    cache = os.path.join(settings.cache_dir, f"sbdb_tno_{int(a_min_au)}.json")
    if os.path.exists(cache) and time.time() - os.path.getmtime(cache) < cache_hours * 3600:
        with open(cache) as f:
            return json.load(f)
    params = {
        "fields": "full_name,a,e,i,om,w,q,ad,per_y,H,epoch",
        "sb-class": "TNO",
        "sb-cdata": json.dumps({"AND": [f"a|GT|{a_min_au}"]}),
        "limit": limit,
    }
    r = _client.get(settings.jpl_sbdb_query_url, params=params)
    r.raise_for_status()
    js = r.json()
    fields = js["fields"]
    rows = []
    for row in js.get("data", []):
        rec = dict(zip(fields, row))
        try:
            rows.append({
                "name": (rec["full_name"] or "").strip(),
                "a": float(rec["a"]), "e": float(rec["e"]), "i": float(rec["i"]),
                "om": float(rec["om"]), "w": float(rec["w"]), "q": float(rec["q"]),
                "ad": float(rec["ad"]) if rec.get("ad") else None,
                "per_y": float(rec["per_y"]) if rec.get("per_y") else None,
                "H": float(rec["H"]) if rec.get("H") else None,
            })
        except (TypeError, ValueError):
            continue
    with open(cache, "w") as f:
        json.dump(rows, f)
    return rows
