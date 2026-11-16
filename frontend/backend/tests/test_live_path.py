"""The live code path, exercised against a stand-in archive.

These tests do not contact IRSA. They replace the HTTP transport with a fake that answers
the way the archive's documentation describes (a VOTable from SIA, a FITS cutout from the
access URL), so the query, parsing, parallel download, fallback and recovery logic all run.
They show the plumbing is right; only scripts/verify_irsa.py shows the real archive agrees.
"""
import io
import os

os.environ.setdefault("COSMOS_MODE", "demo")

import httpx
import numpy as np
import pytest
from astropy.table import Table

from app.config import settings
from app.core import irsa as irsa_mod
from app.core import service
from app.data.synthetic import synthetic_cutout


def _votable(rows):
    t = Table(rows=rows, names=("access_url", "obs_id", "t_min", "em_min", "em_max", "t_exptime"),
              dtype=("U200", "U60", "f8", "f8", "f8", "f8"))
    buf = io.BytesIO()
    t.write(buf, format="votable")
    return buf.getvalue()


class FakeArchive:
    def __init__(self):
        self.down = False
        self.bad_collections: set[str] = set()
        self.cutouts = 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.down:
            raise httpx.ConnectError("archive unreachable", request=request)
        url = str(request.url)
        if "/SIA" in url:
            coll = request.url.params.get("COLLECTION", "")
            if coll == "":
                return httpx.Response(200, text="spherex_qr3 spherex_dr1")
            if coll in self.bad_collections:
                return httpx.Response(500, text="boom")
            base = 60900.0 if coll == "spherex_qr3" else 60700.0
            rows = [(f"https://archive.test/{coll}/level2_2025W{i:02d}_1A_0001_{i}D{1 + i % 6}_spx_l2b-v1-2025-100.fits",
                     f"{coll}-{i}", base + 30.0 * i, 0.75e-6, 1.1e-6, 113.0) for i in range(3)]
            return httpx.Response(200, content=_votable(rows))
        if "archive.test" in url:
            self.cutouts += 1
            assert "center=" in url and "size=" in url
            return httpx.Response(200, content=synthetic_cutout(270.0, 66.56, mjd=60800.0 + self.cutouts, detector=1, seed=self.cutouts))
        return httpx.Response(404)


@pytest.fixture
def live(monkeypatch, tmp_path):
    fake = FakeArchive()
    monkeypatch.setattr(settings, "mode", "live")
    monkeypatch.setattr(settings, "cache_dir", str(tmp_path))
    monkeypatch.setattr(settings, "allow_synthetic_fallback", True)
    client = irsa_mod.IRSAClient()
    client._client = httpx.Client(transport=httpx.MockTransport(fake), follow_redirects=True)
    monkeypatch.setattr(irsa_mod, "_client", client)
    service._cache.clear()
    yield fake
    service._cache.clear()


def test_live_field_is_labelled_irsa_and_time_ordered(live):
    f = service.get_field(270.0, 66.56)
    assert f.source == "irsa"
    assert len(f.images) == 6 and live.cutouts == 6          # 3 per release, two releases
    mjds = [e["mjd"] for e in f.epochs]
    assert mjds == sorted(mjds)
    assert not any("SYNTHETIC" in w for w in f.warnings)
    service.get_field(270.0, 66.56)
    assert live.cutouts == 6                                   # second call served from memory


def test_one_failing_release_is_skipped_with_a_warning(live):
    live.bad_collections = {"spherex_dr1"}
    f = service.get_field(10.0, 10.0)
    assert f.source == "irsa" and len(f.images) == 3
    assert any("spherex_dr1" in w for w in f.warnings)


def test_outage_falls_back_then_recovers(live, monkeypatch):
    live.down = True
    f = service.get_field(20.0, 20.0)
    assert f.source == "synthetic" and any("SYNTHETIC" in w for w in f.warnings)
    live.down = False
    monkeypatch.setattr(service, "_FALLBACK_TTL_S", 0.0)       # as if the short fallback cache had expired
    service._cache.clear()
    assert service.get_field(20.0, 20.0).source == "irsa"


def test_fallback_is_cached_only_briefly(live):
    live.down = True
    service.get_field(30.0, 30.0)
    (expires, _), = [v for k, v in service._cache.items() if k[0] == 30.0]
    import time
    assert expires - time.monotonic() <= service._FALLBACK_TTL_S + 1


def test_outage_without_fallback_fails_loudly(live, monkeypatch):
    live.down = True
    monkeypatch.setattr(settings, "allow_synthetic_fallback", False)
    with pytest.raises(RuntimeError):
        service.get_field(40.0, 40.0)


def test_non_fits_answer_is_rejected(live, monkeypatch):
    client = irsa_mod._client
    client._client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text="<html>maintenance</html>")))
    with pytest.raises(ValueError):
        client.fetch_cutout("https://archive.test/x.fits", 1.0, 2.0, 300)
