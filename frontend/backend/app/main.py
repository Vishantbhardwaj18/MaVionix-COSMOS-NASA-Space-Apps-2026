<<<<<<< HEAD
"""MaVionix COSMOS API: application wiring, middleware and error handling."""
from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .api.routes import router
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("cosmos")

app = FastAPI(
    title="MaVionix COSMOS API",
    description="SPHEREx sky viewer backend. NASA Space Apps 2026, 'Planet X and SPHEREx'.",
    version=__version__,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET"], allow_headers=["*"],
)

# --- per-client rate limit (in-memory, per worker; enough to stop accidental hammering) -------
_hits: dict[str, deque] = defaultdict(deque)
_EXEMPT = ("/api/health", "/api/status", "/api/showcase")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def guard(request: Request, call_next):
    rid = uuid.uuid4().hex[:10]
    limit = settings.rate_limit_per_min
    path = request.url.path
    if limit > 0 and path.startswith("/api/") and path not in _EXEMPT:
        now = time.monotonic()
        q = _hits[_client_ip(request)]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            retry = max(1, int(60 - (now - q[0])))
            return JSONResponse({"detail": f"Too many requests. Try again in {retry} s."}, status_code=429,
                                headers={"Retry-After": str(retry), "X-Request-ID": rid})
        q.append(now)
        if len(_hits) > 5000:          # bound memory
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > 60]:
                _hits.pop(k, None)
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:                   # never leak a traceback to the browser
        log.exception("unhandled error rid=%s %s", rid, request.url)
        return JSONResponse({"detail": "The server hit an unexpected error handling this request.", "request_id": rid},
                            status_code=500, headers={"X-Request-ID": rid})
    ms = (time.perf_counter() - t0) * 1000
    if path.startswith("/api/") and path not in ("/api/health",):
        log.info("rid=%s %s %s -> %s in %.0f ms", rid, request.method, request.url.path, response.status_code, ms)
    response.headers["X-Request-ID"] = rid
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if path in ("/api/showcase",):
        response.headers.setdefault("Cache-Control", "public, max-age=3600")
    return response


=======
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="MaVionix COSMOS API",
    description="SPHEREx Sky Time Machine — NASA Space Apps 2026, 'Planet X and SPHEREx'",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"], allow_headers=["*"],
)
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
app.include_router(router)


@app.get("/")
def root():
<<<<<<< HEAD
    return {"service": "MaVionix COSMOS API", "version": __version__, "docs": "/docs",
            "health": "/api/health", "status": "/api/status"}
=======
    return {"service": "MaVionix COSMOS API", "docs": "/docs", "health": "/api/health"}
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
