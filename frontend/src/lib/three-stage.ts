// A small wrapper round three.js used by every 3D view on the site: renderer, camera, orbit
// controls, resize handling, a render loop that only draws when something changed, and clean-up.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** A text label that faces the camera and stays `px` CSS pixels tall whatever the zoom. */
  label: (text: string, color?: string, px?: number) => THREE.Sprite;
  /** Ask for one more frame to be drawn. */
  invalidate: () => void;
  /** Called before every drawn frame with the time step in seconds. Return true to keep animating. */
  onFrame: (cb: ((dt: number) => boolean | void) | null) => void;
  size: () => { w: number; h: number };
  dispose: () => void;
};

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function createStage(container: HTMLElement, opts: { fov?: number; near?: number; far?: number; background?: number | null; pageScroll?: boolean } = {}): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: opts.background === null, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (opts.background !== null) renderer.setClearColor(opts.background ?? 0x0c1426, 1);
  const el = renderer.domElement;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.touchAction = "none";
  container.appendChild(el);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 40, 1, opts.near ?? 0.01, opts.far ?? 500);
  const controls = new OrbitControls(camera, el);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // On a phone a full-width 3D view must not trap the page: an up-or-down swipe scrolls the page,
  // a sideways drag turns the view, and two fingers zoom.
  if (opts.pageScroll && window.matchMedia("(pointer: coarse)").matches) el.style.touchAction = "pan-y";

  let frame: ((dt: number) => boolean | void) | null = null;
  let dirty = true, raf = 0, last = 0, disposed = false;
  const invalidate = () => { dirty = true; };
  controls.addEventListener("change", invalidate);

  const labels: { s: THREE.Sprite; px: number; aspect: number }[] = [];
  const sizeLabels = () => {
    const h = Math.max(1, container.clientHeight), k = 2 * Math.tan((camera.fov * Math.PI) / 360);
    for (const l of labels) { const hh = ((l.px * 1.5) / h) * k; l.s.scale.set(hh * l.aspect, hh, 1); }
  };
  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sizeLabels();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const loop = (t: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016;
    last = t;
    const keep = frame ? frame(dt) : false;
    const moved = controls.update();
    if (dirty || keep || moved) {
      dirty = false;
      renderer.render(scene, camera);
    }
  };
  raf = requestAnimationFrame(loop);

  const label = (text: string, color = "#a3aec6", px = 12) => {
    const { sprite, aspect } = textSprite(text, color, px);
    labels.push({ s: sprite, px, aspect });
    sizeLabels();
    return sprite;
  };

  return {
    scene, camera, renderer, controls, invalidate, label,
    onFrame: (cb) => { frame = cb; dirty = true; },
    size: () => ({ w: container.clientWidth, h: container.clientHeight }),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      el.remove();
    },
  };
}

/** Free the GPU memory of everything under an object. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.MeshBasicMaterial).map?.dispose?.();
      mat.dispose?.();
    }
  });
}

function textSprite(text: string, color: string, px: number): { sprite: THREE.Sprite; aspect: number } {
  const pad = 4, scale = 3;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = `${px * scale}px "IBM Plex Sans Variable", system-ui, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2 * scale, h = Math.ceil(px * 1.5 * scale);
  c.width = w; c.height = h;
  g.font = font; g.textBaseline = "middle";
  g.shadowColor = "rgba(8,13,25,0.95)"; g.shadowBlur = 4 * scale;      // keeps the words legible over lines
  g.fillStyle = color;
  g.fillText(text, pad * scale, h / 2);
  g.fillText(text, pad * scale, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.center.set(0, 0.5);
  return { sprite, aspect: w / h };
}

/** Soft round dot texture for point sprites. */
export function dotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.95)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function polyline(points: THREE.Vector3[], color: number, opacity = 1, dashed = false): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: opacity < 1, opacity, dashSize: 0.12, gapSize: 0.08 })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  return line;
}
