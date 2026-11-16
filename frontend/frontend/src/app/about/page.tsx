export default function About() {
  return (
    <article className="reading max-w-[78ch] flex flex-col gap-6 my-2">
      <div>
        <h1>How this works</h1>
        <p className="lede mt-2">Built for the 2026 NASA Space Apps challenge “Planet X and SPHEREx”: show SPHEREx images of any spot on the sky and make it easy to see how they change between visits. Everything on the site traces back to a public NASA or JPL product and a stated calculation.</p>
      </div>

      <section>
        <h2>The data</h2>
        <p className="small mt-1">SPHEREx records the whole sky from 0.75 to 5 microns on six detectors with 6.15″ pixels, returning to each point about every six months and far more often near the ecliptic poles. We use the Level-2 spectral images from Quick Release 3 and Data Release 1, served by the NASA/IPAC Infrared Science Archive. Each image is a multi-extension FITS file: the calibrated image in MJy/sr, a flag map, a variance map, a model of the zodiacal light, the point-spread function, and a table giving the wavelength each pixel recorded. Rather than download the 70 MB files, the site asks the archive for a 10′ cutout of each.</p>
        <p className="small mt-2">Positions of known asteroids, comets and trans-Neptunian objects come from JPL’s SBIdent service; orbital elements for the Planet Nine page come from the JPL Small-Body Database. Names are resolved through CDS Sesame.</p>
        <p className="note mt-2">DOIs: QR3 10.26131/IRSA662 · DR1 images 10.26131/IRSA678 · DR1 all-sky cube 10.26131/IRSA679. “This product makes use of data from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), a joint project of JPL and Caltech funded by NASA.”</p>
      </section>

      <section>
        <h2>What happens when you look up a field</h2>
        <ol className="small mt-1 list-decimal pl-5 flex flex-col gap-1">
          <li>The archive’s image-access service lists every spectral image covering the position, newest release first.</li>
          <li>A cutout of each is fetched and cached. The zodiacal model is subtracted, then a robust sky level.</li>
          <li>The viewer receives the raw pixel values, the image’s sky projection and the wavelength table, so you can change the stretch and read coordinates without another round trip.</li>
          <li>For a difference, visit B is reprojected onto visit A’s pixel grid with the full sky projection and subtracted; the result is scaled by the combined noise. Because SPHEREx’s filters vary across the detector, two visits usually sample different wavelengths; the site tells you when that is the case, since stars then leave colour residuals.</li>
        </ol>
      </section>

      <section>
        <h2>Finding things that moved</h2>
        <p className="small mt-1">Each visit is searched for point sources at five times the noise with a standard star-finder, excluding the image border and recording any flagged pixels beneath a detection. A detection with a counterpart in another visit within 9″ is a fixed source. The rest are transients; two transients from different visits are linked when they are at least 9″ apart and the implied rate is below 400″ per day, and the track is extended to further visits by straight-line prediction. Each detection in a track is compared with JPL’s predicted positions for catalogued bodies at that moment; if every visit agrees on one object within 30″, the track is labelled known. Otherwise it is unmatched. A score combines track length and signal-to-noise and is reduced if any pixel was flagged.</p>
        <p className="small mt-2">Unmatched is not the same as new. Most unmatched tracks are artefacts, cosmic rays, or small disagreements between our astrometry and the ephemeris. The site says this wherever a track is shown.</p>
      </section>

      <section>
        <h2>Spectra from images</h2>
        <p className="small mt-1">A circular aperture of 2.5 pixels with a sky annulus is placed at the source — or along a moving object’s track — in each visit. Flux density is the aperture sum times the pixel solid angle; the wavelength comes from the image’s own wavelength table. The resulting points are compared against five simple analytic shapes (a Sun-like reflector, an icy surface with absorption near 3 µm, a reddened reflector, and two blackbodies). That comparison is indicative only.</p>
      </section>

      <section>
        <h2>The Planet Nine page</h2>
        <p className="small mt-1">Brightness follows the standard small-body relation between size, albedo and distance; the result is compared with an approximate per-channel depth for the all-sky survey. The completeness measurement injects Gaussian sources into the real cutout and reruns the detector. At the predicted brightness of Planet Nine (visual magnitude roughly 22 to 25) the planet would be below SPHEREx’s single-image reach, though its yearly parallax motion would span tens of pixels.</p>
      </section>

      <section>
        <h2>Limits worth knowing</h2>
        <ul className="small mt-1 list-disc pl-5 flex flex-col gap-1">
          <li>6.15″ pixels: crowded fields near the Galactic plane blend sources; anything moving less than a pixel between visits is invisible.</li>
          <li>Most of the sky is revisited every six months. Short arcs do not give unique orbits.</li>
          <li>Photometry has no aperture correction, so fluxes are relative.</li>
          <li>Tracks are linked with straight lines; fast or curved motion over many visits may split into several tracks.</li>
          <li>The sample used when the archive is unreachable is synthetic and is always labelled as such.</li>
        </ul>
      </section>

      <section>
        <h2>The 3D views and the sky behind the pages</h2>
        <p className="small mt-1">Three views are drawn in three dimensions because the third dimension carries information. The globe on the start page shows why SPHEREx’s deep fields sit at the ecliptic poles. The surface view in the viewer turns brightness into height, which separates a star (a rounded peak) from a cosmic-ray hit (a one-pixel spike). The orbit view on the Planet Nine page shows the tilt of each distant orbit, which a flat drawing hides; the planets in it are placed with JPL’s published approximate orbital elements, and the single proposed orbit is the maximum-likelihood model of Brown and Batygin (2021), drawn as a hypothesis.</p>
        <p className="small mt-2">The background of every page is the real sky, drawn from the Hipparcos and Tycho star catalogues with each star at its catalogued position, brightness and colour, and the Milky Way from measured outlines. Each page looks at a different region, named at the foot of the page: the viewer faces the field you are looking at, the movers page faces the zodiac, and the Planet Nine page faces the part of the sky where that paper puts the planet’s likeliest position. The shading inside the Magellanic Clouds is drawn by formula around their real positions and sizes. None of it is a photograph, and none of it is AI-generated.</p>
      </section>

      <section>
        <h2>Real data and sample data</h2>
        <p className="small mt-1">The dot beside the site name says what you will get. “Archive online” means searches return SPHEREx images. “Sample data” means this server cannot reach the archive, or has been set to sample mode, and searches return a generated test field instead. Every screen, every exported image and every CSV row made from the sample says so. The sample exists so the tool can be shown and tested offline; nothing learned from it is a statement about the sky.</p>
      </section>

      <section>
        <h2>Your privacy</h2>
        <p className="small mt-1">There are no accounts, adverts, analytics or third-party scripts. The fonts and the star catalogue behind the page are served from this site. Your browser remembers the last field you looked at, on your own device, so the start page can offer it again. The server keeps short-lived request logs and a cache of archive cutouts, neither linked to a person.</p>
      </section>

      <section>
        <h2>How it was built</h2>
        <p className="small mt-1">The MaVionix team built this for the 2026 NASA Space Apps Challenge. Code and documentation were written with help from an AI assistant (Claude, by Anthropic) and reviewed and tested by the team; the test suite and the method notes are in the repository. The page background is drawn from the Hipparcos and Tycho star catalogues and Milky Way outlines packaged by d3-celestial (BSD-3-Clause, Olaf Frohn). This site is not affiliated with or endorsed by NASA, JPL or Caltech.</p>
      </section>

      <p className="note">Source code, tests and the full methodology are in the project repository. MaVionix, November 2026.</p>
    </article>
  );
}
