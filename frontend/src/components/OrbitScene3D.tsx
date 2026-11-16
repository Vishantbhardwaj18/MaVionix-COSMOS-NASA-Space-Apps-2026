"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { TNO } from "@/lib/api";
import { JPL_PLANETS, P9_REFERENCE, orbitPoint, orbitRing, planetAt, type Elements, type Vec3 } from "@/lib/orbits";
import { createStage, disposeTree, dotTexture, polyline, type Stage } from "@/lib/three-stage";

const S = 1 / 100;                                       // scene units per au
const toScene = (p: Vec3) => new THREE.Vector3(p[0] * S, p[2] * S, -p[1] * S);   // ecliptic north is up
const isExtreme = (t: TNO) => t.a > 250 && t.q > 30;

type Props = {
  tnos: TNO[];
  selected: string | null;
  showP9: boolean;
  date: Date;
  onUnavailable: () => void;      // WebGL missing: the page falls back to the flat drawing
};

function fatLine(points: THREE.Vector3[], color: number, width: number, dashed = false, opacity = 1): Line2 {
  const geo = new LineGeometry();
  geo.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const mat = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, dashed, dashSize: 0.18, gapSize: 0.12 });
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  return line;
}

/** The outer Solar System in three dimensions: drag to turn, scroll or pinch to zoom. */
export default function OrbitScene3D({ tnos, selected, showP9, date, onUnavailable }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const groups = useRef<{ tno: THREE.Group; p9: THREE.Group; sel: THREE.Group } | null>(null);
  const spin = useRef(true);
  const [ready, setReady] = useState(false);

  // one-time scene
  useEffect(() => {
    if (!box.current) return;
    const st = createStage(box.current, { fov: 38, far: 2000, pageScroll: true });
    if (!st) { onUnavailable(); return; }
    stage.current = st;
    const { scene, camera, controls } = st;
    camera.position.set(12, 11, 21);
    controls.minDistance = 0.35; controls.maxDistance = 60;
    controls.enablePan = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spin.current = !reduce;
    controls.addEventListener("start", () => { spin.current = false; });

    // distance rings in the plane of the planets
    for (const r of [250, 500, 750, 1000]) {
      const pts = Array.from({ length: 181 }, (_, k) => { const a = (k / 180) * 2 * Math.PI; return new THREE.Vector3(Math.cos(a) * r * S, 0, Math.sin(a) * r * S); });
      scene.add(polyline(pts, 0x2a3a58, 0.9));
      const lab = st.label(`${r} au`, "#8b97b2", 12);
      lab.position.set(r * S * 0.707, 0, r * S * 0.707);
      scene.add(lab);
    }
    // a faint disc so the tilt of each orbit against the planets' plane can be read
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1000 * S, 96), new THREE.MeshBasicMaterial({ color: 0x1d2b45, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    // direction of the March equinox, the zero of ecliptic longitude
    scene.add(polyline([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1000 * S, 0, 0)], 0x2a3a58, 0.9));
    const eq = st.label("longitude 0°", "#8b97b2", 12); eq.position.set(1010 * S, 0, 0); scene.add(eq);

    // Sun
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xfff1c9, sizeAttenuation: false, depthWrite: false }));
    sun.scale.set(0.014, 0.014, 1);
    scene.add(sun);

    // giant planets from JPL's approximate elements, with today's positions
    const dots: number[] = [], cols: number[] = [];
    for (const p of JPL_PLANETS) {
      const { el, pos } = planetAt(p, date);
      const c = new THREE.Color(p.color);
      scene.add(polyline(orbitRing(el, 180).map(toScene), c.getHex(), p.name === "Neptune" ? 0.95 : 0.6));
      const v = toScene(pos); dots.push(v.x, v.y, v.z); cols.push(c.r, c.g, c.b);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(dots, 3));
    pg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, vertexColors: true, map: dotTexture(), transparent: true, depthWrite: false })));
    const nl = st.label("Neptune, 30 au", "#a3aec6", 12); nl.position.set(0, 0, -34 * S); scene.add(nl);

    const g = { tno: new THREE.Group(), p9: new THREE.Group(), sel: new THREE.Group() };
    scene.add(g.tno, g.p9, g.sel);
    groups.current = g;

    st.onFrame((dt) => {
      if (!spin.current) return false;
      const a = dt * 0.05;                                   // slow turn until the visitor takes over
      const x = camera.position.x, z = camera.position.z;
      camera.position.x = x * Math.cos(a) - z * Math.sin(a);
      camera.position.z = x * Math.sin(a) + z * Math.cos(a);
      camera.lookAt(0, 0, 0);
      return true;
    });
    setReady(true);
    return () => { st.dispose(); stage.current = null; groups.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // distant objects
  useEffect(() => {
    const st = stage.current, g = groups.current;
    if (!ready || !st || !g) return;
    disposeTree(g.tno); g.tno.clear();
    const peri: number[] = [];
    for (const t of tnos.slice(0, 400)) {
      const el: Elements = { a: t.a, e: Math.min(t.e, 0.995), i: t.i, om: t.om, w: t.w };
      const pts = orbitRing(el, 220).map(toScene);
      if (isExtreme(t)) {
        g.tno.add(fatLine(pts, 0xefe7d3, 1.6, false, 0.95));
        const p = toScene(orbitPoint(el, 0)); peri.push(p.x, p.y, p.z);
      } else {
        g.tno.add(polyline(pts, 0x3b5182, 0.55));
      }
    }
    if (peri.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(peri, 3));
      g.tno.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, color: 0xf2b544, map: dotTexture(), transparent: true, depthWrite: false })));
    }
    st.invalidate();
  }, [tnos, ready]);

  // the hypothesised orbit
  useEffect(() => {
    const st = stage.current, g = groups.current;
    if (!ready || !st || !g) return;
    disposeTree(g.p9); g.p9.clear();
    if (showP9) {
      g.p9.add(fatLine(orbitRing(P9_REFERENCE, 240).map(toScene), 0x6aa9ff, 2.2, true));
      const lab = st.label("hypothesised orbit, one model", "#8fbcff", 12);
      lab.position.copy(toScene(orbitPoint(P9_REFERENCE, Math.PI)));
      g.p9.add(lab);
    }
    st.invalidate();
  }, [showP9, ready]);

  // highlight the object chosen in the list
  useEffect(() => {
    const st = stage.current, g = groups.current;
    if (!ready || !st || !g) return;
    disposeTree(g.sel); g.sel.clear();
    const t = tnos.find((x) => x.name === selected);
    if (t) {
      const el: Elements = { a: t.a, e: Math.min(t.e, 0.995), i: t.i, om: t.om, w: t.w };
      g.sel.add(fatLine(orbitRing(el, 240).map(toScene), 0xf2b544, 3));
      const p = toScene(orbitPoint(el, 0));
      // a line dropped to the planets' plane shows how far above or below it the closest point lies
      g.sel.add(polyline([p, new THREE.Vector3(p.x, 0, p.z)], 0xf2b544, 0.7));
      const lab = st.label(t.name, "#f2b544", 13);
      lab.position.copy(toScene(orbitPoint(el, Math.PI)));
      g.sel.add(lab);
    }
    st.invalidate();
  }, [selected, tnos, ready]);

  const view = (kind: "top" | "edge" | "free") => {
    const st = stage.current; if (!st) return;
    spin.current = false;
    const d = 28;
    if (kind === "top") st.camera.position.set(0, d, 0.001);
    else if (kind === "edge") st.camera.position.set(0, 0.35, d);
    else st.camera.position.set(12, 11, 21);
    st.camera.lookAt(0, 0, 0);
    st.controls.target.set(0, 0, 0);
    st.controls.update();
    st.invalidate();
  };

  return (
    <div className="relative w-full h-full">
      <div ref={box} className="fade-in w-full h-full rounded-sm overflow-hidden" role="img"
        aria-label="Three-dimensional view of the orbits of distant trans-Neptunian objects around the Sun. The same objects are listed in the table beside it." />
      {ready && (
        <div className="absolute left-2 bottom-2 seg" style={{ background: "rgba(23,35,57,0.9)" }}>
          <button onClick={() => view("top")} title="Look straight down on the planets' plane">From above</button>
          <button onClick={() => view("edge")} title="Look along the planets' plane to compare tilts">Edge-on</button>
          <button onClick={() => view("free")}>Reset</button>
        </div>
      )}
    </div>
  );
}
