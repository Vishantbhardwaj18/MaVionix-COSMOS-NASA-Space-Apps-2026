import Link from "next/link";
import "katex/dist/katex.min.css";
import Maths from "./Maths";

const SRC = {
  planetaria: "https://core.ac.uk/download/352902336.pdf",
  stem: "https://www.thebusinessresearchcompany.com/report/stem-education-in-k-12-global-market-report",
  zooniverse: "https://blog.zooniverse.org/2026/04/21/3-million-volunteers/",
  nasaZooniverse: "https://science.nasa.gov/get-involved/citizen-science/nasa-volunteers-help-zooniverse-reach-1-billion-classifications/",
};

const SCENARIOS = [
  { name: "Cautious", venues: 20, venuePrice: 1500, schools: 100, schoolPrice: 300, builds: 0 },
  { name: "Middle", venues: 85, venuePrice: 1500, schools: 500, schoolPrice: 300, builds: 1 },
  { name: "Stretch", venues: 213, venuePrice: 2000, schools: 2000, schoolPrice: 300, builds: 3 },
];
const BUILD_PRICE = 25000;
const PLANETARIUMS = 4267;
const usd = (n: number) => "$" + n.toLocaleString("en-US");

export default function About() {
  return (
    <div className="about-grid my-2">
    <article className="reading flex flex-col gap-6">
      <div>
        <h1>How this works</h1>
        <p className="lede mt-2">Built for the 2026 NASA Space Apps challenge “Planet X and SPHEREx”: show SPHEREx images of any spot on the sky and make it easy to see how they change between visits. Everything on the site traces back to a public NASA or JPL product and a stated calculation.</p>
      </div>

      <section>
        <h2>The problem</h2>
        <p className="small mt-1">NASA’s SPHEREx photographs the whole sky again and again, and every image is public. Almost nobody outside a research group can look at it.</p>
        <ul className="small mt-2 list-disc pl-5 flex flex-col gap-1">
          <li>Each image is a multi-extension FITS file of about 70 MB, found through an archive query language. A student or teacher cannot open one, let alone compare two.</li>
          <li>SPHEREx’s defining feature is repetition: the same sky every six months, and far more often near the ecliptic poles. The archive serves single images; nothing public shows one place over time.</li>
          <li>Every pixel records a different wavelength, so a plain before-and-after comparison misleads. General-purpose image viewers do not know this.</li>
          <li>The question the public asks most, Planet Nine, is usually told as hype. Few tools show what the data can and cannot say.</li>
        </ul>
      </section>

      <section>
        <h2>The solution</h2>
        <p className="small mt-1">COSMOS is the front door to that data: type a position, see every visit, and see what changed. It runs in a browser with no install and no account.</p>
        <ul className="small mt-2 list-disc pl-5 flex flex-col gap-1">
          <li><Link className="link" href="/">Viewer</Link>: every visit of any position, with blink, swipe, difference, timelapse and a 3D surface.</li>
          <li><Link className="link" href="/detective">Movers</Link>: things that changed position are found automatically, checked against JPL’s catalogue, and shown with their evidence.</li>
          <li><Link className="link" href="/spectrum">Spectrum</Link>: repeat visits become a spectrum of one source, because each visit saw a different colour.</li>
          <li><Link className="link" href="/planetx">Planet Nine</Link>: the real orbits in 3D, and a calculator showing why the planet would be too faint for SPHEREx.</li>
          <li>Sample data is labelled everywhere, and an unmatched object is never called a discovery.</li>
        </ul>
      </section>

      <section>
        <h2>Who it helps</h2>
        <div className="scroll-x mt-2"><table className="data">
          <thead><tr><th>Who</th><th>What they get</th></tr></thead>
          <tbody>
            <tr><td>Students and teachers</td><td>A real NASA dataset for a lesson on motion, colour and evidence, on a school laptop or a phone.</td></tr>
            <tr><td>Planetariums and science centres</td><td>A live exhibit: visitors choose a patch of sky and watch it change.</td></tr>
            <tr><td>Citizen scientists</td><td>A way to inspect candidates themselves, with the JPL check and a CSV to share.</td></tr>
            <tr><td>Researchers</td><td>A quick look at a field before downloading anything, and a link that reopens the exact view.</td></tr>
            <tr><td>Science communicators</td><td>Saved images that carry their own source and date.</td></tr>
          </tbody>
        </table></div>
      </section>

      <section>
        <h2>Where the novelty lies</h2>
        <ol className="small mt-1 list-decimal pl-5 flex flex-col gap-1">
          <li><b>Wavelength-aware comparison.</b> The viewer reads the wavelength recorded at every pixel and warns when two visits cannot be fairly subtracted. Blink tools built for ordinary cameras do not.</li>
          <li><b>A spectrum from pictures.</b> SPHEREx’s shifting filters are usually a nuisance for comparing dates. Here they are the method: revisits are stacked into a spectrum, even along a moving object’s track.</li>
          <li><b>Evidence, not verdicts.</b> Each moving object comes with image stamps, signal-to-noise, pixel flags and the JPL identification, and the label “unmatched” in place of “new”.</li>
          <li><b>Measured limits.</b> Fake stars are injected into the real image to measure what that field could have shown, in place of a quoted survey depth.</li>
          <li><b>The view is the link.</b> Field, visits, mode and overlays live in the address, so anyone can reopen and check a finding.</li>
        </ol>
      </section>

      <section>
        <h2>The business model</h2>
        <p className="small mt-1">Free for people, paid for by institutions. The public viewer stays free and open source, because the data is public and reach is the point. Income comes from three services built on the same code:</p>
        <div className="scroll-x mt-2"><table className="data">
          <thead><tr><th>Offer</th><th>Who pays</th><th>What they get</th><th>How it is priced</th></tr></thead>
          <tbody>
            <tr><td>Exhibit licence</td><td>Planetariums, science centres, museums</td><td>A kiosk mode with their branding, chosen fields cached to work offline, updates and support</td><td>Yearly, per venue</td></tr>
            <tr><td>Classroom pack</td><td>Schools and outreach programmes</td><td>Lesson plans built on the viewer, teacher accounts, saved class fields, worksheets</td><td>Yearly, per school</td></tr>
            <tr><td>Custom build</td><td>Observatories, survey teams, agencies</td><td>The engine adapted to another repeat-imaging dataset, hosted for them or delivered</td><td>Per project</td></tr>
          </tbody>
        </table></div>
        <p className="small mt-2">Costs are small and mostly fixed: hosting for the site and the cutout cache, support time, and the work of each custom build. The data itself costs nothing. Grants and sponsorship for public science tools are a fourth route and are not counted in the figures below.</p>
      </section>

      <section>
        <h2>The market</h2>
        <p className="small mt-1">The viewer should stay free: the data is public and the audience is education. The buyers are institutions that want it installed, branded, supported or adapted.</p>
        <div className="scroll-x mt-2"><table className="data">
          <thead><tr><th>Group</th><th>Size</th><th>What it means here</th></tr></thead>
          <tbody>
            <tr><td>Planetariums</td><td className="num">At least 4,267 working planetariums and about 143 million visits a year (2020 count)</td><td>The clearest buyers of an exhibit licence. <a className="link" href={SRC.planetaria} target="_blank" rel="noreferrer">Source</a></td></tr>
            <tr><td>School STEM spending</td><td className="num">$49.9 billion in 2025, forecast $56.8 billion in 2026</td><td>The whole worldwide category, from one market-research firm. Context, not a target: one astronomy tool can reach only a sliver of it. <a className="link" href={SRC.stem} target="_blank" rel="noreferrer">Source</a></td></tr>
            <tr><td>Citizen scientists</td><td className="num">3 million Zooniverse volunteers; 324 thousand on NASA projects since 2020</td><td>Users and advocates rather than payers. They show the appetite exists. <a className="link" href={SRC.zooniverse} target="_blank" rel="noreferrer">Source</a>, <a className="link" href={SRC.nasaZooniverse} target="_blank" rel="noreferrer">source</a></td></tr>
          </tbody>
        </table></div>
        <p className="note mt-2">The same engine could serve other surveys that image the sky repeatedly, such as the Rubin Observatory. That is a direction, not something built.</p>
      </section>

      <section>
        <h2>What it could earn</h2>
        <p className="small mt-1">COSMOS has no customers and no tested prices yet, so its sales cannot be stated. What can be shown is the arithmetic under stated assumptions: venues pay an exhibit licence, schools pay for a classroom pack, and a few institutions pay for a custom build at {usd(BUILD_PRICE)} each.</p>
        <div className="scroll-x mt-2"><table className="data">
          <thead><tr><th>Scenario</th><th>Venues</th><th>Schools</th><th>Custom builds</th><th>Yearly revenue</th></tr></thead>
          <tbody>
            {SCENARIOS.map((s) => (
              <tr key={s.name} className="num">
                <td>{s.name}</td>
                <td>{s.venues} at {usd(s.venuePrice)} ({((s.venues / PLANETARIUMS) * 100).toFixed(1)}% of planetariums)</td>
                <td>{s.schools.toLocaleString("en-US")} at {usd(s.schoolPrice)}</td>
                <td>{s.builds}</td>
                <td>{usd(s.venues * s.venuePrice + s.schools * s.schoolPrice + s.builds * BUILD_PRICE)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="note mt-2">Revenue only: hosting, support and sales costs are not subtracted, and grants or sponsorship are left out. The prices are placeholders for illustration, not quotes from any buyer. The first paying customer replaces these guesses with a real number.</p>
      </section>

      <section>
        <h2>What is not proven yet</h2>
        <ul className="small mt-1 list-disc pl-5 flex flex-col gap-1">
          <li>The live connection to the SPHEREx archive has been tested against a stand-in, not yet against the real service. The dot beside the site name shows the current state.</li>
          <li>No institution has been asked to pay, so demand and price are untested.</li>
          <li>The archive’s release names and interfaces can change, and the tool depends on them.</li>
        </ul>
      </section>

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
        <p className="small mt-1">Each visit is searched for point sources at five times the noise with a standard star-finder, excluding the image border and recording any flagged pixels beneath a detection. A detection with a counterpart in another visit within 9″ is a fixed source. The rest are transients; two transients from different visits are linked when they are at least 9″ apart and the implied rate is below 400″ per day, and the track is extended to further visits by straight-line prediction. When a field has three or more visits, a track must have at least three detections on one line, because any two unrelated noise peaks can be joined by some line. Each detection in a track is compared with JPL’s predicted positions for catalogued bodies at that moment; if every visit agrees on one object within 30″, the track is labelled known. Otherwise it is unmatched. A score combines track length and signal-to-noise and is reduced if any pixel was flagged.</p>
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
        <p className="small mt-1">Team MaVionix built this for the 2026 NASA Space Apps Challenge, San Diego. The team used an AI assistant to debug the code and all things is being reviewed and tested by team mavionix; the test suite and the method notes are in the repository. The page background is drawn from the Hipparcos and Tycho star catalogues and Milky Way outlines packaged by d3-celestial (BSD-3-Clause, Olaf Frohn). This site is not affiliated with or endorsed by NASA, JPL or Caltech.</p>
      </section>

      <div className="flex items-center gap-3">
        <img src="/space-apps-san-diego.png" alt="NASA Space Apps San Diego" width={72} height={72} className="event-badge" loading="lazy" />
        <p className="note">Source code, tests and the full methodology are in the project repository.<br />Team MaVionix, NASA Space Apps Challenge 2026, San Diego. The event logo belongs to NASA Space Apps and is shown to identify the event.</p>
      </div>
    </article>
    <Maths />
    </div>
  );
}
