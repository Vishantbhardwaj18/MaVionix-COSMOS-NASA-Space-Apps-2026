# NASA Space Apps presentation structure (7 slides, ~4 minutes)

1. **The challenge, in NASA’s words.** “A public-facing web tool to display SPHEREx images and make it
   easy to see how they change over time.” SPHEREx: all sky, every 6 months, 102 bands, a billion
   objects — too much for one person.
2. **Our answer: the SPHEREx Viewer.** One screenshot: a field blinking, a mover circled,
   its spectrum beside it. Tagline: *Explore the Universe. Decode Cosmic Mysteries.*
3. **Live demo (2 min).** Showcase field → step/blink/diff → Movers page → candidate labelled
   *known: (asteroid name)* → Spectral fingerprint → Planet X calculator.
4. **What makes it different.** Wavelength-aware differencing; spectra from time-domain imaging;
   explainable evidence cards with JPL identification; measured completeness. Comparison table vs
   existing tools (INNOVATION.md).
5. **Scientific honesty.** Real data badge vs synthetic badge; unmatched ≠ discovered; why SPHEREx
   can’t see Planet Nine at predicted brightness (V ≈ 22–25 vs depth ≈ 19) but would see its motion
   (≈ 56 px/yr parallax at 600 AU). Rubin/LSST is the discovery machine; SPHEREx characterises.
6. **How it is built.** FastAPI + Astropy + photutils · Next.js + Tailwind · IRSA SIA/cutouts · JPL
   SBIdent/SBDB · Docker · 13 offline tests · open source.
7. **Impact and next steps.** Citizen-science triage layer; MPC-format export; real/bogus ML with
   stated false-positive rate; Zooniverse integration. Team MaVionix, San Diego.

**Judging criteria mapping**
* Impact — public tool over a flagship NASA dataset; teaches what a null result means.
* Creativity — turning the LVF wavelength drift into a spectroscopy feature.
* Validity — documented products, DOIs, acknowledgements, stated uncertainties, tests.
* Relevance — answers the brief literally (images over time) and extends it in the brief’s own
  direction (things that move).
* Presentation — one coherent product, not six modules.
