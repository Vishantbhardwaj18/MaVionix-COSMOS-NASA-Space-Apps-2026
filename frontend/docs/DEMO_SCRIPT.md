# Product demonstration script (3 minutes)

**Before you start:** API and web running; showcase fields pre-warmed; browser at `/`.
Decide in advance whether you are on real data (green badge) or synthetic (amber badge) and say it.

**0:00 — Hook.** “SPHEREx photographs the entire sky every six months in 102 infrared colours.
Anything that moves between those photographs is a Solar System object. Nobody can look at a
billion sources by hand — so we built a time machine for the sky.”

**0:20 — Viewer.** Click *North Ecliptic Pole*. “Every SPHEREx image of this spot, pulled
live from NASA’s archive as cutouts. Here is the date, the detector, and — unique to SPHEREx — the
exact wavelength this pixel saw.” Switch to *blink*. “Stars stay; noise changes.” Switch to *diff*.
Point at the warning: “Two epochs usually see different colours, so we only difference clean pairs;
most blink tools get this wrong.”

**1:00 — Movers page.** Click the *Things that moved between visits* overlay (or switch to the asteroid-rich
field). “Five-sigma detection in every epoch, link what disappears and reappears, check JPL’s
ephemerides.” Open the top candidate. “Four postage stamps, the motion vector, signal-to-noise,
pixel flags — and the verdict: *known*, it is asteroid X. If it were *unmatched* we would say exactly
that; unmatched is not discovered.”

**1:45 — Spectrum page.** Click *Build its spectrum*. “Because the wavelength drifts
across the detector, every revisit sampled a different colour. Stack them and you get a spectrum
from imaging alone. Here it sits closest to a solar-reflectance template — indicative, not a
classification.”

**2:15 — Planet X.** “So where is Planet Nine? These are real orbits of the most distant known
objects from JPL; their closest-approach points bunch up on one side — that is the whole argument.
Slide the mass and distance: a seven-Earth-mass planet at 600 AU is magnitude ~22. SPHEREx reaches
~19. Its motion would be sixty pixels a year — obvious — but it is three magnitudes too faint. That
is why Rubin will find it, if it exists, and why we never claim SPHEREx has.” Click *Measure completeness on the current field* to show the measured completeness curve.

**2:50 — Close.** “Real data, honest labels, evidence you can download. MaVionix COSMOS — explore the
universe, decode cosmic mysteries.”

**Fallbacks.** If IRSA is slow, use a pre-warmed field. If offline, start with `./run.sh demo` and say so
out loud — the amber badge is on screen anyway.
