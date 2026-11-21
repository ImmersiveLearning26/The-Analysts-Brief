// The sorting folders (P03): a blue binder (Foundations, O) and a red binder (Set aside, X) from folders.glb
// (Sketchfab "Folders" by I3D, CC BY 4.0), drawn in their own small transparent canvas at the side of the screen.
// They turn slowly and breathe; a sheet marked O or X flies into one (see main.js flyToTray) and the binder takes it
// with a small bump. Clicking a binder lists what is inside so a sheet can be pulled out and re-marked.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BINDERS = { foundations: "Cube", aside: "Cube004" };    // the blue and the red binder ("Cube.004" in the file; three.js drops the dot)
const ORDER = ["foundations", "aside"];                          // blue on top, red below

export function createTrays({ url, onPick }) {
  const wrap = document.createElement("div");
  wrap.id = "trays"; wrap.hidden = true;
  wrap.innerHTML = `<canvas aria-hidden="true"></canvas>${ORDER.map((k) => `<button type="button" class="tray-hit" data-tray="${k}" aria-label="${k === "foundations" ? "Foundations folder (blue): open to see or take back a source" : "Set aside folder (red): open to see or take back a source"}"></button>`).join("")}`;
  document.body.append(wrap);
  const canvas = wrap.querySelector("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3226, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50); cam.position.set(0, 0, 10);
  const slots = {};                     // kind -> { pivot, bump }
  let ready = false, raf = 0, shown = false, reduced = false, t = 0, last = 0;

  new GLTFLoader().load(url, (g) => {
    g.scene.updateMatrixWorld(true);
    ORDER.forEach((kind, i) => {
      const src = g.scene.getObjectByName(BINDERS[kind]); if (!src) return;
      const copy = src.clone(true);
      src.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);   // keep the pose it had in the pile
      // the covers take the exact colours of the O and X marks
      copy.traverse((o) => { if (o.isMesh && /^(blue|material)$/.test(o.material?.name)) { o.material = o.material.clone(); o.material.color.set(kind === "aside" ? 0xe0483a : 0x2f6bd8); o.material.roughness = .55; } });
      const holder = new THREE.Group(); holder.add(copy);
      const box = new THREE.Box3().setFromObject(holder), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      copy.position.sub(c);                                                   // centre on its own middle
      // stand it upright: its longest side vertical, its thinnest (the spine depth) facing the camera
      const axes = [["x", s.x], ["y", s.y], ["z", s.z]].sort((a, b) => b[1] - a[1]);
      const upAxis = axes[0][0], thinAxis = axes[2][0];
      const orient = new THREE.Group(); orient.add(holder);
      if (upAxis === "x") orient.rotation.z = Math.PI / 2; else if (upAxis === "z") orient.rotation.x = -Math.PI / 2;
      if (thinAxis === "x" && upAxis !== "x") orient.rotation.y = Math.PI / 2;
      const norm = new THREE.Group(); norm.add(orient);
      const nb = new THREE.Box3().setFromObject(norm), ns = nb.getSize(new THREE.Vector3());
      norm.scale.setScalar(1 / Math.max(ns.x, ns.y, ns.z));                   // one unit tall
      const pivot = new THREE.Group(); pivot.add(norm);
      norm.position.sub(new THREE.Box3().setFromObject(norm).getCenter(new THREE.Vector3()));   // spin about its own middle
      pivot.position.y = i === 0 ? 1 : -1;                                    // one folder height apart (gap = height)
      pivot.userData.phase = i * 1.7;
      scene.add(pivot); slots[kind] = { pivot, bump: 0 };
    });
    ready = true; resize(); if (shown) loop(performance.now());
  });

  function resize() {
    const r = wrap.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false);
    const aspect = r.width / Math.max(1, r.height), h = 1.75;                 // two folders + one gap, with a margin
    Object.assign(cam, { left: -h * aspect, right: h * aspect, top: h, bottom: -h }); cam.updateProjectionMatrix();
  }
  addEventListener("resize", () => shown && resize());

  function draw(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; t += reduced ? 0 : dt;
    for (const [kind, s] of Object.entries(slots)) {
      const p = s.pivot, ph = p.userData.phase;
      p.rotation.y = reduced ? -0.45 : -0.45 + t * 0.55 + ph;                // a slow, steady turn
      s.bump = Math.max(0, s.bump - dt * 2.6);
      const breathe = reduced ? 1 : 1 + Math.sin(t * 2.1 + ph) * 0.025;       // pulsing, gently
      const pop = Math.sin(Math.min(1, 1 - s.bump) * Math.PI) * 0.12 * (s.bump > 0 ? 1 : 0);
      p.scale.setScalar(0.82 * (breathe + pop));
    }
    renderer.render(scene, cam);
  }
  function loop(now) { if (!shown) return; draw(now); raf = requestAnimationFrame(loop); }

  wrap.addEventListener("click", (e) => { const k = e.target.closest("[data-tray]")?.dataset.tray; if (k) onPick?.(k); });

  return {
    el: wrap,
    show(on) {
      if (shown === !!on) return; shown = !!on; wrap.hidden = !shown; wrap.classList.toggle("on", shown);
      cancelAnimationFrame(raf); last = 0;
      if (shown && ready) { resize(); raf = requestAnimationFrame(loop); }
    },
    set reduced(v) { reduced = !!v; },
    /** Screen rect (CSS px) of a folder, for the flight of a marked sheet. */
    rect(kind) {
      const r = wrap.getBoundingClientRect(), h = r.height / 3.5, sl = slots[kind];
      let cx = r.left + r.width / 2, cy = r.top + r.height / 2 + (ORDER.indexOf(kind) === 0 ? -1 : 1) * (r.height / 3.5);
      if (sl) { const v = sl.pivot.getWorldPosition(new THREE.Vector3()).project(cam); cx = r.left + (v.x + 1) / 2 * r.width; cy = r.top + (1 - v.y) / 2 * r.height; }
      return { x: cx - h * 0.4, y: cy - h / 2, w: h * 0.8, h };
    },
    bump(kind) { if (slots[kind]) slots[kind].bump = 1; },
  };
}
