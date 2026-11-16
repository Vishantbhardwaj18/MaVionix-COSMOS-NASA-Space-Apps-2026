"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createStage, type Stage } from "@/lib/three-stage";

type Props = {
  data: Uint16Array | null;     // quantised pixels, FITS row order (row 0 at the bottom)
  nx: number; ny: number;
  lut: Uint8ClampedArray;       // the same stretch the flat view uses
  height: number;               // vertical exaggeration, 0.05 to 1
  onUnavailable: () => void;
};

// dark sky -> blue -> amber -> near white, so height and colour say the same thing
const RAMP: [number, [number, number, number]][] = [[0, [0.05, 0.08, 0.15]], [0.25, [0.16, 0.26, 0.5]], [0.6, [0.95, 0.71, 0.27]], [1, [1, 0.97, 0.87]]];
function ramp(v: number, out: Float32Array, o: number) {
  for (let k = 1; k < RAMP.length; k++) {
    if (v <= RAMP[k][0]) {
      const [a, ca] = RAMP[k - 1], [b, cb] = RAMP[k], t = (v - a) / (b - a);
      out[o] = ca[0] + (cb[0] - ca[0]) * t; out[o + 1] = ca[1] + (cb[1] - ca[1]) * t; out[o + 2] = ca[2] + (cb[2] - ca[2]) * t;
      return;
    }
  }
  out[o] = 1; out[o + 1] = 0.97; out[o + 2] = 0.87;
}

/**
 * The image as a landscape: brightness is height. A star is a peak whose width is the telescope's
 * blur, a cosmic-ray hit is a single-pixel spike, and the noise floor is the rough ground between.
 */
export default function Surface3D({ data, nx, ny, lut, height, onUnavailable }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const st = createStage(box.current, { fov: 36 });
    if (!st) { onUnavailable(); return; }
    stage.current = st;
    st.camera.position.set(0.75, 0.85, 1.25);
    st.controls.target.set(0, 0.05, 0);
    st.controls.minDistance = 0.4; st.controls.maxDistance = 4; st.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    st.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-1, 1.6, 0.8); st.scene.add(sun);
    setReady(true);
    return () => { st.dispose(); stage.current = null; mesh.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const st = stage.current;
    if (!ready || !st || !data || nx < 2 || ny < 2) return;
    let m = mesh.current;
    const want = `${nx}x${ny}`;
    if (!m || m.userData.dims !== want) {
      if (m) { st.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      const geo = new THREE.PlaneGeometry(1, ny / nx, nx - 1, ny - 1);
      geo.rotateX(-Math.PI / 2);                               // lie flat; +Y is brightness
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
      m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
      m.userData.dims = want;
      st.scene.add(m);
      mesh.current = m;
    }
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = m.geometry.getAttribute("color") as THREE.BufferAttribute;
    const carr = col.array as Float32Array;
    // plane vertices run row by row from the far edge; image row 0 (south) goes at the near edge
    for (let r = 0; r < ny; r++) {
      const src = (ny - 1 - r) * nx;
      for (let c = 0; c < nx; c++) {
        const v = lut[data[src + c]] / 255, i = r * nx + c;
        pos.setY(i, v * height * 0.5);
        ramp(v, carr, i * 3);
      }
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    m.geometry.computeVertexNormals();
    st.invalidate();
  }, [data, nx, ny, lut, height, ready]);

  return (
    <div ref={box} className="fade-in w-full h-full" role="img"
      aria-label="The image drawn as a three-dimensional surface, with brightness as height. Drag to turn it." />
  );
}
