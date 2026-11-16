# Scientific methodology

## 0. Design principle
Every number shown to a user must be traceable to a documented data product and a stated
algorithm, and every claim must carry its uncertainty. Where the data cannot support a claim
(e.g. “this is a new object”), the interface says so instead of hedging with vague language.

## 1. From position to epochs
1. Resolve input to ICRS RA/Dec (degrees or Sesame).
2. SIAv2 cone search (radius = half the cutout width) against QR3, then DR1.
3. For each returned spectral image, request an IBE cutout (default 600″ ≈ 98 px) so the service
   never moves 70 MB files. Cutouts preserve IMAGE, FLAGS, VARIANCE, ZODI and WCS-WAVE.
4. Sort by MJD; cap at 40 epochs (configurable).

## 2. Background and display
* Subtract the ZODI model extension (the dominant diffuse background at 1–5 µm), then a robust
  median of unflagged pixels.
* Noise σ = √(median VARIANCE) if available, else 1.4826·MAD.
* Display stretch: asinh with a = 0.1 between the 1st and 99.5th percentiles; 4× nearest-neighbour
  upscaling to keep individual SPHEREx pixels visible (no interpolation that could invent structure).

## 3. Difference imaging across a linear-variable filter
SPHEREx detectors carry linear-variable filters: wavelength changes continuously across each
detector. Two epochs of the same sky position therefore usually sample *different* wavelengths, and
a naive difference leaves colour-dependent residuals on every star.
* Epoch B is reprojected onto epoch A’s WCS using full `astropy.wcs` transforms and bilinear
  interpolation (`scipy.ndimage.map_coordinates`); no small-angle shortcuts.
* The difference is scaled by the quadrature sum of both noise estimates and rendered on a
  diverging ramp (red = brighter in B, blue = brighter in A).
* Central wavelengths are read from WCS-WAVE; if |λ_A − λ_B| > 0.25 µm the API returns a warning and
  the UI lists only the “clean” same-band pairs. This is the single most important subtlety for a
  SPHEREx blink tool and most naive viewers ignore it.

## 4. Moving-object detection (explainable by construction)
| Step | Choice | Why |
|---|---|---|
| Detection | `photutils.DAOStarFinder`, FWHM 1.6 px, threshold 5σ, border excluded | Standard, transparent; SPHEREx PSF is ~1–2 px at 6.15″/px |
| Flag check | any non-zero FLAGS in the 3×3 around a detection → `flagged` | hot pixels, saturation, cosmic rays are flagged upstream |
| Static rejection | a detection with a counterpart in any other epoch within 9″ (1.5 px) is static | stars, galaxies |
| Linking | pairs of transients with separation ≥ 9″ and rate ≤ 400″/day; extend to further epochs by linear prediction within 27″ | 400″/day covers main-belt rates (~tens of ″/h) while rejecting detector-to-detector artefact coincidences |
| Score | 0.3·(epochs−1) + min(SNR,20)/40, ×0.6 if any flagged pixel | simple, monotonic, printed next to the reasons |
| Identification | JPL SBIdent, 30″ tolerance, all epochs must agree on one name → `known` | geocentric observer; SPHEREx’s 650 km LEO parallax is < 1″ beyond 1 AU |

Output per candidate: per-epoch cutout thumbnails, positions, SNR, flags, motion vector, JPL
match, and a `reasons` list. **Unmatched ≠ discovered.** The disclaimer is returned by the API and
rendered in the UI, and the CSV report carries the same status column.

### Distance hint
For a track spanning Δt days with total motion θ, if the motion were pure reflex parallax the
distance would be d ≈ 206265″·b/θ with baseline b = |2 sin(πΔt/365.25)| AU. Real bodies also move on
their orbits, so this is reported as an order-of-magnitude indicator with the caveat attached.

## 5. Spectral fingerprint
* Forced circular-aperture photometry (r = 2.5 px, sky annulus 4.5–7.5 px) at the source position
  (or along the linked track) in every epoch.
* Flux density F_ν [Jy] = (aperture sum − sky) [MJy/sr·px] × 10⁶ × Ω_px, with Ω_px = (6.15″)² in sr.
  AB = −2.5 log₁₀(F_ν / 3631 Jy).
* Wavelength per point from WCS-WAVE at the aperture centre (`wavelength_source = "wcs-wave"`);
  otherwise the detector band centre (`"band-range-only"`), and the UI says which.
* Template comparison: weighted least-squares scale factor and reduced χ² against five analytic
  shapes (solar reflectance, H₂O-ice-absorbed, red organic slope, 3300 K and 1200 K blackbodies).
  Explicitly labelled *indicative*; real classification would use a spectral library and the ePSF.

## 6. Planet Nine detectability
* Reflected-light magnitude from the standard small-body relation
  H = 5 log₁₀(1329 km / (D √p_V)), V = H + 5 log₁₀(r Δ), with R ≈ M^0.5 R⊕ when radius is not given.
* Compared with an approximate per-channel 5σ depth (`COSMOS_SURVEY_DEPTH_AB`, default 19.0 AB,
  flagged “approximate” in the UI). Default parameters (7 M⊕, p = 0.4, 600 AU) give V ≈ 21.8,
  ~3 mag below single-exposure depth — consistent with the literature expectation that Rubin/LSST,
  not SPHEREx, is the discovery instrument.
* Parallax amplitude 206265″/d and orbital motion 360°/P are reported to show that *motion* would be
  trivially detectable (tens of pixels/yr) — the limit is brightness, not cadence.
* Injection–recovery: Gaussian-PSF sources at a grid of AB magnitudes are injected into the actual
  cutout and recovered with the same detector; the 50 % completeness depth is interpolated. This is
  the honest, field-specific answer to “what could we have seen here?”.

## 7. Uncertainties and validation
* Astrometry: WCS from the product; no refit. Expected ~1″ level, far below the 6.15″ pixel.
* Photometry: no aperture correction (the ePSF HDU would allow it); fluxes are relative-quality.
* Validation plan (docs/TESTING.md): recover a numbered asteroid or a bright TNO (e.g. Makemake)
  as a `known` track; confirm zero candidates in a static high-latitude field; confirm the
  injection curve’s 50 % depth is within ~0.5 mag of the quoted survey depth for a clean field.
