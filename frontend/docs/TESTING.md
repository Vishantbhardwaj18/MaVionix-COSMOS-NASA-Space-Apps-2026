# Testing report

## Automated (offline, reproducible)
<<<<<<< HEAD
`cd backend && python -m pytest -q`: **21 passed**, no network needed.
=======
`cd backend && pytest -q` — **13 passed** (Python 3.13, astropy 8.0, photutils 3.1, FastAPI 0.163).
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

| Test | What it proves |
|---|---|
| `test_mef_roundtrip_reads_all_documented_hdus` | Reader handles IMAGE/FLAGS/VARIANCE/ZODI/WCS-WAVE, detector/MJD headers, synthetic flag |
| `test_wavelength_fallback_to_band_range` | Missing WCS-WAVE degrades to band centre with an explicit `band-range-only` label |
| `test_reprojection_is_identity_on_same_wcs` | WCS reprojection introduces < 1e-4 error on identity |
| `test_stretch_outputs_uint8` | Display stretch is well-formed |
| `test_mover_detection_recovers_injected_track` | A 3.2 px/epoch injected mover is recovered as one 2+-epoch track with plausible rate, status `unmatched` (never “discovered”) |
| `test_no_movers_in_static_field` | Zero false tracks on a static star field with independent noise per epoch |
| `test_forced_photometry_and_classification` | Positive fluxes with `wcs-wave` wavelengths on a static star; classifier returns a best template labelled *indicative* |
| `test_planet_nine_is_too_faint_for_single_exposure` | Default Planet Nine parameters give V > 21 and `detectable = False`, parallax > 30 px |
| `test_injection_recovery_curve_is_monotone_ish` | Completeness ≥ 0.8 at 14 AB and ≤ 0.2 at 22 AB on synthetic data |
| `test_api_health_and_showcase` | Service and showcase endpoints |
| `test_api_epochs_are_labelled_synthetic_in_demo_mode` | Demo mode responses carry `source="synthetic"`, a SYNTHETIC warning, and per-frame flags |
| `test_api_diff_movers_spectrum_report` | End-to-end: diff → movers (with thumbnails and disclaimer) → spectrum along the track → CSV report |
| `test_api_validation` | 400s on missing/invalid coordinates |
<<<<<<< HEAD
| `test_status_and_headers_in_demo_mode` | `/api/status` reports sample mode; security headers and a request id are set |
| `test_rate_limit_returns_429` | The per-client limit answers 429 with `Retry-After`; health checks are never limited |

### The live code path against a stand-in archive (`tests/test_live_path.py`)
These replace the HTTP transport with a fake that answers as IRSA's documentation describes: a
VOTable from the image search and a FITS cutout from each access URL. They prove the plumbing, not
that the real archive agrees; only `scripts/verify_irsa.py` can show that.

| Test | What it proves |
|---|---|
| `test_live_field_is_labelled_irsa_and_time_ordered` | Two releases are queried, six cutouts fetched in parallel, visits come back in time order labelled `irsa`, and a repeat call downloads nothing |
| `test_one_failing_release_is_skipped_with_a_warning` | A release that answers HTTP 500 is left out with a visible warning; the other still loads |
| `test_outage_falls_back_then_recovers` | With the archive down the labelled sample is served; once it is back, real data is served again |
| `test_fallback_is_cached_only_briefly` | An outage fallback is cached for at most 90 seconds |
| `test_outage_without_fallback_fails_loudly` | With fallback turned off, an outage is an error, not sample data |
| `test_non_fits_answer_is_rejected` | An HTML maintenance page in place of a cutout is refused and not cached |

## Frontend
`npm run typecheck`, `npm run lint` and `npm run build` pass with no errors or warnings. Two lint
rules are switched off with reasons in `eslint.config.mjs`.

