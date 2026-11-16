# Technical architecture

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│ Next.js 16 (App Router, TypeScript, Tailwind 4)                         │
│  /            Sky Time Machine   step · blink · swipe · diff            │
│  /detective   Mover Detective    candidates · evidence · CSV            │
│  /spectrum    Spectral Fingerprint (Recharts scatter + error bars)      │
│  /planetx     TNO orbit SVG · brightness calculator · completeness      │
│  /about       methods, data, limitations                                │
│  state: URL search params (ra, dec, target, synthetic) → shareable links│
└───────────────▲────────────────── JSON / base64 PNG ────────────────────┘
                │ REST (CORS)
┌───────────────┴────────────────── FastAPI ──────────────────────────────┐
│ api/routes.py                                                           │
│  GET /api/health /api/showcase                                          │
│  GET /api/sky/epochs   → service.get_field → frames (PNG, metadata, λ)  │
│  GET /api/sky/diff     → reproject + difference (PNG and 16-bit)        │
│  GET /api/sky/known    → JPL SBIdent bodies in a visit, pixel coords    │
│  GET /api/status       → can the server reach IRSA and JPL right now?   │
│  GET /api/movers       → movers.find_movers → jpl.match_candidates      │
│  GET /api/spectrum     → spectrum.forced_photometry (+ track)           │
│  GET /api/planetx/*    → jpl.tno_elements · detectability.*             │
│  GET /api/report.csv                                                    │
│ core/service.py  in-process LRU of loaded fields (16)                   │
│ core/irsa.py     SIAv2 + IBE cutouts, on-disk cache (sha1 keyed)        │
│ core/fits_tools  defensive MEF reader                                   │
└───────┬───────────────────────────┬──────────────────────────┬──────────┘
        │ HTTPS                     │ HTTPS                    │ HTTPS
  IRSA SIAv2 + IBE          JPL SBIdent / SBDB            CDS Sesame
  (SPHEREx QR3 / DR1)
```

## Why these choices
* **FastAPI + Astropy** — the SPHEREx MEF, WCS-WAVE lookup table and reprojection are native to the
  Python astronomy stack; no reimplementation risk.
* **Cutouts, not files** — a 70 MB MEF per detector per epoch would make a live web tool unusable.
  IBE cutouts (≈ 100×100 px, < 1 MB) keep first-load under a minute even for 20+ epochs.
* **16-bit pixels + WCS to the browser** — each frame ships its quantised pixels (≈20 kB for a
  100×100 cutout), a TAN WCS and a 16×16 wavelength grid. The canvas applies the stretch, draws
  blink/swipe/difference, and computes RA/Dec and wavelength under the cursor with no further
  requests. A small PNG thumbnail is included for lists.
* **No database by default** — disk cache + URL state are enough for a demo. The optional schema
  below adds persistence for candidate curation.
* **Classical detection** — DAOStarFinder + linking + ephemeris matching is explainable and needs no
  labelled training set. An ML real/bogus classifier is the natural next step (see INNOVATION.md).
* **Next.js App Router** — static pages, URL-driven state (shareable links to a field and a
  candidate), good enough SEO for a public tool.

## Optional PostgreSQL schema (persistence / curation)
```sql
CREATE TABLE field (
  id SERIAL PRIMARY KEY, ra DOUBLE PRECISION, dec DOUBLE PRECISION,
  size_arcsec REAL, source TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE epoch (
  id SERIAL PRIMARY KEY, field_id INT REFERENCES field(id),
  obs_id TEXT, detector SMALLINT, collection TEXT, mjd DOUBLE PRECISION,
  access_url TEXT, lambda_centre_um REAL, noise_sigma REAL, is_synthetic BOOL);
CREATE TABLE candidate (
  id SERIAL PRIMARY KEY, field_id INT REFERENCES field(id), label TEXT,
  status TEXT CHECK (status IN ('unmatched','known','artefact')),
  jpl_name TEXT, rate_arcsec_day REAL, pa_deg REAL, score REAL,
  reasons JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE detection (
  id SERIAL PRIMARY KEY, candidate_id INT REFERENCES candidate(id),
  epoch_id INT REFERENCES epoch(id), x REAL, y REAL,
  ra DOUBLE PRECISION, dec DOUBLE PRECISION, snr REAL, flagged BOOL);
CREATE INDEX ON field USING gist (point(ra, dec));   -- or PostGIS geography if preferred
```
Sky indexing can be done with HEALPix (`astropy_healpix`) rather than PostGIS; PostGIS is not
required for this workload.

## Performance notes
* First load of a field: dominated by IRSA (N cutouts × ~1–3 s). Cutouts are cached on disk; a
  warm field renders in < 1 s.
* `/api/movers` on 20 epochs × 100×100 px: < 2 s CPU.
* Injection–recovery: 9 magnitudes × 12 injections × detection ≈ 3–6 s; `n_per_mag` is capped at 40.
* For judging/demo, pre-warm the showcase fields: `curl "$API/api/sky/epochs?ra=270&dec=66.56"`.

## Request path and operations (1.1)

```
browser ──► website (Next.js) ──/api/*──► API (FastAPI) ──► IRSA, JPL, CDS
            same origin           gzip, rate limit, request id, security headers
```

* The browser never calls the API host directly. `frontend/src/app/api/[...path]/route.ts` forwards
  the request and reads `COSMOS_API_URL` at run time, so one built image works on any host.
* `core/service.py` holds one lock per field, so two simultaneous requests for the same field cause
  one download. Cutouts are fetched four at a time and written to the disk cache atomically.
* Results from the archive stay in memory for six hours. A fallback to the sample that was caused
  by an outage is kept for 90 seconds only, so the site recovers on its own.
* The viewer keeps its state (field, visits A and B, mode, movers overlay) in the address bar.

## 3D views and backgrounds (1.2)

* `lib/three-stage.ts` wraps three.js for all three 3D views: one renderer, orbit controls, labels
  that keep their pixel size, drawing only when something changed, and full clean-up on unmount.
  three.js is loaded with `next/dynamic` only when a 3D view opens.
* Every 3D view reports WebGL failure to its page, which then shows the flat equivalent.
* `SpaceBackground` is a 2D canvas that projects the star catalogue stereographically. The route
  and the viewer's resolved field select a scene from `lib/skyScene.ts`; the camera basis is
  interpolated to the new scene over 1.7 s (not at all under reduced motion).
