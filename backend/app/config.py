"""Runtime configuration (all overridable via environment variables / .env)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="COSMOS_", extra="ignore")

    # --- IRSA / SPHEREx ---------------------------------------------------
    # IRSA SIAv2 endpoint. Collections are discoverable at
    # https://irsa.ipac.caltech.edu/SIA?COLLECTION=... ; see docs/DATASETS.md.
    irsa_sia_url: str = "https://irsa.ipac.caltech.edu/SIA"
    # Comma-separated list, searched in order. QR3 is the current quick release;
    # DR1 reprocesses QR2 so QR3 + DR1 form one uniformly processed set.
    spherex_collections: str = "spherex_qr3,spherex_dr1"
    # IBE cutout parameters appended to the file access URL.
    cutout_size_arcsec: float = 600.0          # ~100 SPHEREx pixels (6.15"/px)
    max_epochs: int = 40
    http_timeout_s: float = 60.0

    # --- JPL --------------------------------------------------------------
    jpl_sbident_url: str = "https://ssd-api.jpl.nasa.gov/sbident.api"
    jpl_sbdb_query_url: str = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
    # SPHEREx is in a ~650 km sun-synchronous LEO; for 6" pixels the geocentre
    # (MPC code 500) is an adequate observer location for distant bodies.
    observer_mpc_code: str = "500"

    # --- Science parameters ----------------------------------------------
    pixel_scale_arcsec: float = 6.15
    # Approximate 5-sigma point-source depth per spectral channel for the
    # all-sky survey (AB mag). Used ONLY for the detectability estimate; the
    # UI labels it as approximate. Adjust after checking the Explanatory
    # Supplement for the current release.
    survey_depth_ab: float = 19.0
    detect_threshold_sigma: float = 5.0

    # --- Behaviour --------------------------------------------------------
    # demo: never touch the network, serve labelled synthetic data.
    # live: query IRSA/JPL; fall back to synthetic with is_synthetic=True
    #       only if COSMOS_ALLOW_SYNTHETIC_FALLBACK=true.
    mode: str = "live"
    allow_synthetic_fallback: bool = True
    cache_dir: str = "/tmp/cosmos-cache"
    cors_origins: str = "http://localhost:3000"
    # Requests per client per minute on the data endpoints (0 disables the limit).
    rate_limit_per_min: int = 120


settings = Settings()
