# Innovation and novelty — stated against existing tools

## Existing landscape (what we compared against)
| Tool | What it does | Gap |
|---|---|---|
| IRSA SPHEREx Data Explorer | Official browse/search/visualise of spectral images | Expert UI; no time-series blink, no mover logic |
| IRSA Spectrophotometry Tool / Source Discovery Tool | Forced photometry, source finding on a single image | Not multi-epoch, not public-friendly |
| Space Apps 2026 peer projects (blink comparators, several on GitHub) | Position → epochs → blink; some add SBIdent matching | Ignore the linear-variable-filter wavelength mismatch; no spectra; Planet X presented as marketing |
| Zooniverse “Backyard Worlds” | Human flipbook classification of WISE movers | WISE only, no SPHEREx, no spectra |
| Brown & Batygin survey analyses | Research-grade Planet Nine exclusion | Not interactive; optical data |

## What COSMOS adds
1. **Wavelength-aware differencing.** We read WCS-WAVE, label every epoch’s wavelength, warn on
   mismatched pairs and list the clean same-band pairs. On SPHEREx this is the difference between a
   difference image that shows movers and one that shows every star twice.
2. **Spectral fingerprint from time-domain data.** Treating the LVF “problem” as a feature: a source
   visited N times is sampled at N wavelengths. Forced photometry along a mover’s track yields a
   partial 0.75–5 µm spectrum from imaging alone — a capability unique to SPHEREx among all-sky
   surveys and absent from other blink tools.
3. **Explainable, falsifiable detection.** Every candidate ships with its evidence (thumbnails, SNR,
   flags, motion, JPL match, reasons); the CSV report reproduces the UI. No black box, no
   “AI found Planet X”.
4. **Honest detectability, measured not quoted.** Injection–recovery on the *actual* cutout gives a
   field-specific completeness curve; the calculator shows exactly why Planet Nine (V ≈ 22–25) is below
   SPHEREx’s single-exposure reach even though its parallax would be tens of pixels. Teaching the public
   what a null result means is a scientific contribution in itself.
5. **Public-first UX with research-grade provenance.** Coordinates, obs IDs, MJDs, collections, DOIs
   and acknowledgements are one click away on every screen; shareable URLs encode the field.

## Scientific relevance
* Supports SPHEREx’s own solar-system and Galactic science (asteroid/TNO colours, ice features at
  3 µm, brown-dwarf colours) with a tool anyone can run.
* Provides a citizen-science-ready triage layer: known/unmatched labels plus evidence cards are
  exactly what human classifiers need.
* Frames Planet X correctly: a hypothesis with quantified exclusion regions, for which SPHEREx
  contributes context (3–5 µm constraints on bright infrared candidates), not discovery.

## Limitations we state up front
Coarse pixels, 6-month cadence away from the poles, relative photometry without aperture
correction, linear linking, approximate depth constant, and no ML classifier yet.

## Next steps (post-hackathon)
* Real/bogus classifier trained on injected sources (labels for free) with reported FPR.
* Use the ePSF HDU for PSF photometry and aperture corrections.
* Orbit ranging on 3+ epoch tracks (statistical ranging) and automatic MPC-format output for
  genuinely unmatched, high-score candidates.
* Zooniverse export of evidence cards.
