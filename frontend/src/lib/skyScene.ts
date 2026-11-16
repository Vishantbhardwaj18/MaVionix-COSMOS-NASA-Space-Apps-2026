// Which part of the real sky sits behind each page.
// Every scene is the same star catalogue (Hipparcos and Tycho, true positions and colours) and the
// same Milky Way map, looked at in a different direction that has something to do with the page.
import { useSyncExternalStore } from "react";
import { P9_SKY_PEAK_RA, P9_SKY_PLANE, eclipticPath, skyPath, skyPointAtRA } from "./orbits";

export type SkyLine = { pts: [number, number][]; rgb: string; dash: number[]; alpha: number };
export type SkyScene = {
  key: string;
  name: string;                 // finishes the sentence "Behind this page: ..."
  ra: number; dec: number;      // where the camera looks (J2000 degrees)
  at: { x: number; y: number }; // where that point sits on the screen, as fractions
  roll: number;                 // camera roll in degrees
  drift: boolean;               // let the sky turn slowly about the celestial pole
  lines: SkyLine[];
};

const ECLIPTIC: SkyLine = { pts: eclipticPath(240), rgb: "242,181,68", dash: [2, 7], alpha: 0.5 };
const p9peak = skyPointAtRA(P9_SKY_PLANE, P9_SKY_PEAK_RA);

const SCENES: Record<string, SkyScene> = {
  home: { key: "home", name: "the Large Magellanic Cloud, the first thing SPHEREx imaged for science", ra: 80.894, dec: -69.756, at: { x: 0.58, y: 0.58 }, roll: -12, drift: true, lines: [] },
  movers: { key: "movers", name: "the zodiac through Taurus and Gemini; the dotted line is the ecliptic, the track most asteroids keep close to", ra: 82, dec: 20, at: { x: 0.5, y: 0.42 }, roll: 8, drift: false, lines: [ECLIPTIC] },
  spectrum: { key: "spectrum", name: "the centre of the Milky Way in Sagittarius, where dust reddens the starlight", ra: 266.4, dec: -29.0, at: { x: 0.55, y: 0.5 }, roll: 32, drift: false, lines: [] },
  planetx: {
    key: "planetx",
    name: `the sky near RA ${P9_SKY_PEAK_RA}° in Cetus and Taurus, where Brown & Batygin (2021) put the likeliest position of the hypothetical planet; the dashed line is their reference orbit plane and the dotted line the ecliptic`,
    ra: p9peak.ra, dec: p9peak.dec, at: { x: 0.5, y: 0.45 }, roll: 0, drift: false,
    lines: [{ pts: skyPath(P9_SKY_PLANE, 360), rgb: "106,169,255", dash: [9, 7], alpha: 0.6 }, ECLIPTIC],
  },
  about: { key: "about", name: "the southern Milky Way through Carina and the Southern Cross", ra: 172, dec: -60, at: { x: 0.5, y: 0.5 }, roll: -20, drift: false, lines: [] },
};

/** The viewer tells the background where it is looking once a field has been resolved. */
let focus: { ra: number; dec: number } | null = null;
const subs = new Set<() => void>();
export function setSkyFocus(f: { ra: number; dec: number } | null) {
  if (f?.ra === focus?.ra && f?.dec === focus?.dec) return;
  focus = f;
  subs.forEach((s) => s());
}
export function useSkyFocus() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => focus, () => null);
}

export function sceneFor(path: string, field: { ra: number; dec: number } | null): SkyScene {
  if (path.startsWith("/detective")) return SCENES.movers;
  if (path.startsWith("/spectrum")) return SCENES.spectrum;
  if (path.startsWith("/planetx")) return SCENES.planetx;
  if (path.startsWith("/about")) return SCENES.about;
  if (path === "/" && field) {
    return {
      key: `field:${field.ra.toFixed(2)},${field.dec.toFixed(2)}`,
      name: `the real sky around the field you are viewing (RA ${field.ra.toFixed(1)}°, Dec ${field.dec >= 0 ? "+" : ""}${field.dec.toFixed(1)}°), about 60° across`,
      ra: field.ra, dec: field.dec, at: { x: 0.5, y: 0.5 }, roll: 0, drift: false, lines: [],
    };
  }
  return SCENES.home;
}
