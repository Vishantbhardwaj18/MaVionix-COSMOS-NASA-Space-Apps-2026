// Orbit geometry shared by the 3D orbit view and the page background.
//
// PLANETS: "Keplerian Elements for Approximate Positions of the Major Planets", Table 1
// (valid 1800 AD to 2050 AD, mean ecliptic and equinox of J2000), NASA/JPL Solar System Dynamics,
// https://ssd.jpl.nasa.gov/planets/approx_pos.html . Values copied unchanged and checked against
// that page on 2026-11-16. Each row: a [au], e, I [deg], L [deg], long.peri [deg], long.node [deg],
// then the same six as rates per Julian century.

export type PlanetRow = { name: string; el: [number, number, number, number, number, number]; rate: [number, number, number, number, number, number]; color: string };

export const JPL_PLANETS: PlanetRow[] = [
  { name: "Earth", el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0], color: "#7fb2ff" },
  { name: "Jupiter", el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], color: "#e0b98a" },
  { name: "Saturn", el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], color: "#e6d29a" },
  { name: "Uranus", el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589], color: "#9fd6de" },
  { name: "Neptune", el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664], color: "#7d9bf0" },
];

const D2R = Math.PI / 180;
export const OBLIQUITY_DEG = 23.4392911; // mean obliquity of the ecliptic at J2000

export type Elements = { a: number; e: number; i: number; om: number; w: number }; // au, -, deg, deg (node), deg (argument of perihelion)
export type Vec3 = [number, number, number];

/** Heliocentric J2000 ecliptic position [au] at true anomaly nu [rad]. */
export function orbitPoint(el: Elements, nu: number): Vec3 {
  const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
  const u = el.w * D2R + nu, i = el.i * D2R, om = el.om * D2R;
  const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(i), si = Math.sin(i), co = Math.cos(om), so = Math.sin(om);
  return [r * (co * cu - so * su * ci), r * (so * cu + co * su * ci), r * su * si];
}

/** Points round an orbit, evenly spaced in eccentric anomaly so the far end is not under-sampled. */
export function orbitRing(el: Elements, n = 256): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) {
    const E = (k / n) * 2 * Math.PI;
    const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
    out.push(orbitPoint(el, nu));
  }
  return out;
}

/** Solve Kepler's equation M = E - e sin E (radians). */
export function eccentricAnomaly(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 12; k++) {
    const d = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

/** A planet's elements and its position on a date, using JPL's approximate-position formulae. */
export function planetAt(p: PlanetRow, date: Date): { el: Elements; pos: Vec3 } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const [a, e, I, L, wbar, node] = p.el.map((v, k) => v + p.rate[k] * T);
  const el: Elements = { a, e, i: I, om: node, w: wbar - node };
  let M = ((L - wbar) % 360 + 540) % 360 - 180;
  M *= D2R;
  const E = eccentricAnomaly(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return { el, pos: orbitPoint(el, nu) };
}

/** J2000 ecliptic Cartesian -> J2000 equatorial RA/Dec in degrees. */
export function eclipticToEquatorial(v: Vec3): { ra: number; dec: number } {
  const eps = OBLIQUITY_DEG * D2R;
  const x = v[0], y = v[1] * Math.cos(eps) - v[2] * Math.sin(eps), z = v[1] * Math.sin(eps) + v[2] * Math.cos(eps);
  const r = Math.hypot(x, y, z) || 1;
  return { ra: ((Math.atan2(y, x) / D2R) + 360) % 360, dec: Math.asin(z / r) / D2R };
}

/** The ecliptic as RA/Dec points (the path the Sun and, roughly, the planets and most asteroids follow). */
export function eclipticPath(n = 180): [number, number][] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const lam = (k / n) * 2 * Math.PI;
    const { ra, dec } = eclipticToEquatorial([Math.cos(lam), Math.sin(lam), 0]);
    return [ra, dec] as [number, number];
  });
}

// A HYPOTHESIS, NOT AN OBSERVED ORBIT.
// Brown & Batygin (2021), "The Orbit of Planet Nine", AJ 162, 219, arXiv:2108.09868.
//  - P9_REFERENCE is their single maximum-likelihood model (section 4.3): 5 Earth masses,
//    a = 300 au, e = 0.15, i = 17 deg, longitude of perihelion 254 deg, ascending node 108 deg.
//    It is one curve out of a wide range; their posterior summary is a = 380 (+140/-80) au,
//    perihelion 300 (+85/-60) au, i = 16 +/- 5 deg, mass 6.2 (+2.2/-1.3) Earth masses.
//  - P9_SKY_PLANE is the plane they use to describe the search swath (i = 16 deg, node 97 deg),
//    and P9_SKY_PEAK_RA the right ascension where their sky-probability map peaks (about 45 deg).
export const P9_REFERENCE: Elements = { a: 300, e: 0.15, i: 17, om: 108, w: 254 - 108 };
export const P9_SKY_PLANE: Elements = { a: 380, e: 0, i: 16, om: 97, w: 0 };
export const P9_SKY_PEAK_RA = 45;
export const P9_CITATION = "Brown & Batygin (2021), AJ 162, 219";

/** Point of an orbit's sky path closest to a given right ascension. */
export function skyPointAtRA(el: Elements, raDeg: number): { ra: number; dec: number } {
  let best = { ra: raDeg, dec: 0 }, bd = 1e9;
  for (const [ra, dec] of skyPath(el, 720)) {
    const d = Math.abs(((ra - raDeg + 540) % 360) - 180);
    if (d < bd) { bd = d; best = { ra, dec }; }
  }
  return best;
}

/** The sky path (RA/Dec) of a heliocentric orbit as seen from the Sun; for distant orbits Earth's offset is under a degree. */
export function skyPath(el: Elements, n = 240): [number, number][] {
  return orbitRing(el, n).map((p) => { const { ra, dec } = eclipticToEquatorial(p); return [ra, dec] as [number, number]; });
}

/** RA/Dec of an orbit's aphelion direction. */
export function aphelionSky(el: Elements) {
  return eclipticToEquatorial(orbitPoint(el, Math.PI));
}
