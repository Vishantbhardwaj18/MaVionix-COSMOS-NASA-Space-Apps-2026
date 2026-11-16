<<<<<<< HEAD
# COSMOS: SPHEREx sky, over time

A public web viewer for NASA's SPHEREx infrared sky survey, built by MaVionix for the 2026 NASA
Space Apps Challenge, "Planet X and SPHEREx". 

Type a sky position or an object's name. COSMOS finds every SPHEREx image of that spot in the
NASA/IPAC Infrared Science Archive (IRSA) and lets you blink, swipe or difference any two visits to
see what changed. It also finds things that moved, checks them against JPL's catalogue of known
bodies, builds a spectrum from repeat visits, and shows what SPHEREx can and cannot say about
Planet Nine.

Note: You May Direclty Download the zip file for ease.
![The viewer](docs/screenshots/viewer.png)

| | |
|---|---|
| ![Sky globe](docs/screenshots/globe.png) | ![Image as a 3D surface](docs/screenshots/viewer-surface.png) |
| ![Outer Solar System in 3D](docs/screenshots/planet-nine.png) | ![Measuring one source in every visit](docs/screenshots/viewer-measure.png) |

All screenshots here were taken in sample mode, so they carry the "Synthetic sample" badge.

> **What this tool does not claim.** It has not found Planet X and says so on every page. A track
> that matches no catalogued body is labelled *unmatched*, never *new*. When the archive cannot be
> reached, the site shows a generated test field that is labelled "Synthetic sample, not SPHEREx
> data" on screen, in exported images and in the CSV.

## Run it

You need Python 3.11 or newer and Node.js 20 or newer.

| | macOS / Linux | Windows |
|---|---|---|
| Start with real data | `./run.sh` | `run.bat` |
| Start with the offline sample | `./run.sh demo` | `run.bat demo` |
| Check this computer can reach the archive | `./run.sh check` | `run.bat check` |

The first start installs everything and builds the site, which takes a few minutes. Then open
**http://localhost:3000**. Press Ctrl+C to stop.

With Docker instead: `docker compose up --build`, then open http://localhost:3000.
For the offline sample: `COSMOS_MODE=demo docker compose up --build`.

### Check live data first

```bash
./run.sh check        # Windows: run.bat check
```

This asks IRSA for images of the north ecliptic pole, downloads one cutout, reads every part of it,
and queries both JPL services. It prints `ALL LIVE CHECKS PASSED` or says exactly which step failed
and which URL to open in a browser. **The live path was developed from the archive's published
documentation in an environment without access to IRSA or JPL, and has been tested only against a
stand-in archive. Run this check before relying on, or presenting, real data.** If the release
names have changed, set `COSMOS_SPHEREX_COLLECTIONS` in `backend/.env`.

The dot beside the site name shows the result at a glance: "Archive online" or "Sample data".

### Manual start, for development

```bash
# terminal 1: API on http://localhost:8000 (interactive docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000             # add COSMOS_MODE=demo for the sample

# terminal 2: website on http://localhost:3000
cd frontend
npm install
npm run dev
```

The website forwards `/api/*` to the API, so there is nothing to configure when both run on one
machine. To point it elsewhere, set `COSMOS_API_URL` (see `frontend/.env.example`).

## What is in it

