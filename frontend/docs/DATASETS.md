# Datasets and access methods

All data used by COSMOS are public NASA / JPL / IPAC products. Nothing is simulated except the
clearly-labelled offline demo set.

## 1. SPHEREx spectral images (primary)

| Item | Value |
|---|---|
| Mission | SPHEREx — NASA Astrophysics Medium Explorer, launched March 2025, all-sky 0.75–5.0 µm spectrophotometric survey, ~6-month cadence, 102 spectral channels across 6 detectors |
| Products used | **Quick Release 3 (QR3)** — current weekly quick release (from Sept 2026). **Data Release 1 (DR1)** — reprocessing of all QR2-era images (Nov 2026). Together they form a uniformly processed set. QR1/QR2 are retired/superseded and not used. |
| Level | Level-2 calibrated spectral images, one multi-extension FITS (MEF) per detector per pointing, 2040×2040 px, 6.15″/px, ~70 MB each |
| Extensions | `IMAGE` (MJy/sr, zodi not subtracted) · `FLAGS` (bitmap) · `VARIANCE` ((MJy/sr)²) · `ZODI` (model, MJy/sr) · `EPSF`/`PSF` · `WCS-WAVE` (pixel → central wavelength & bandwidth) |
| Bands | D1 0.75–1.09 µm (R≈39) · D2 1.10–1.62 (41) · D3 1.63–2.41 (41) · D4 2.42–3.82 (35) · D5 3.83–4.41 (112) · D6 4.42–5.00 (128) |
| Archive | NASA/IPAC Infrared Science Archive (IRSA), https://irsa.ipac.caltech.edu/Missions/spherex.html |
| Programmatic access | **SIAv2**: `https://irsa.ipac.caltech.edu/SIA?COLLECTION=<spherex_qr3|spherex_dr1>&POS=circle <ra> <dec> <r>` → VOTable with `access_url`, `t_min`, `em_min/em_max`. **IBE cutouts**: append `?center=<ra>,<dec>&size=<N>arcsec` to the file URL — returns a trimmed MEF with the same HDUs. **astroquery**: `astroquery.ipac.irsa.Irsa.query_sia(pos=..., collection=...)`. **AWS Open Data**: `s3://nasa-irsa-spherex/` (no account; `aws s3 ls --no-sign-request`). |
| Docs | Explanatory Supplement (SSDC-DP-017); Archive User Guide https://caltech-ipac.github.io/spherex-archive-documentation/ ; tutorials: spherex-intro, spherex-cutouts, spherex-psf, spherex-source-discovery-tool, spherex-mosaic |
| DOIs | QR3 10.26131/IRSA662 · DR1 spectral images 10.26131/IRSA678 · DR1 all-sky cube 10.26131/IRSA679 |
| Known issues | PSF-extension header error in products released before 31 Mar 2026 (fixed in QR3/DR1). WCS-WAVE is a lookup-table WCS that many readers do not support; COSMOS reads it defensively and falls back to the detector band range with an explicit `wavelength_source` flag. |

**Collection-name caveat.** The SIA collection identifiers are configured in
`COSMOS_SPHEREX_COLLECTIONS`. Run `python scripts/verify_irsa.py` once on a connected machine; if
IRSA renamed a collection, the script prints the browser URL to check and you change one env var.

## 2. JPL Solar System Dynamics

