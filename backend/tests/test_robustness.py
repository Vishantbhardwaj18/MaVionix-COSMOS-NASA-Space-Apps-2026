"""Things real archive data does that the tidy sample does not: padded edges, empty tables,
many visits, odd requests. Each of these used to fail or mislead."""
import io
import os
import time

os.environ.setdefault("COSMOS_MODE", "demo")

import json

import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient

from app.core.fits_tools import load_spectral_image, noise_sigma, background_subtracted, valid_mask
from app.data.synthetic import synthetic_cutout, demo_epoch_set
from app.science import detectability, movers, spectrum

F = {"ra": 270.0, "dec": 66.56}


def _padded(frac=0.4, seed=3):
    """A cutout whose right-hand side is NaN, as when the position is near a detector edge."""
    raw = synthetic_cutout(270.0, 66.56, mjd=60800.0, detector=1, seed=seed)
    with fits.open(io.BytesIO(raw)) as h:
        for name in ("IMAGE", "VARIANCE", "ZODI"):
            if name in h:
                d = h[name].data.astype(np.float32)
                d[:, int(d.shape[1] * (1 - frac)):] = np.nan
                h[name].data = d
        out = io.BytesIO()
        h.writeto(out)
    return load_spectral_image(out.getvalue(), is_synthetic=True)


def test_padded_image_gives_finite_noise_and_no_edge_sources():
    si = _padded()
    img = background_subtracted(si)
    s = noise_sigma(si, img)
    assert np.isfinite(s) and s > 0
    ok = valid_mask(si)
    for d in movers.detect_sources(si, 0):
        assert ok[int(round(d.y)), int(round(d.x))]
        assert np.isfinite(d.ra) and np.isfinite(d.dec) and np.isfinite(d.snr)


def test_mostly_empty_image_does_not_crash():
    si = _padded(frac=0.97)
    assert np.isfinite(noise_sigma(si, background_subtracted(si)))
    movers.detect_sources(si, 0)
    assert spectrum.forced_photometry(si, 270.0, 66.56) is None or True


def test_photometry_refuses_padded_or_edge_apertures():
    si = _padded()
    ny, nx = si.shape
    ra, dec = si.wcs.pixel_to_world_values(nx - 10, ny // 2)      # inside the NaN region
    assert spectrum.forced_photometry(si, float(ra), float(dec)) is None
    ra, dec = si.wcs.pixel_to_world_values(5, ny // 2)            # sky ring would leave the image
    assert spectrum.forced_photometry(si, float(ra), float(dec)) is None
    ra, dec = si.wcs.pixel_to_world_values(nx // 4, ny // 2)
    p = spectrum.forced_photometry(si, float(ra), float(dec))
    assert p is not None and np.isfinite(p["flux_jy"])


def test_injection_does_not_change_the_shared_image():
    si = load_spectral_image(demo_epoch_set(270.0, 66.56)[0][1], is_synthetic=True)
    before = si.image.copy()
    out = detectability.injection_recovery(si, mags_ab=[15, 19], n_per_mag=3)
    assert np.array_equal(before, si.image)
    assert out["curve"][0]["completeness"] >= out["curve"][1]["completeness"]


def test_mover_search_scales_to_many_visits():
    # 40 visits of the same field with independent noise: the old pairwise search took minutes
    images = []
    for k in range(40):
        si = load_spectral_image(synthetic_cutout(270.0, 66.56, mjd=60800.0 + k * 0.07, detector=1 + k % 6, seed=100 + k), is_synthetic=True)
        images.append(si)
    t0 = time.time()
    cands, diag = movers.find_movers(images)
    assert time.time() - t0 < 20
    assert diag["min_detections_per_track"] == 3
    assert all(len(c.detections) >= 3 for c in cands)


def test_two_noise_peaks_are_not_a_track_when_a_third_visit_exists():
    base = [load_spectral_image(d, is_synthetic=True) for _, d in demo_epoch_set(270.0, 66.56)]
    cands, _ = movers.find_movers(base)
    assert cands and all(len(c.detections) >= 3 for c in cands)       # the injected mover still links
    two = base[:2]
    cands2, diag2 = movers.find_movers(two)
    assert diag2["min_detections_per_track"] == 2                       # only two visits: pairs are all there is


@pytest.fixture(scope="module")
def client():
    from app import main
    main._hits.clear()
    return TestClient(main.app)


@pytest.mark.parametrize("path,params", [
    ("/api/spectrum", {**F, "ra_src": 270.0, "dec_src": 66.56, "track": "not json"}),
    ("/api/spectrum", {**F, "ra_src": 270.0, "dec_src": 66.56, "track": json.dumps([{"epoch_index": "x"}])}),
    ("/api/spectrum", {**F, "ra_src": 400.0, "dec_src": 66.56}),
    ("/api/planetx/brightness", {"albedo": 0}),
    ("/api/planetx/brightness", {"distance_au": 0.5}),
    ("/api/planetx/brightness", {"mass_earth": -1}),
    ("/api/sky/epochs", {**F, "size": -5}),
    ("/api/sky/epochs", {**F, "size": 1e9}),
    ("/api/sky/epochs", {"ra": "nan", "dec": 0}),
    ("/api/sky/diff", {**F, "a": -1, "b": 0}),
    ("/api/sky/diff", {**F, "a": 0, "b": 99}),
    ("/api/planetx/injection", {**F, "epoch": 99}),
    ("/api/movers", {**F, "threshold": 1}),
])
def test_bad_requests_get_a_4xx_not_a_crash(client, path, params):
    r = client.get(path, params=params)
    assert 400 <= r.status_code < 500, (path, params, r.status_code, r.text[:200])
    assert "detail" in r.json()


def test_out_of_range_track_entries_are_ignored(client):
    track = json.dumps([{"epoch_index": 99, "ra": 270.0, "dec": 66.56}])
    r = client.get("/api/spectrum", params={**F, "ra_src": 270.0, "dec_src": 66.56, "track": track})
    assert r.status_code == 200


def test_responses_never_contain_nan(client):
    from app.api.routes import _clean
    assert _clean({"a": float("nan"), "b": [1.0, float("inf")], "c": np.float32("nan")}) == {"a": None, "b": [1.0, None], "c": None}
    for path, params in [("/api/sky/epochs", F), ("/api/movers", F), ("/api/spectrum", {**F, "ra_src": 270.0, "dec_src": 66.56})]:
        r = client.get(path, params=params)
        assert r.status_code == 200
        def boom(name):
            raise AssertionError(f"{path} returned {name}")
        json.loads(r.text, parse_constant=boom)          # NaN / Infinity would call boom


def test_sia_rows_with_blank_cells_are_parsed():
    from astropy.table import MaskedColumn, Table
    from app.core.irsa import IRSAClient
    t = Table()
    t["access_url"] = ["https://x.test/level2_a_D3_spx_l2b-v1.fits", "", "https://x.test/level2_b_D5_spx_l2b-v1.fits"]
    t["t_min"] = MaskedColumn([60800.5, 60801.0, 0.0], mask=[False, False, True])
    t["em_min"] = MaskedColumn([1.1e-6, 0, 0], mask=[False, True, True])
    buf = io.BytesIO()
    t.write(buf, format="votable")
    rows = IRSAClient._parse_sia(buf.getvalue(), "spherex_qr3")
    assert [r.detector for r in rows] == [3, 5]            # the row with no URL is dropped
    assert rows[0].mjd == 60800.5 and rows[1].mjd is None and rows[1].band_lo_um is None
    assert IRSAClient._parse_sia(b"<html>down for maintenance</html>", "x") == []