| Page | What you can do |
|---|---|
| **Start page** | A blinking deep field, and a 3D globe of the whole sky (real bright stars, constellations, ecliptic, SPHEREx's deep fields) that you turn and click to choose a position. |
| **Viewer** | See every visit of a field. Step, blink, swipe or difference two visits, play all visits as a timelapse, or view the image as a 3D surface with brightness as height. Click a star to measure it in every visit. Zoom and pan with mouse, touch or keyboard. Read RA/Dec, surface brightness and the wavelength recorded at the cursor. Overlay JPL-predicted known bodies and detected movers. Copy a link to the exact view. Save the view as a captioned PNG. |
| **Movers** | Sources found in one visit and not the others, linked into tracks, each compared with JPL's predictions and labelled *known* or *unmatched* with the evidence. CSV download. |
| **Spectrum** | Aperture photometry of one source in every visit, giving a sparse 0.75 to 5 µm spectrum, with an indicative comparison against five simple shapes. |
| **Planet Nine** | The outer Solar System in 3D: orbits of the most distant known objects with their real tilts, the giant planets at today's positions from JPL's planetary elements, and one published model of the proposed orbit drawn as a hypothesis. Also a brightness calculator and a measured completeness curve for the current field. |
| **How it works** | Data sources, each processing step, limits, privacy, and how the site was built. |

Keyboard in the viewer: `←` `→` change visit A, `[` `]` change visit B, `space` plays or pauses,
`1` to `6` switch mode, `i` inverts, `+` `-` `0` zoom and fit.

The background of every page is the real sky (Hipparcos and Tycho stars at their catalogued
positions and colours), looking at a different region on each page. The foot of the page says
which. The 3D views need WebGL; where it is missing the site shows the flat equivalents.

## How it is put together

```
frontend/   Next.js 16, React 19, TypeScript, Tailwind 4, Recharts, three.js
            src/components/SkyCanvas.tsx     canvas viewer: 16-bit pixels, asinh stretch, WCS readout
            src/components/SkyGlobe.tsx      3D sky globe for choosing a field
            src/components/Surface3D.tsx     image as a 3D surface
            src/components/OrbitScene3D.tsx  outer Solar System in 3D
            src/components/SpaceBackground.tsx  real-sky background, one region per page
            src/lib/orbits.ts                JPL planetary elements, Kepler maths, Planet Nine reference
            src/lib/skyScene.ts              which region of sky each page faces
            src/app/api/[...path]/route.ts   same-origin proxy to the API
backend/    FastAPI, Astropy, photutils, NumPy, SciPy, httpx
            app/core/irsa.py                 IRSA image search and cutouts, cached on disk
            app/core/fits_tools.py           SPHEREx multi-extension FITS reader
            app/core/service.py              field loading, parallel downloads, fallback rules
            app/science/                     movers, JPL matching, spectra, detectability
            app/data/synthetic.py            the labelled offline sample
tests/      e2e_smoke.py                     browser test of every page, desktop and phone
docs/       methods, datasets, architecture, testing, deployment, pitch, demo script
```

There is no database. Cutouts are cached on disk and JPL answers as JSON.
=======
# MaVionix COSMOS — SPHEREx Sky Time Machine

**NASA Space Apps Challenge 2026 · Sonipat · Challenge: “Planet X and SPHEREx”**
*Explore the Universe. Decode Cosmic Mysteries.*

A public web tool that shows how NASA SPHEREx’s infrared sky changes over time — and goes
three steps further: explainable moving-object detection with JPL identification, multi-epoch
spectral fingerprints that exploit SPHEREx’s linear-variable filters, and an honest “could SPHEREx
see Planet Nine?” calculator with measured completeness.

| Page | What it does |
|---|---|
| **Viewer** | Coordinates or a name → every SPHEREx visit covering it (IRSA SIA + cutouts). Canvas viewer with zoom/pan, step / blink / swipe / difference, adjustable asinh stretch, live RA/Dec, surface brightness and *wavelength* under the cursor, overlays for JPL-known bodies and detected movers, keyboard control |
| **Movers** | 5σ source extraction per epoch → cross-epoch linking → JPL SBIdent match → evidence cards, CSV report |
| **Spectrum** | Forced photometry along a track across epochs/detectors → sparse 0.75–5 µm spectrum → indicative template comparison |
| **Planet Nine** | Real TNO orbits (JPL SBDB), the clustering argument, reflected-light brightness vs SPHEREx depth, injection–recovery completeness |
| **How it works** | Full processing chain, data citations, limitations, what we do *not* claim |

> **Scientific-integrity statement.** This tool never claims to have found Planet X. Tracks that
> do not match a JPL ephemeris are labelled *unmatched*, not *new*. Synthetic data (offline demo
> and tests) is always badged **SYNTHETIC DATA — NOT SPHEREx**.

---

## Architecture

```
frontend/  Next.js 16 · TypeScript · Tailwind 4 · Recharts · self-hosted Spectral + IBM Plex Sans
           components/SkyCanvas.tsx  canvas renderer: 16-bit pixels → asinh LUT, TAN WCS cursor readout,
                                     reprojection-free swipe/blink, markers; lib/wcs.ts gnomonic maths
backend/   FastAPI · Astropy · photutils · NumPy/SciPy · httpx
           app/core/irsa.py      IRSA SIAv2 query + IBE cutouts (cached on disk)
           app/core/fits_tools.py SPHEREx MEF reader (IMAGE/FLAGS/VARIANCE/ZODI/WCS-WAVE)
           app/core/render.py    asinh stretch, WCS reprojection, difference imaging
           app/science/movers.py detection · linking · evidence · parallax distance hint
           app/science/jpl.py    SBIdent (known bodies) · SBDB (TNO elements)
           app/science/spectrum.py forced photometry · templates
           app/science/detectability.py Planet-Nine brightness · injection–recovery
           app/data/synthetic.py labelled synthetic MEFs for offline demo/tests
docs/      DATASETS · METHODOLOGY · ARCHITECTURE · TESTING · DEPLOYMENT · PITCH · DEMO_SCRIPT · INNOVATION
```

No database is required for the hackathon build: epochs and cutouts are cached on disk
(`COSMOS_CACHE_DIR`), JPL results are cached as JSON. See `docs/ARCHITECTURE.md` for the optional
PostgreSQL schema if you want persistent candidate storage.

## Quick start (local)

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/verify_irsa.py 270 66.56               # live data checks — run this first
uvicorn app.main:app --reload --port 8000             # http://localhost:8000/docs

# 2. Frontend (new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                                           # http://localhost:3000
```

Offline / no-internet demo: `COSMOS_MODE=demo uvicorn app.main:app --port 8000` (everything is
badged synthetic). In `live` mode the API falls back to synthetic data **only** if IRSA returns
nothing and `COSMOS_ALLOW_SYNTHETIC_FALLBACK=true` (default); set it to `false` for judging if you
want hard failures instead.

## Docker

```bash
docker compose up --build        # web on :3000, api on :8000
```
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

## Tests

```bash
<<<<<<< HEAD
cd backend && python -m pytest -q                         # 21 tests, no network needed
cd frontend && npm run typecheck && npm run lint && npm run build
./run.sh demo & python tests/e2e_smoke.py                 # browser test; needs playwright
```

The backend tests cover the FITS reader, reprojection, mover detection on a field with a known
injected mover, photometry, the Planet Nine estimate, every API route, rate limiting, and the live
code path run against a stand-in archive (partial failure, outage, fallback and recovery). See
`docs/TESTING.md`. GitHub Actions runs the backend and frontend checks on every push.

## Settings

Backend settings are environment variables or lines in `backend/.env`; see `backend/.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `COSMOS_MODE` | `live` | `live` queries IRSA and JPL. `demo` never touches the network. |
| `COSMOS_ALLOW_SYNTHETIC_FALLBACK` | `true` | In live mode, show the labelled sample when the archive gives nothing. Set `false` to get an error instead. |
| `COSMOS_SPHEREX_COLLECTIONS` | `spherex_qr3,spherex_dr1` | IRSA release names, newest first. |
| `COSMOS_CUTOUT_SIZE_ARCSEC` | `600` | Cutout width, about 98 SPHEREx pixels. |
| `COSMOS_MAX_EPOCHS` | `40` | Most visits loaded for one field. More are sampled evenly in time. |
| `COSMOS_SURVEY_DEPTH_AB` | `19.0` | Approximate per-channel depth used on the Planet Nine page. |
| `COSMOS_RATE_LIMIT_PER_MIN` | `120` | Requests per client per minute. `0` turns the limit off. |
| `COSMOS_CACHE_DIR` | `/tmp/cosmos-cache` | Where cutouts are cached. |

Putting it online is covered in `docs/DEPLOYMENT.md`.

## Data and credits

- **SPHEREx** spectral images: NASA/JPL-Caltech/IPAC, from the NASA/IPAC Infrared Science Archive.
  Quick Release 3, DOI 10.26131/IRSA662. Data Release 1, DOI 10.26131/IRSA678.
- **Small-body positions and orbits**: JPL Solar System Dynamics (SBIdent and Small-Body Database).
- **Planet orbits and positions**: JPL "Approximate Positions of the Planets", Table 1, bundled in
  `frontend/src/lib/orbits.ts`. This NASA/JPL dataset works with no network connection.
- **Proposed Planet Nine orbit**: Brown & Batygin (2021), AJ 162, 219. Shown as a hypothesis.
- **Object names**: CDS Sesame.
- **Background and globe stars, constellation figures and Milky Way**: Hipparcos and Tycho catalogues as packaged by d3-celestial
  (BSD-3-Clause, Olaf Frohn). Licence in `frontend/public/data/sky/`.

"This product makes use of data from the Spectro-Photometer for the History of the Universe, Epoch
of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion
Laboratory and the California Institute of Technology, and is funded by NASA."

COSMOS is a student project. It is not affiliated with or endorsed by NASA, JPL or Caltech, and
uses no NASA logos or mission insignia.

## Use of AI tools
The team used an AI assistant to help debug the code, and reviewed and
tested the result. No images, audio or video in the application are AI-help taken for the backgrounds
and 3D views(frontend) are drawn in the browser from catalogue data, and the offline sample field is produced
by a documented algorithm in `backend/app/data/synthetic.py`.

## Licence

Code: MIT, see `LICENSE`. Data remain under their providers' terms.
=======
cd backend && pytest -q          # 13 tests, fully offline (synthetic MEFs)
cd frontend && npm run build     # type-check + production build
```

## Configuration (`backend/.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `COSMOS_MODE` | `live` | `live` or `demo` |
| `COSMOS_SPHEREX_COLLECTIONS` | `spherex_qr3,spherex_dr1` | IRSA SIA collection names, searched in order |
| `COSMOS_IRSA_SIA_URL` | `https://irsa.ipac.caltech.edu/SIA` | SIAv2 endpoint |
| `COSMOS_CUTOUT_SIZE_ARCSEC` | `600` | cutout width (≈98 px) |
| `COSMOS_SURVEY_DEPTH_AB` | `19.0` | approximate per-channel 5σ depth used in the detectability panel |
| `COSMOS_CORS_ORIGINS` | `http://localhost:3000` | comma-separated |

## Data credits

SPHEREx data: NASA/JPL-Caltech/IPAC, served by the NASA/IPAC Infrared Science Archive (QR3 DOI
10.26131/IRSA662, DR1 DOI 10.26131/IRSA678). Small-body data: JPL Solar System Dynamics.
“This product makes use of data from the Spectro-Photometer for the History of the Universe, Epoch
of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion
Laboratory and the California Institute of Technology, and is funded by NASA.”

## Team

MaVionix (mavionix.in) — Sonipat local event, 2026 NASA International Space Apps Challenge.
License: MIT (code). Data remain under their providers’ terms.
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
#   N a s a - S p a c e - C h a l l e n g e - 2 0 2 6 - M a V i o n i x - C o s m o s - F i n a l  
 