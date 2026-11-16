import Link from "next/link";
import Tex from "@/components/Tex";

const T = String.raw;

function Block({ n, title, where, children }: { n: number; title: string; where?: [string, string]; children: React.ReactNode }) {
  return (
    <section id={`m${n}`} className="math-block">
      <h3><span className="math-n">{n}</span>{title}</h3>
      {children}
      {where && <p className="note mt-1">Used on: <Link className="link" href={where[0]}>{where[1]}</Link></p>}
    </section>
  );
}
const Why = ({ label = "Derivation", children }: { label?: string; children: React.ReactNode }) => (
  <details className="derive"><summary>{label}</summary><div className="derive-body">{children}</div></details>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="small mt-1">{children}</p>;

/** Every formula the site computes, in the order the data flows, with a derivation where the result is not obvious. */
export default function Maths() {
  return (
    <aside className="reading flex flex-col gap-6" aria-label="Mathematical formulation">
      <div>
        <h2 className="text-2xl">The mathematics</h2>
        <p className="small mt-1">Each formula below is the one the code evaluates, with the same constants. Open a derivation to see where it comes from. Numbers in the worked examples can be checked against the pages they name.</p>
      </div>

      <Block n={1} title="From a pixel to a place on the sky" where={["/", "Viewer, cursor readout"]}>
        <P>The image header gives a reference pixel <Tex>{T`\mathbf p_0`}</Tex>, its sky position <Tex>{T`(\alpha_0,\delta_0)`}</Tex> and a 2×2 matrix <Tex>{T`\mathsf{CD}`}</Tex> in degrees per pixel. A pixel <Tex>{T`\mathbf p`}</Tex> is first placed on the plane tangent to the sky, then projected onto the sphere:</P>
        <Tex block>{T`\begin{pmatrix}\xi\\ \eta\end{pmatrix}=\frac{\pi}{180}\,\mathsf{CD}\,(\mathbf p-\mathbf p_0)`}</Tex>
        <Tex block>{T`\begin{aligned}\alpha&=\alpha_0+\operatorname{atan2}\!\big(\xi,\ \cos\delta_0-\eta\sin\delta_0\big)\\[4pt] \delta&=\arctan\frac{(\sin\delta_0+\eta\cos\delta_0)\cos(\alpha-\alpha_0)}{\cos\delta_0-\eta\sin\delta_0}\end{aligned}`}</Tex>
        <Why>
          <P>In the basis (east, north, towards the reference point) the direction of the pixel is <Tex>{T`(\xi,\eta,1)`}</Tex> up to length. East, north and centre written in equatorial coordinates are <Tex>{T`\hat e=(-\sin\alpha_0,\cos\alpha_0,0)`}</Tex>, <Tex>{T`\hat n=(-\sin\delta_0\cos\alpha_0,-\sin\delta_0\sin\alpha_0,\cos\delta_0)`}</Tex> and <Tex>{T`\hat c=(\cos\delta_0\cos\alpha_0,\cos\delta_0\sin\alpha_0,\sin\delta_0)`}</Tex>. Rotating by <Tex>{T`-\alpha_0`}</Tex> about the pole, the vector <Tex>{T`\xi\hat e+\eta\hat n+\hat c`}</Tex> has components</P>
          <Tex block>{T`x=\cos\delta_0-\eta\sin\delta_0,\quad y=\xi,\quad z=\sin\delta_0+\eta\cos\delta_0`}</Tex>
          <P>so <Tex>{T`\alpha-\alpha_0=\operatorname{atan2}(y,x)`}</Tex> and <Tex>{T`\tan\delta=z/\sqrt{x^2+y^2}=z\cos(\alpha-\alpha_0)/x`}</Tex>, which are the two lines above. No small-angle approximation is made.</P>
        </Why>
      </Block>

      <Block n={2} title="Making faint and bright visible together" where={["/", "Viewer, Display sliders"]}>
        <P>With black point <Tex>{T`b`}</Tex>, white point <Tex>{T`w`}</Tex> and contrast <Tex>{T`a`}</Tex>, a pixel value <Tex>{T`q`}</Tex> is drawn with grey level</P>
        <Tex block>{T`t=\operatorname{clip}\!\Big(\frac{q-b}{w-b},0,1\Big),\qquad g=\frac{\operatorname{asinh}(t/a)}{\operatorname{asinh}(1/a)}`}</Tex>
        <Why label="Why asinh">
          <P>For <Tex>{T`t\ll a`}</Tex>, <Tex>{T`\operatorname{asinh}(t/a)\approx t/a`}</Tex>: faint signal is shown linearly, so noise looks like noise. For <Tex>{T`t\gg a`}</Tex>, <Tex>{T`\operatorname{asinh}(t/a)\approx\ln(2t/a)`}</Tex>: bright stars are compressed logarithmically and do not saturate. One slider, <Tex>{T`a`}</Tex>, moves the hand-over point. <Tex>{T`g(0)=0`}</Tex> and <Tex>{T`g(1)=1`}</Tex> for every <Tex>{T`a`}</Tex>.</P>
        </Why>
      </Block>

      <Block n={3} title="How noisy is this image?" where={["/", "Viewer, Visit panel"]}>
        <P>From the variance map when the file has one, otherwise from the spread of the valid pixels:</P>
        <Tex block>{T`\sigma=\sqrt{\operatorname{median}(\mathrm{Var})}\qquad\text{or}\qquad \sigma=1.4826\ \operatorname{median}\big|I-\operatorname{median}I\big|`}</Tex>
        <Why label="Where 1.4826 comes from">
          <P>For Gaussian noise half of the values lie within <Tex>{T`\Phi^{-1}(3/4)\,\sigma=0.6745\,\sigma`}</Tex> of the median, so the median absolute deviation equals <Tex>{T`0.6745\,\sigma`}</Tex> and <Tex>{T`\sigma=\mathrm{MAD}/0.6745=1.4826\,\mathrm{MAD}`}</Tex>. Unlike the standard deviation, the median is not dragged upward by the stars in the image.</P>
        </Why>
      </Block>

      <Block n={4} title="Difference of two visits" where={["/", "Viewer, difference mode"]}>
        <P>Visit B is resampled onto visit A’s pixel grid through both sky projections (bilinear), then subtracted:</P>
        <Tex block>{T`D=\mathcal R_{A}[B]-A,\qquad \sigma_D=\sqrt{\sigma_A^2+\sigma_B^2},\qquad z=\operatorname{clip}\!\Big(\frac{D}{6\,\sigma_D},-1,1\Big)`}</Tex>
        <P>The picture shows <Tex>{T`z`}</Tex>: amber where B is brighter, blue where A is. A warning appears when the two visits’ wavelengths differ by more than 0.25 µm.</P>
        <Why>
          <P>The noise in two exposures is independent, so <Tex>{T`\operatorname{Var}(B-A)=\operatorname{Var}B+\operatorname{Var}A`}</Tex>. A fixed star with flux densities <Tex>{T`f(\lambda_A)`}</Tex> and <Tex>{T`f(\lambda_B)`}</Tex> leaves a residual <Tex>{T`f(\lambda_B)-f(\lambda_A)`}</Tex>, which is zero only for equal wavelengths. That is why colour and motion can be confused and why the warning exists.</P>
        </Why>
      </Block>

      <Block n={5} title="What counts as a detection" where={["/detective", "Movers"]}>
        <P>The image is first matched to the shape of a star (a Gaussian 1.6 pixels wide), then a local peak is kept when it stands at least five times the noise above the sky:</P>
        <Tex block>{T`\mathrm{SNR}=\frac{I_{\text{peak}}}{\sigma}\ \ge\ 5`}</Tex>
        <Why label="How many false peaks that allows">
          <P>For Gaussian noise the chance that one pixel exceeds <Tex>{T`5\sigma`}</Tex> is <Tex>{T`1-\Phi(5)=2.9\times10^{-7}`}</Tex>. A 10′ cutout has about <Tex>{T`98^2\approx 9600`}</Tex> pixels, so the expected number of pure-noise peaks is</P>
          <Tex block>{T`9600\times 2.9\times10^{-7}\approx 0.003\ \text{per image}`}</Tex>
          <P>Real images also contain cosmic-ray hits and hot pixels, which are not Gaussian. Those are handled by the pixel flags and by the rule in the next block, not by this threshold.</P>
        </Why>
      </Block>

      <Block n={6} title="Angle between two positions" where={["/detective", "Movers, matching and linking"]}>
        <Tex block>{T`\hat u=(\cos\delta\cos\alpha,\ \cos\delta\sin\alpha,\ \sin\delta),\qquad \theta=2\arcsin\frac{\lVert\hat u_1-\hat u_2\rVert}{2}`}</Tex>
        <Why>
          <P>Two unit vectors and the centre of the sphere form an isosceles triangle with apex angle <Tex>{T`\theta`}</Tex>; its base, the chord, has length <Tex>{T`2\sin(\theta/2)`}</Tex>. The familiar <Tex>{T`\theta=\arccos(\hat u_1\cdot\hat u_2)`}</Tex> loses all precision for the arcsecond separations used here, because <Tex>{T`\cos\theta`}</Tex> differs from 1 by only <Tex>{T`\theta^2/2\sim10^{-9}`}</Tex>. The chord form does not.</P>
        </Why>
      </Block>

      <Block n={7} title="Linking detections into a track, and why three points" where={["/detective", "Movers"]}>
        <P>A detection with no counterpart within 9″ in any other visit is a transient. Two transients at times <Tex>{T`t_1,t_2`}</Tex> may be linked when</P>
        <Tex block>{T`\theta_{12}\ge 9'',\qquad \mu=\frac{\theta_{12}}{|t_2-t_1|}\le 400''/\text{day}`}</Tex>
        <P>and a detection in a third visit at time <Tex>{T`t`}</Tex> joins the track when it lies within <Tex>{T`\rho=27''`}</Tex> of the straight-line prediction</P>
        <Tex block>{T`(\alpha,\delta)_{\text{pred}}=(\alpha,\delta)_1+\frac{t-t_1}{t_2-t_1}\big[(\alpha,\delta)_2-(\alpha,\delta)_1\big]`}</Tex>
        <P>When a field has three or more visits, a track must contain at least three detections.</P>
        <Why label="Proof that two points are not evidence">
          <P>The cutout is a square of side <Tex>{T`L=600''`}</Tex>, so no two points in it are more than <Tex>{T`L\sqrt2=849''`}</Tex> apart. If the visits are more than <Tex>{T`849/400=2.1`}</Tex> days apart, every pair of transients satisfies the rate limit. With <Tex>{T`N_1`}</Tex> and <Tex>{T`N_2`}</Tex> unrelated transients in two visits, up to <Tex>{T`N_1N_2`}</Tex> pairs can therefore be joined: a pair carries no information.</P>
          <P>A third unrelated transient lands inside the acceptance circle of a given pair with probability equal to the circle’s share of the field:</P>
          <Tex block>{T`p=\frac{\pi\rho^2}{L^2}=\frac{\pi\,(27)^2}{600^2}=0.0064`}</Tex>
          <P>so the expected number of chance three-point tracks is <Tex>{T`N_1N_2N_3\,p`}</Tex>. With three stray detections per visit that is <Tex>{T`27\times0.0064\approx0.17`}</Tex>, against 9 possible chance pairs: the third point cuts false tracks by about a factor of fifty. Each further confirming visit multiplies by another <Tex>{T`N\,p`}</Tex>.</P>
        </Why>
        <P>Each track is ranked by a score that rewards more visits and higher signal, and is cut when any pixel under a detection was flagged:</P>
        <Tex block>{T`s=\min\!\Big(1,\ 0.3\,(n-1)+\frac{\min(\overline{\mathrm{SNR}},20)}{40}\Big)\times\begin{cases}0.6&\text{if flagged}\\1&\text{otherwise}\end{cases}`}</Tex>
      </Block>

      <Block n={8} title="From surface brightness to flux and magnitude" where={["/spectrum", "Spectrum"]}>
        <P>SPHEREx images are in MJy per steradian. Summing the sky-subtracted pixels in an aperture of radius 2.5 pixels and multiplying by the solid angle of one pixel gives a flux density:</P>
        <Tex block>{T`F=10^{6}\,\Omega_{\text{pix}}\Big(\sum_{\text{ap}}I-N_{\text{ap}}\,\bar s\Big)\ \text{Jy},\qquad \Omega_{\text{pix}}=\Big(\frac{6.15}{206265}\Big)^{2}=8.89\times10^{-10}\ \text{sr}`}</Tex>
        <Tex block>{T`\sigma_F=10^{6}\,\Omega_{\text{pix}}\,\sigma\sqrt{N_{\text{ap}}},\qquad m_{\text{AB}}=-2.5\log_{10}\frac{F}{3631\ \text{Jy}}`}</Tex>
        <P>Here <Tex>{T`\bar s`}</Tex> is the mean of a ring from 4.5 to 7.5 pixels and <Tex>{T`N_{\text{ap}}=\pi\,2.5^2\approx19.6`}</Tex>. No measurement is reported if the ring leaves the image or the aperture touches empty pixels.</P>
        <Why>
          <P>Surface brightness is flux per solid angle, so flux is its integral over the source: <Tex>{T`F=\int I\,d\Omega\approx\Omega_{\text{pix}}\sum I`}</Tex>. A pixel is 6.15″ on a side and one radian is 206265″, which gives <Tex>{T`\Omega_{\text{pix}}`}</Tex>. The factor <Tex>{T`10^6`}</Tex> converts MJy to Jy. Independent pixel noise adds in quadrature, giving <Tex>{T`\sigma\sqrt{N_{\text{ap}}}`}</Tex>. The AB system is defined so that 3631 Jy is magnitude zero at every wavelength.</P>
          <P>No aperture correction is applied, so fluxes are slightly low by the same factor in every visit: shapes are right, absolute levels are not.</P>
        </Why>
      </Block>

      <Block n={9} title="Comparing a spectrum with a simple shape" where={["/spectrum", "Spectrum, template table"]}>
        <P>For measurements <Tex>{T`f_i\pm\sigma_i`}</Tex> and a template with values <Tex>{T`T_i`}</Tex> at the same wavelengths, the best scale and the goodness of fit are</P>
        <Tex block>{T`\hat a=\frac{\sum_i f_iT_i/\sigma_i^2}{\sum_i T_i^2/\sigma_i^2},\qquad \chi^2_\nu=\frac{1}{n-1}\sum_i\Big(\frac{f_i-\hat a\,T_i}{\sigma_i}\Big)^2`}</Tex>
        <Why>
          <P>Minimise <Tex>{T`\chi^2(a)=\sum_i (f_i-aT_i)^2/\sigma_i^2`}</Tex>. Setting <Tex>{T`d\chi^2/da=-2\sum_i T_i(f_i-aT_i)/\sigma_i^2=0`}</Tex> gives <Tex>{T`\hat a`}</Tex>. One parameter was fitted, leaving <Tex>{T`n-1`}</Tex> degrees of freedom. A value near 1 means the shape is consistent with the data; the page says so plainly when there are fewer than six points or when even the best shape has <Tex>{T`\chi^2_\nu>5`}</Tex>.</P>
        </Why>
      </Block>

      <Block n={10} title="How bright would Planet Nine be?" where={["/planetx", "Planet Nine, calculator"]}>
        <P>For mass <Tex>{T`M`}</Tex> in Earth masses, albedo <Tex>{T`p`}</Tex> and distance <Tex>{T`r`}</Tex> from the Sun in au, seen from Earth at opposition (<Tex>{T`\Delta=r-1`}</Tex>):</P>
        <Tex block>{T`D=2R_\oplus M^{1/2},\qquad H=5\log_{10}\frac{1329\ \text{km}}{D\sqrt p},\qquad V=H+5\log_{10}(r\,\Delta)`}</Tex>
        <P>Worked example with the page’s defaults, <Tex>{T`M=7,\ p=0.4,\ r=600`}</Tex>: <Tex>{T`D=33\,700`}</Tex> km, <Tex>{T`H=-6.03`}</Tex>, <Tex>{T`V=-6.03+27.78=21.75`}</Tex>. Against a per-image depth near AB 19 that is about 2.85 magnitudes, or a factor <Tex>{T`10^{0.4\times2.85}\approx14`}</Tex>, too faint.</P>
        <Why label="Why distance matters so much">
          <P>Sunlight reaching the planet falls as <Tex>{T`r^{-2}`}</Tex>, and the reflected light reaching Earth falls again as <Tex>{T`\Delta^{-2}`}</Tex>, so brightness goes as <Tex>{T`(r\Delta)^{-2}\approx r^{-4}`}</Tex>. In magnitudes that is the term <Tex>{T`5\log_{10}(r\Delta)`}</Tex>. Doubling the distance costs</P>
          <Tex block>{T`5\log_{10}(2\times2)=3.0\ \text{mag}\quad(\text{a factor of }16\text{ in flux})`}</Tex>
          <P>The constant 1329 km is the diameter of a body with <Tex>{T`p=1`}</Tex> that would have <Tex>{T`H=0`}</Tex>. The mass-radius relation <Tex>{T`R\propto M^{1/2}`}</Tex> is a rough stand-in; the page lets you see how little the conclusion depends on it.</P>
        </Why>
        <P>How fast it would move on the sky:</P>
        <Tex block>{T`\varpi=\frac{206265''}{r}\ \ (\text{yearly parallax}),\qquad n=\frac{1\,296\,000''}{r^{3/2}}\ \text{per year}\ \ (\text{orbital motion})`}</Tex>
        <Why>
          <P>Earth moves 1 au to either side of the Sun, which shifts an object at <Tex>{T`r`}</Tex> au by <Tex>{T`1/r`}</Tex> radians. Kepler’s third law gives a period <Tex>{T`P=r^{3/2}`}</Tex> years for a circular orbit, and a full circle is <Tex>{T`360\times3600=1\,296\,000''`}</Tex>. At 600 au: <Tex>{T`\varpi=344''`}</Tex>, about 56 SPHEREx pixels, and <Tex>{T`n=88''`}</Tex> per year. The motion would be easy to see; the light is the problem.</P>
        </Why>
      </Block>

      <Block n={11} title="Measuring what a field could have shown" where={["/planetx", "Planet Nine, completeness"]}>
        <P>A test star of AB magnitude <Tex>{T`m`}</Tex> is added to the real image as a Gaussian of width <Tex>{T`\sigma_p=\mathrm{FWHM}/2.3548`}</Tex> with peak</P>
        <Tex block>{T`A=\frac{F(m)}{10^{6}\,\Omega_{\text{pix}}\,2\pi\sigma_p^{2}},\qquad F(m)=3631\times10^{-0.4m}\ \text{Jy}`}</Tex>
        <P>and the same detector is run. With <Tex>{T`k`}</Tex> of <Tex>{T`N`}</Tex> recovered, completeness is <Tex>{T`C(m)=k/N`}</Tex>, and the 50% depth is found between the two magnitudes that bracket it:</P>
        <Tex block>{T`m_{50}=m_a+\frac{C_a-0.5}{C_a-C_b}\,(m_b-m_a)`}</Tex>
        <Why>
          <P>A two-dimensional Gaussian <Tex>{T`A\,e^{-r^2/2\sigma_p^2}`}</Tex> integrates to <Tex>{T`2\pi\sigma_p^2A`}</Tex> pixel-units of surface brightness, which by block 8 must equal <Tex>{T`F/(10^6\Omega_{\text{pix}})`}</Tex>. The factor 2.3548 is <Tex>{T`2\sqrt{2\ln2}`}</Tex>, the ratio of full width at half maximum to <Tex>{T`\sigma`}</Tex>. Measuring on the image itself includes its real noise and crowding, which a quoted survey depth does not.</P>
        </Why>
      </Block>

      <Block n={12} title="Drawing an orbit in three dimensions" where={["/planetx", "Planet Nine, 3D view"]}>
        <P>From semi-major axis <Tex>{T`a`}</Tex>, eccentricity <Tex>{T`e`}</Tex>, inclination <Tex>{T`i`}</Tex>, node <Tex>{T`\Omega`}</Tex> and argument of perihelion <Tex>{T`\omega`}</Tex>, the position at true anomaly <Tex>{T`\nu`}</Tex> is, with <Tex>{T`u=\omega+\nu`}</Tex>,</P>
        <Tex block>{T`r=\frac{a(1-e^2)}{1+e\cos\nu},\qquad \begin{pmatrix}x\\y\\z\end{pmatrix}=r\begin{pmatrix}\cos\Omega\cos u-\sin\Omega\sin u\cos i\\ \sin\Omega\cos u+\cos\Omega\sin u\cos i\\ \sin u\,\sin i\end{pmatrix}`}</Tex>
        <P>Planets are placed for today’s date from JPL’s elements by solving Kepler’s equation with Newton’s method:</P>
        <Tex block>{T`M=E-e\sin E,\qquad E\leftarrow E+\frac{M-E+e\sin E}{1-e\cos E},\qquad \tan\frac{\nu}{2}=\sqrt{\frac{1+e}{1-e}}\,\tan\frac{E}{2}`}</Tex>
        <Why>
          <P>In the orbit’s own plane the body is at <Tex>{T`r(\cos u,\sin u,0)`}</Tex> measured from the ascending node. Tilting by <Tex>{T`i`}</Tex> about the node line and then turning by <Tex>{T`\Omega`}</Tex> about the ecliptic pole gives the vector above. Newton’s method applied to <Tex>{T`g(E)=E-e\sin E-M`}</Tex> uses <Tex>{T`g'(E)=1-e\cos E`}</Tex>, which is never zero for <Tex>{T`e<1`}</Tex>, so the iteration always converges; the code stops when the step is below <Tex>{T`10^{-10}`}</Tex>.</P>
        </Why>
      </Block>

      <Block n={13} title="A rough distance from motion alone" where={["/detective", "Movers, distance hint"]}>
        <P>If an object’s shift <Tex>{T`\theta`}</Tex> over <Tex>{T`\Delta t`}</Tex> days were only the reflection of Earth’s own motion:</P>
        <Tex block>{T`d\approx\frac{206265''\ b}{\theta}\ \text{au},\qquad b=2\,\Big|\sin\frac{\pi\,\Delta t}{365.25}\Big|\ \text{au}`}</Tex>
        <Why>
          <P>Two points on a circle of radius 1 au separated by an angle <Tex>{T`2\pi\Delta t/365.25`}</Tex> are a chord <Tex>{T`b`}</Tex> apart. A baseline <Tex>{T`b`}</Tex> seen from distance <Tex>{T`d`}</Tex> subtends <Tex>{T`b/d`}</Tex> radians. Real objects also move along their own orbits, so the page labels this an order-of-magnitude guide and nothing more.</P>
        </Why>
      </Block>

      <Block n={14} title="The revenue arithmetic">
        <P>With <Tex>{T`n_v`}</Tex> venues at price <Tex>{T`p_v`}</Tex>, <Tex>{T`n_s`}</Tex> schools at <Tex>{T`p_s`}</Tex> and <Tex>{T`n_c`}</Tex> custom builds at <Tex>{T`p_c`}</Tex> per year:</P>
        <Tex block>{T`R=n_vp_v+n_sp_s+n_cp_c`}</Tex>
        <P>The middle scenario is <Tex>{T`85\times1500+500\times300+1\times25\,000=\$302\,500`}</Tex>. Its venue count is <Tex>{T`85/4267=2.0\%`}</Tex> of the world’s planetariums. Every input is an assumption until a customer pays.</P>
      </Block>
    </aside>
  );
}