| API | Use in COSMOS | Endpoint |
|---|---|---|
| SBIdent | Which known asteroids/comets/TNOs are predicted inside a field at an epoch → labels tracks *known*/*unmatched* | `https://ssd-api.jpl.nasa.gov/sbident.api` (observer MPC 500 = geocentre; adequate for 6″ pixels except for very near-Earth objects) |
| SBDB Query | Osculating orbital elements for all TNOs with a > N AU → Planet X orbit plot | `https://ssd-api.jpl.nasa.gov/sbdb_query.api?sb-class=TNO&fields=full_name,a,e,i,om,w,q,...` |

## 3. Name resolution
CDS Sesame via `astropy.coordinates.get_icrs_coordinates` (e.g. “Makemake”, “Vega”).
For moving targets (comets, TNOs) a fixed name → position is only valid at one epoch; use RA/Dec.

## 4. Complementary (not integrated, documented for context)
* NEOWISE / AllWISE 3.4 & 4.6 µm images (IRSA) — longer time baseline for slow movers.
* Pan-STARRS DR2, ZTF, DES — the optical surveys that already exclude ~78 % of the Brown & Batygin
  (2021) Planet Nine parameter space (Brown, Holman & Batygin 2024).
* Planck CMB maps — only relevant if a cosmology context page is added; not SPHEREx data.

## 5. Synthetic demo data
`backend/app/data/synthetic.py` generates MEFs with the documented HDU layout and a known injected
mover. Primary header `SYNTHETC=True`; every API response carries `is_synthetic` and the UI shows a
persistent badge. Used only when `COSMOS_MODE=demo` or when live data are unavailable and fallback
is enabled.
<<<<<<< HEAD

## 6. Background night sky (cosmetic, real data)
The animated page background is drawn from real catalogue data, not random dots.

| Layer | Data | Source |
|---|---|---|
| Stars (positions, V magnitude, B-V colour) | Hipparcos / Yale Bright Star catalogues, `stars.6.json` (to mag 6) and `stars.8.json` (to mag 8) | d3-celestial 0.7.35 (BSD-3, O. Frohn) |
| Milky Way | Measured isophote outlines, `mw.json`, shaded with galactic structure (warm bulge, Great Rift dust lanes) | d3-celestial 0.7.35 |
| Large & Small Magellanic Clouds, 47 Tuc, NGC 362 | J2000 centres, angular sizes, position angles; HII regions (30 Doradus, N11/NGC 1763, N44, N159, N119, N70, NGC 346) at catalogue coordinates | Published values, hard-coded in `SpaceBackground.tsx`. The shading inside them is procedural |

The LMC is there because SPHEREx's first science images were scans across the LMC and the NGC 1763 region.

Stars and the Milky Way are served from this site (`frontend/public/data/sky/`) in a compact form
built by `npm run build:sky` from the d3-celestial package; the built files and the package licence
are committed, so nothing is fetched from a third party at build time or in the browser. If the
files are missing, the background falls back to a statistical starfield and an analytic Galactic
band. Everything is projected with a true stereographic projection and rotates about the celestial
pole; none of it is used by the science pages.

## 7. Planet orbits (NASA/JPL, bundled)
The 3D view on the Planet Nine page places Earth, Jupiter, Saturn, Uranus and Neptune with JPL's
"Keplerian Elements for Approximate Positions of the Major Planets", Table 1 (valid 1800 to 2050),
from https://ssd.jpl.nasa.gov/planets/approx_pos.html . The five rows and their rates are copied
unchanged into `frontend/src/lib/orbits.ts` and were checked against that page on 2026-11-16.
Positions for today's date follow the formulae on the same page (elements plus rates, then Kepler's
equation). JPL quotes errors of tens of arcseconds to a few arcminutes for this method over that
interval, far below what is visible at the scale of the drawing. This dataset needs no network.

## 8. The proposed Planet Nine orbit (a hypothesis)
From Brown & Batygin (2021), "The Orbit of Planet Nine", AJ 162, 219, arXiv:2108.09868:

| Use on the site | Values | Where in the paper |
|---|---|---|
| The dashed orbit in the 3D view | 5 Earth masses, a = 300 au, e = 0.15, i = 17 deg, longitude of perihelion 254 deg, ascending node 108 deg | the maximum-likelihood model |
| Text and caption | mass 6.2 (+2.2/-1.3) Earth masses, a = 380 (+140/-80) au, i = 16 +/- 5 deg, perihelion 300 (+85/-60) au | the abstract |
| Background of the Planet Nine page | plane with i = 16 deg and node 97 deg; sky-probability peak near RA 45 deg | their description of the search swath and sky map |

The single curve is one model from a wide posterior. The site labels it as a hypothesis wherever it
appears. No such planet has been observed.

## 9. Which sky is behind each page
| Page | Region | Why |
|---|---|---|
| Start | Large Magellanic Cloud | SPHEREx's first science images |
| Viewer | The field being viewed, about 60 degrees across | So the surroundings of the cutout are the real ones |
| Movers | Zodiac through Taurus and Gemini, with the ecliptic drawn | Most moving objects keep close to the ecliptic |
| Spectrum | Galactic centre in Sagittarius | Dust-reddened starlight |
| Planet Nine | Near RA 45 deg on the Brown & Batygin plane, with that plane and the ecliptic drawn | The likeliest region in that paper |
| How it works | Southern Milky Way through Carina and Crux | |

All six are the same Hipparcos/Tycho catalogue and Milky Way outlines seen in different directions
through a stereographic projection. Constellation figures on the globe are d3-celestial's
`constellations.lines.json` (BSD-3-Clause).
=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
