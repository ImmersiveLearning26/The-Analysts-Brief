// The title screen's showcase (left panel): one object from the office, lit and lensed like the main viewer (same office
// HDR, AgX, 28° isometric lens, warm key and a soft contact shadow), turning slowly in the middle of the panel. Hovering
// a piece of the office swaps it in; leaving goes back to the default piece. One object, rendered only while visible.
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function createReel({ canvas, panel, envUrl = "/models/office_env.hdr" }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.05;     // the office mood
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4;
  scene.environmentRotation.set(0, -Math.PI / 2, 0);
  new HDRLoader().load(envUrl, (hdr) => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = 0.8; hdr.dispose(); }, undefined, () => {});
  scene.add(new THREE.HemisphereLight(0xd6e2ff, 0x4a3524, 0.5));                      // cool sky fill, warm bounce
  const sun = new THREE.DirectionalLight(0xffe6c8, 2.5); sun.position.set(-1.1, 4.2, 1.5);   // warm key, as in the room; high, so the shadow stays tight
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.1, far: 8 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  const ISO = new THREE.Vector3(1, 1.05, 1).normalize();                               // the main viewer's direction
  const caption = document.createElement("small"); caption.className = "reel-cap"; panel.append(caption);

  let current = null, next = null, mix = 1, deflt = null, shown = false, reduced = false, raf = 0, last = 0, t = 0;

  function make(src, label) {
    const copy = src.clone(true);
    copy.position.set(0, 0, 0); copy.updateMatrixWorld(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const own = [].concat(o.userData._mat?.isMaterial ? o.userData._mat : o.material).map((m) => { const c = m.clone(); c.transparent = true; return c; });
      o.material = own.length === 1 ? own[0] : own;                                    // own materials, never the hover glow
      delete o.userData._mat;
    });
    // measure visible geometry from its base positions only: morph targets (the case file's pages) inflate Box3
    const box = new THREE.Box3(), b = new THREE.Box3();
    copy.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes.position) return;
      for (let a = o; a; a = a.parent) if (!a.visible) return;
      box.union(b.setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld));
    });
    if (box.isEmpty()) box.setFromObject(copy);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    copy.position.set(-c.x, -box.min.y, -c.z);                                         // stand it on the ground, centred
    const k = 1 / Math.max(s.x, s.y, s.z);
    const holder = new THREE.Group(); holder.add(copy); holder.scale.setScalar(k); holder.userData.h = s.y * k;
    return { root: holder, label };
  }
  function fade(item, a) { item.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) m.opacity = a; }); }

  /** Show this object (null: back to the default). */
  function set(src, label) {
    const it = src ? make(src, label) : deflt; if (!it || it === current) return;
    if (next && next !== deflt) scene.remove(next.root);
    next = it; if (!next.root.parent) scene.add(next.root); fade(next, 0); mix = 0;
  }
  function setDefault(src, label) { deflt = make(src, label); if (!current && !next) { current = deflt; scene.add(deflt.root); fade(deflt, 1); caption.textContent = label; } }

  function resize() {
    const r = panel.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix();
  }
  function frameCam(h) {                                                               // fit a unit object, centred
    // fit by the tighter side: the panel is tall and narrow, so width usually decides (a unit object turning reads ~1.3 wide)
    const t14 = Math.tan(THREE.MathUtils.degToRad(14)), dist = Math.max(0.62 / t14, 0.74 / (t14 * cam.aspect));
    const target = new THREE.Vector3(0, Math.max(0.25, (h || 0.6) * 0.5), 0);
    cam.position.copy(target).addScaledVector(ISO, dist); cam.lookAt(target);
  }
  function draw(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; t += reduced ? 0 : dt;
    if (next) {                                                                        // cross-fade: out, then in
      mix = Math.min(1, mix + dt * (reduced ? 99 : 4.5));
      if (current) fade(current, 1 - Math.min(1, mix * 2));
      fade(next, Math.max(0, mix * 2 - 1));
      if (mix >= 1) { if (current && current !== next) scene.remove(current.root); current = next; next = null; caption.textContent = current.label || ""; }
    }
    for (const it of [current, next]) if (it) it.root.rotation.y = -0.6 + Math.sin(t * 0.35) * 0.5;   // a slow sway
    frameCam((next || current)?.root.userData.h);
    caption.style.opacity = next ? String(Math.max(0, 1 - mix * 2)) : "1";
    renderer.render(scene, cam);
  }
  function loop(now) { if (!shown) return; draw(now); raf = requestAnimationFrame(loop); }
  new ResizeObserver(() => shown && resize()).observe(panel);

  return {
    set, setDefault,
    preview(src, label) { set(src, label); },                                          // hover in the office
    show(on) {
      if (shown === !!on) return; shown = !!on; cancelAnimationFrame(raf); last = 0;
      if (shown) { resize(); raf = requestAnimationFrame(loop); }
    },
    set reduced(v) { reduced = !!v; },
    debug() { return { t, current: current?.label, next: next?.label }; },
  };
}
