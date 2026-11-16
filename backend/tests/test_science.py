"""Backend test-suite. Runs fully offline against labelled synthetic MEFs that
mimic the documented SPHEREx cutout layout."""
import json
import os

os.environ["COSMOS_MODE"] = "demo"

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.fits_tools import load_spectral_image, background_subtracted
from app.core.render import reproject_to, asinh_stretch
from app.data.synthetic import synthetic_cutout, demo_epoch_set
from app.science import movers, spectrum, detectability
from app.main import app

client = TestClient(app)
RA, DEC = 270.0, 66.56


def test_mef_roundtrip_reads_all_documented_hdus():
    si = load_spectral_image(synthetic_cutout(RA, DEC, detector=3, mjd=60900.0))
    assert si.shape == (96, 96)
    assert si.flags is not None and si.variance is not None and si.zodi is not None
    assert si.wave is not None and si.is_synthetic
    lam, bw, src = si.wavelength_at(10, 10)
    assert src == "wcs-wave" and 1.63 <= lam <= 2.41 and bw > 0
    assert si.detector == 3 and si.mjd == 60900.0


def test_wavelength_fallback_to_band_range():
    si = load_spectral_image(synthetic_cutout(RA, DEC, detector=5))
    si.wave = None
    lam, bw, src = si.wavelength_at(0, 0)
    assert src == "band-range-only" and abs(lam - 4.12) < 0.01


def test_reprojection_is_identity_on_same_wcs():
    si = load_spectral_image(synthetic_cutout(RA, DEC))
    img = background_subtracted(si)
    rp = reproject_to(si, img, si)
    assert np.nanmax(np.abs(rp - img)) < 1e-4


def test_stretch_outputs_uint8():
    si = load_spectral_image(synthetic_cutout(RA, DEC))
    png = asinh_stretch(background_subtracted(si))
    assert png.dtype == np.uint8 and png.max() > 200


def test_mover_detection_recovers_injected_track():
    imgs = [load_spectral_image(b, is_synthetic=True) for _, b in demo_epoch_set(RA, DEC, 4)]
    cands, diag = movers.find_movers(imgs)
    assert diag["n_epochs"] == 4
    assert len(cands) >= 1, diag
    best = cands[0]
    assert len(best.detections) >= 2
    # injected motion: ~3.2 px per epoch = ~20 arcsec per ~183 d
    assert 10 < best.total_motion_arcsec < 120
    assert best.rate_arcsec_per_day is not None and best.rate_arcsec_per_day < 1.0
    assert best.status == "unmatched"  # never "discovered"


def test_no_movers_in_static_field():
    imgs = [load_spectral_image(synthetic_cutout(RA, DEC, mjd=60800 + 183 * k, seed=k), is_synthetic=True) for k in range(3)]
    cands, _ = movers.find_movers(imgs)
    assert len(cands) == 0


def test_forced_photometry_and_classification():
    imgs = [load_spectral_image(b, is_synthetic=True) for _, b in demo_epoch_set(RA, DEC, 4)]
    # photometry on a static star near the centre: pick the brightest pixel in epoch 0
    img0 = background_subtracted(imgs[0])
    y, x = np.unravel_index(np.argmax(img0), img0.shape)
    ra, dec = imgs[0].wcs.pixel_to_world_values(x, y)
    pts = [spectrum.forced_photometry(si, float(ra), float(dec)) for si in imgs]
    pts = [p for p in pts if p]
    assert len(pts) >= 3
    assert all(p["flux_jy"] > 0 for p in pts)
    assert all(p["wavelength_source"] == "wcs-wave" for p in pts)
    cls = spectrum.classify(pts)
    assert cls["best"] is not None and "indicative" in cls["note"]


def test_planet_nine_is_too_faint_for_single_exposure():
    r = detectability.planet_brightness(mass_earth=7, albedo=0.4, distance_au=600)
    assert r["V_mag"] > 21
    assert r["detectable_in_single_exposure"] is False
    assert r["parallax_in_spherex_pixels"] > 30  # motion would be obvious if it were bright enough


def test_injection_recovery_curve_is_monotone_ish():
    si = load_spectral_image(synthetic_cutout(RA, DEC), is_synthetic=True)
    r = detectability.injection_recovery(si, mags_ab=[14, 16, 18, 20, 22], n_per_mag=6)
    comp = [p["completeness"] for p in r["curve"]]
    assert comp[0] >= 0.8 and comp[-1] <= 0.2
    assert r["is_synthetic"] is True


# ----------------------------------------------------------------- API ----
def test_api_health_and_showcase():
    assert client.get("/api/health").json()["ok"]
    assert len(client.get("/api/showcase").json()["fields"]) >= 3


def test_api_epochs_are_labelled_synthetic_in_demo_mode():
    r = client.get("/api/sky/epochs", params={"ra": RA, "dec": DEC})
    assert r.status_code == 200
    js = r.json()
    assert js["source"] == "synthetic"
    assert any("SYNTHETIC" in w for w in js["warnings"])
    assert len(js["frames"]) == 4 and js["frames"][0]["png"].startswith("iVBOR")
    assert js["frames"][0]["is_synthetic"] is True


def test_api_diff_movers_spectrum_report():
    base = {"ra": RA, "dec": DEC}
    d = client.get("/api/sky/diff", params={**base, "a": 0, "b": 1}).json()
    assert d["png"] and d["sigma"] > 0
    m = client.get("/api/movers", params=base).json()
    assert m["candidates"] and m["candidates"][0]["thumbnails"]
    assert "not discoveries" in m["disclaimer"]
    c = m["candidates"][0]
    track = json.dumps([{"epoch_index": t["epoch_index"], "ra": t["ra"], "dec": t["dec"]} for t in c["detections"]])
    s = client.get("/api/spectrum", params={**base, "ra_src": c["detections"][0]["ra"],
                                            "dec_src": c["detections"][0]["dec"], "track": track}).json()
    assert len(s["points"]) >= 2
    rep = client.get("/api/report.csv", params=base)
    assert rep.status_code == 200 and "cand-000" in rep.text


def test_api_validation():
    assert client.get("/api/sky/epochs").status_code == 400
    assert client.get("/api/sky/epochs", params={"ra": 400, "dec": 0}).status_code == 400
    assert client.get("/api/planetx/brightness", params={"distance_au": 300}).json()["V_mag"] > 0


def test_status_and_headers_in_demo_mode():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    r = c.get("/api/status")
    assert r.status_code == 200
    j = r.json()
    assert j["mode"] == "demo" and j["serving"] == "synthetic"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "x-request-id" in r.headers


def test_rate_limit_returns_429(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    monkeypatch.setattr(main.settings, "rate_limit_per_min", 3)
    main._hits.clear()
    c = TestClient(main.app)
    codes = [c.get("/api/planetx/brightness").status_code for _ in range(5)]
    main._hits.clear()
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    assert c.get("/api/health").status_code == 200   # health is never limited