## Browser smoke test (`tests/e2e_smoke.py`)
Run against sample mode at 1440x900 and at 390x800 with touch. On each it checks: the landing page
and its archive status; the viewer's provenance badge; that mode, visits and the movers overlay
are written to the link; arrow-key control; the PNG export; the Movers page and the step from a
track to its spectrum; the Planet Nine page; the methods page; the 404 page; a readable error for
impossible coordinates; no sideways scrolling on any page; and no page errors. Since 1.2 it also
clicks the 3D globe to choose a position, opens the 3D surface view, checks the timelapse advances,
clicks the image to measure a source in every visit, checks the 3D orbit view and its flat
alternative, and checks that the background caption changes between pages. WebGL runs in software
(SwiftShader) in this test. Result on the last run: 44 of 44 checks passed. Defects this test has caught and that are now fixed: the movers
checkbox not responding while a search ran, and the header overflowing on phones.

## Live validation checklist (run on a connected machine)
1. `./run.sh check` → all five checks pass, and the header dot reads "Archive online"; note the number of epochs
   at the North Ecliptic Pole (expect many).
2. Viewer, NEP field: blink two same-band epochs; stars must be static, noise pattern must change.
3. Difference of a *different-band* pair must show the wavelength-mismatch warning.
4. Movers page on an ecliptic field near opposition: at least one `known` track (main-belt
   asteroid) with the JPL name and mean separation < 15″.
5. Movers page on a high-|β|, high-|b| field: zero or only low-score candidates.
6. Spectrum of a bright static star: ≥ 6 points spanning ≥ 3 detectors; cool-star template preferred.
7. Injection–recovery on a real NEP cutout: 50 % depth within ~0.5 mag of the configured survey depth.
8. Planet Nine page: the orbit panel shows no "JPL unreachable" notice; the a > 250 AU, q > 30 AU perihelia cluster on one side.
=======

Frontend: `npm run build` — TypeScript strict type-check and production build pass (5 routes).
Headless browser smoke test (Playwright, demo mode): landing with live blinking preview, viewer with
cursor readout, movers overlay drawn on the canvas, difference mode with the wavelength-mismatch
notice, Movers evidence page, Spectrum along a track, Planet Nine with completeness run. No page
errors; the only console error is the expected 503 from JPL when offline, which the UI handles with
a labelled fallback. One UX defect was found and fixed by this test: the "things that moved"
checkbox did not reflect the click while the search was running.

## Live validation checklist (run on a connected machine)
1. `python backend/scripts/verify_irsa.py 270 66.56` → all five checks pass; note the number of epochs
   at the North Ecliptic Pole (expect many).
2. Sky Time Machine, NEP field: blink two same-band epochs; stars must be static, noise pattern must change.
3. Difference of a *different-band* pair must show the wavelength-mismatch warning.
4. Mover Detective on an ecliptic field near opposition: at least one `known` track (main-belt
   asteroid) with the JPL name and mean separation < 15″.
5. Mover Detective on a high-|β|, high-|b| field: zero or only low-score candidates.
6. Spectrum of a bright static star: ≥ 6 points spanning ≥ 3 detectors; cool-star template preferred.
7. Injection–recovery on a real NEP cutout: 50 % depth within ~0.5 mag of the configured survey depth.
8. Planet X page: SBDB badge shows “live”; the a > 250 AU, q > 30 AU perihelia cluster on one side.
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4

Record results in this file before submission (date, field, outcome, screenshot path).

## Known gaps
<<<<<<< HEAD
* Live IRSA and JPL calls were written from the documented endpoints and have never been run against
  the real services: the build environment could not reach those hosts. Step 1 above is therefore
  mandatory, and the checklist results should be recorded here before real data is presented.
* The browser test runs in Chromium only, with software WebGL. Safari, Firefox and real phone GPUs have not been checked.
* The orbit maths has no automated test; it was checked by hand against known values (Sedna's perihelion direction, Jupiter's heliocentric longitude for the build date).
* No load testing has been done. The rate limit is per process and in memory.
=======
* Live IRSA/JPL calls were implemented against the documented endpoints but could not be executed in
  the build environment (no outbound access to those hosts). Step 1 above is therefore mandatory.
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
* No aperture corrections; photometry is relative-quality.
* Linking is linear; fast or curved tracks across > 3 epochs may fragment into several candidates.
