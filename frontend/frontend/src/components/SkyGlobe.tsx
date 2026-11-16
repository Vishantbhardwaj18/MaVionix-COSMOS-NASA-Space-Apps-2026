"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBLIQUITY_DEG, eclipticPath } from "@/lib/orbits";
import { loadConstellations, loadMilkyWay, loadStars, radecToVec } from "@/lib/sky";
import { createStage, disposeTree, dotTexture, polyline, type Stage } from "@/lib/three-stage";

export type GlobeField = { label: string; ra: number; dec: number };
type Props = {
  fields: GlobeField[];
  picked: { ra: number; dec: number } | null;
  onPick: (ra: number, dec: number) => void;
  onUnavailable: () => void;
};

// equatorial unit vector -> scene (celestial north = +Y)
const V = (ra: number, dec: number, r = 1) => { const [x, y, z] = radecToVec(ra, dec); return new THREE.Vector3(x * r, z * r, -y * r); };
const sep = (a: { ra: number; dec: number }, b: { ra: number; dec: number }) => {
  const u = radecToVec(a.ra, a.dec), v = radecToVec(b.ra, b.dec);
  return (Math.acos(Math.min(1, Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) * 180) / Math.PI;
};

/**
 * The whole sky as a globe you can turn, with the real bright stars, the constellations, the
 * Milky Way and the ecliptic. It is drawn with ecliptic north at the top because SPHEREx's orbit
 * makes it pass over the two ecliptic poles on every circuit: those are its deep fields.
 * Click anywhere to choose a position.
 */
export default function SkyGlobe({ fields, picked, onPick, onUnavailable }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const sky = useRef<THREE.Group | null>(null);
  const pickMark = useRef<THREE.Group | null>(null);
  const spin = useRef(true);
  const cb = useRef(onPick);
  const fieldsRef = useRef(fields);
  useEffect(() => { cb.current = onPick; fieldsRef.current = fields; });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const st = createStage(box.current, { fov: 32, background: null, pageScroll: true });
    if (!st) { onUnavailable(); return; }
    stage.current = st;
    const { scene, camera, controls, renderer } = st;
    camera.position.set(0.9, 1.25, 3.3);
    controls.enablePan = false; controls.minDistance = 1.6; controls.maxDistance = 6; controls.rotateSpeed = 0.6;
    spin.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.addEventListener("start", () => { spin.current = false; });

    const g = new THREE.Group();
    g.rotation.x = (-OBLIQUITY_DEG * Math.PI) / 180;          // tip the globe so the ecliptic pole is up
    const turn = new THREE.Group(); turn.add(g); scene.add(turn);
    sky.current = g;

    // the body of the globe hides the far side, so only the near hemisphere of stars is seen
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.992, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0b1324 }));
    g.add(ball);
    const rim = new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 48), new THREE.MeshBasicMaterial({ color: 0x5c7fc0, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false }));
    g.add(rim);

    // coordinate grid: every 30 degrees of declination and every 2 hours of right ascension
    for (let dec = -60; dec <= 60; dec += 30) g.add(polyline(Array.from({ length: 121 }, (_, k) => V(k * 3, dec, 1.001)), 0x22304c, dec === 0 ? 0.95 : 0.7));
    for (let ra = 0; ra < 360; ra += 30) g.add(polyline(Array.from({ length: 61 }, (_, k) => V(ra, -90 + k * 3, 1.001)), 0x22304c, 0.7));

    // the ecliptic and its two poles
    g.add(polyline(eclipticPath(180).map(([ra, dec]) => V(ra, dec, 1.003)), 0xf2b544, 0.85));
    const eps = OBLIQUITY_DEG;
    const poles: [string, number, number][] = [["north ecliptic pole", 270, 90 - eps], ["south ecliptic pole", 90, -(90 - eps)]];
    for (const [, ra, dec] of poles) {
      // a 6-degree circle round each pole: roughly the area SPHEREx sees on almost every orbit
      const c = radecToVec(ra, dec);
      const ax = new THREE.Vector3(c[0], c[2], -c[1]);
      const ref = Math.abs(ax.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(ax, ref).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
      const rad = (6 * Math.PI) / 180;
      g.add(polyline(Array.from({ length: 73 }, (_, k) => { const a = (k / 72) * 2 * Math.PI; return ax.clone().multiplyScalar(Math.cos(rad)).addScaledVector(u, Math.sin(rad) * Math.cos(a)).addScaledVector(w, Math.sin(rad) * Math.sin(a)).multiplyScalar(1.004); }), 0xf2b544, 0.9));
    }

    // showcase fields
    const fpos: number[] = [];
    for (const f of fieldsRef.current) {
      const p = V(f.ra, f.dec, 1.006); fpos.push(p.x, p.y, p.z);
      const lab = st.label(f.label, "#efe7d3", 12);
      lab.position.copy(V(f.ra, f.dec, 1.03));
      g.add(lab);
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3));
    g.add(new THREE.Points(fg, new THREE.PointsMaterial({ size: 10, sizeAttenuation: false, color: 0xf2b544, map: dotTexture(), transparent: true, depthWrite: false })));

    const pm = new THREE.Group(); g.add(pm); pickMark.current = pm;

    // real sky, loaded after the globe is already on screen
    const ac = new AbortController();
    loadStars("stars.6.json", ac.signal).then((stars) => {
      const pos = new Float32Array(stars.length * 3), col = new Float32Array(stars.length * 3), size = new Float32Array(stars.length);
      stars.forEach((s, i) => {
        pos.set([s.x * 1.002, s.z * 1.002, -s.y * 1.002], i * 3);
        const b = Math.min(1, 0.6 + (6 - s.mag) * 0.12);
        col.set([(s.rgb[0] / 255) * b, (s.rgb[1] / 255) * b, (s.rgb[2] / 255) * b], i * 3);
        size[i] = Math.max(1.6, 1.5 + (5.5 - s.mag) * 1.25);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("tint", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { dpr: { value: renderer.getPixelRatio() } },
        vertexShader: "attribute float size; attribute vec3 tint; varying vec3 vc; uniform float dpr; void main(){ vc=tint; gl_PointSize=size*dpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "varying vec3 vc; void main(){ float d=length(gl_PointCoord-vec2(0.5)); if(d>0.5) discard; gl_FragColor=vec4(vc, smoothstep(0.5,0.15,d)); }",
        transparent: true, depthWrite: false,
      });
      g.add(new THREE.Points(geo, mat));
      st.invalidate();
    }).catch(() => {});
    loadConstellations(ac.signal).then((lines) => {
      for (const l of lines) if (l.length > 1) g.add(polyline(l.map(([ra, dec]) => V(ra, dec, 1.0015)), 0x6f86b8, 0.45));
      st.invalidate();
    }).catch(() => {});
    loadMilkyWay(ac.signal).then((polys) => {
      for (const p of polys) {
        if (p.level > 3) continue;                              // the three outer brightness contours
        for (const ring of p.rings) if (ring.length > 8) g.add(polyline(ring.map(([ra, dec]) => V(ra, dec, 1.001)), 0x9db4e6, 0.05 + 0.035 * p.level));
      }
      st.invalidate();
    }).catch(() => {});

    // click (not drag) chooses a position
    const ray = new THREE.Raycaster(), down = { x: 0, y: 0 };
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => { down.x = e.clientX; down.y = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(ball)[0];
      if (!hit) return;
      const p = g.worldToLocal(hit.point.clone()).normalize();
      let ra = (Math.atan2(-p.z, p.x) * 180) / Math.PI; ra = (ra + 360) % 360;
      const dec = (Math.asin(Math.max(-1, Math.min(1, p.y))) * 180) / Math.PI;
      // a click near a marked field means that field
      const near = fieldsRef.current.find((f) => sep(f, { ra, dec }) < 5);
      spin.current = false;
      cb.current(near ? near.ra : Number(ra.toFixed(2)), near ? near.dec : Number(dec.toFixed(2)));
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);

    st.onFrame((dt) => { if (!spin.current) return false; turn.rotation.y += dt * 0.06; return true; });
    setReady(true);
    return () => { ac.abort(); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); st.dispose(); stage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mark the chosen position
  useEffect(() => {
    const st = stage.current, pm = pickMark.current;
    if (!ready || !st || !pm) return;
    disposeTree(pm); pm.clear();
    if (picked) {
      const c = radecToVec(picked.ra, picked.dec);
      const ax = new THREE.Vector3(c[0], c[2], -c[1]);
      const ref = Math.abs(ax.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(ax, ref).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
      const rad = (3 * Math.PI) / 180;
      pm.add(polyline(Array.from({ length: 49 }, (_, k) => { const a = (k / 48) * 2 * Math.PI; return ax.clone().multiplyScalar(Math.cos(rad)).addScaledVector(u, Math.sin(rad) * Math.cos(a)).addScaledVector(w, Math.sin(rad) * Math.sin(a)).multiplyScalar(1.008); }), 0xffffff, 1));
      pm.add(polyline([ax.clone().multiplyScalar(1.0), ax.clone().multiplyScalar(1.12)], 0xffffff, 1));
    }
    st.invalidate();
  }, [picked, ready]);

  return (
    <div ref={box} className="fade-in w-full h-full" style={{ cursor: "crosshair" }} role="img"
      aria-label="A globe of the whole sky with the bright stars, the ecliptic and SPHEREx's two deep fields at the ecliptic poles. The same fields are listed as links beside it." />
  );
}
