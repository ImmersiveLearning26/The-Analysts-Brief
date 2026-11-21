// Inspector: ported from the investigation viewer (viewer/inspect.js). Click the case file and it comes up to the
// screen, straight and upright, over the blurred room, and opens. Click the paper and the top page slides aside onto
// the open flap; click the turned pile (or Previous) and it comes back. Scroll/drag reads, pinch or +/- zooms.
// Esc puts it back. The host renders the room blur from `inspector.blur` (0..1) and draws the tray.
import * as THREE from "three";

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
const FIT = 0.96;                                         // of the preview frame (v3): folder + extracted sheet fill it for reading

const _boxes = new WeakMap();
function baseBox(geo) {
  let b = _boxes.get(geo);
  if (!b) { b = new THREE.Box3().setFromBufferAttribute(geo.attributes.position); _boxes.set(geo, b); }   // base pose only: morph targets would inflate it
  return b;
}
export function boxOf(node, invSpace = null) {
  node.updateWorldMatrix(true, true);
  const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
  node.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    m.copy(o.matrixWorld); if (invSpace) m.premultiply(invSpace);
    box.union(tmp.copy(baseBox(o.geometry)).applyMatrix4(m));
  });
  return box;
}

export class Inspector {
  constructor({ camera, environment, hooks = {} }) {
    this.camera = camera; this.hooks = hooks;
    this.stage = new THREE.Scene();                       // the held object, rendered sharp on top of the room
    this.stage.environment = environment; this.stage.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(-1.2, 1.6, 1.4);
    const fill = new THREE.DirectionalLight(0xdfe9ff, 0.9); fill.position.set(1.5, 0.4, 1.0);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(0.4, 1.2, -1.6);
    this.lights = new THREE.Group(); this.lights.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.3));
    this.stage.add(this.lights);
    this.node = null; this.blur = 0; this.state = "idle"; // idle | in | held | out
    this.t = 0; this.spin = new THREE.Quaternion();
    this.zoom = 1; this.zoomT = 1; this.pan = new THREE.Vector2(); this.panT = new THREE.Vector2();
    this.pages = null; this.pageIdx = 0; this.turned = false; this.heldAt = 0; this.reduced = false;
  }

  get active() { return this.state !== "idle"; }

  /** Bring a node to the screen. For the case file, `startPage` pages are already turned when it arrives. */
  enter(node, { startPage = 0 } = {}) {
    if (this.active || !node) return false;
    this.node = node; this.origParent = node.parent; this.origMatrix = node.matrixWorld.clone();
    this.stage.attach(node);
    this.from = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    node.matrixWorld.decompose(this.from.p, this.from.q, this.from.s);
    const box = boxOf(node);
    this.center = box.getCenter(new THREE.Vector3()).sub(this.from.p);
    this.isCase = node.userData.sim_interaction === "open_close";

    this._readingBasis(node);
    this._extents(node);
    this.state = "in"; this.t = this.reduced ? 1 : 0; this.spin.identity();
    this.resetView(true);
    if (this.isCase) this._initPages(startPage);
    this.sequence = null;
    this.turned = startPage > 0; this.heldAt = 0;
    this.hooks.change?.();
    return true;
  }

  exit() {
    if (!this.active || ["out","returning"].includes(this.state)) return;
    // Return the sheet, close the cover, then lower the complete folder.
    this.state="returning"; this.sequence="exitReturn"; this.sequenceTime=0;
    this.pages?.forEach(p=>p.target.copy(p.home));
    this.hooks.change?.();
  }

  // ---- view: fit, zoom, pan
  _extents(node) {
    const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
    const lb = boxOf(node, inv).getSize(new THREE.Vector3()).multiply(this.from.s);
    const along = (v) => Math.abs(v.x) * lb.x + Math.abs(v.y) * lb.y + Math.abs(v.z) * lb.z;
    const { n, u } = this.basis, r = new THREE.Vector3().crossVectors(u, n);
    this.ext = { w: along(r) * (this.isCase ? 3.25 : 1), h: along(u), d: along(n) };
  }
  _fitDist() {
    // Fit inside the preview frame (frac = frame size / screen size), not the whole screen.
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), a = this.camera.aspect, fr = this.frac || { w: 1, h: 1 };
    return Math.max(this.ext.h / 2 / (FIT * fr.h * tanH), this.ext.w / 2 / (FIT * fr.w * tanH * a)) + this.ext.d / 2;
  }
  get maxZoom() { return Math.max(1, Math.min(8, this._fitDist() / (0.075 + this.ext.d / 2))); }
  resetView(initial) {
    this.readLock = false;
    this.zoomT = 1; this.panT.set(0, 0); this.spin.identity();
    if (initial) { this.zoom = this.zoomT; this.pan.copy(this.panT); }
  }
  _visHalf(z) { const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), D = this._fitDist() / z - this.ext.d / 2; return { y: D * tanH, x: D * tanH * this.camera.aspect }; }
  _panLimit(z) { const v = this._visHalf(z); return { x: Math.max(0, this.ext.w / 2 - v.x * 0.92), y: Math.max(0, this.ext.h / 2 - v.y * 0.92) }; }
  _clampPan() { const L = this._panLimit(this.zoomT); this.panT.x = THREE.MathUtils.clamp(this.panT.x, -L.x, L.x); this.panT.y = THREE.MathUtils.clamp(this.panT.y, -L.y, L.y); }
  zoomBy(f, sx = innerWidth / 2, sy = innerHeight / 2) {
    if (this._steering !== true) this.readLock = false;
    if (this.state !== "held" && this.state !== "in") return;
    const z0 = this.zoomT, z1 = THREE.MathUtils.clamp(z0 * f, 1, this.maxZoom); if (z1 === z0) return;
    const c = new THREE.Vector2(sx / innerWidth * 2 - 1, 1 - sy / innerHeight * 2);
    const v0 = this._visHalf(z0), v1 = this._visHalf(z1);
    this.panT.x += c.x * (v0.x - v1.x); this.panT.y += c.y * (v0.y - v1.y);
    this.zoomT = z1; this._clampPan();
  }
  /** Zoom straight onto the top page (the "Read" button). */
  focusPage() {
    // Reading view (v3.2): lock onto the extracted sheet. update() measures the sheet on screen each frame and steers
    // zoom/pan until it fills ~86% of the preview's height, just right of centre (the folder peeks in from the left).
    if (!this.pages || this.state !== "held") return;
    this.readLock = true;
    if (this.zoomT < 1.4) this.zoomT = 1.4;
  }


  panBy(dxPx, dyPx) {
    if (this._steering !== true) this.readLock = false;
    if (this.state !== "held") return;
    const v = this._visHalf(this.zoomT), k = (2 * v.y) / innerHeight;
    this.panT.x += dxPx * k; this.panT.y -= dyPx * k; this._clampPan();
  }
  wheel(e) {
    if (e.ctrlKey) { this.zoomBy(Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY); return; }
    const px = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
    let dx = e.deltaX * px, dy = e.deltaY * px; if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const L = this._panLimit(this.zoomT);
    if (L.x === 0 && L.y === 0) { this.zoomBy(Math.exp(-dy * 0.0016), e.clientX, e.clientY); return; }
    this.panBy(dx, dy);
  }

  _targetPose() {
    const cam = this.camera;
    const D = this._fitDist() / this.zoom;
    const pos = new THREE.Vector3(-this.pan.x, -this.pan.y, -D).applyMatrix4(cam.matrixWorld);
    const camQ = cam.getWorldQuaternion(new THREE.Quaternion());
    const { n, u } = this.basis, r = new THREE.Vector3().crossVectors(u, n);
    const readFrame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n));
    let q = camQ.clone().multiply(readFrame.invert());
    q = camQ.clone().multiply(this.spin).multiply(camQ.clone().invert()).multiply(q);
    const centerOffset = this.center.clone().applyQuaternion(this.from.q.clone().invert()).applyQuaternion(q);
    return { p: pos.sub(centerOffset), q, s: this.from.s };
  }

  _readingBasis(node) {
    const qInv = this.from.q.clone().invert();
    const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
    const lb = boxOf(node, inv).getSize(new THREE.Vector3()).multiply(this.from.s);
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const ext = [lb.x, lb.y, lb.z];
    const thin = ext.indexOf(Math.min(...ext));
    const thinW = axes[thin].clone().applyQuaternion(this.from.q);
    const up = new THREE.Vector3(0, 1, 0);
    const toCam = this.camera.getWorldPosition(new THREE.Vector3()).sub(this.from.p.clone().add(this.center)).setY(0).normalize();
    let nW, uW;
    const isPlate = Math.min(...ext) < 0.35 * Math.max(...ext);
    if (isPlate && Math.abs(thinW.y) > 0.7) {
      nW = up.clone();
      const cand = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)].filter((_, i) => [2, 1, 0][i] !== thin);
      uW = cand[0].applyQuaternion(this.from.q).setY(0).normalize();
    } else if (isPlate) {
      nW = thinW.clone().multiplyScalar(Math.sign(thinW.dot(toCam)) || 1); uW = up.clone();
    } else {
      nW = toCam.clone(); uW = up.clone();
    }
    uW.sub(nW.clone().multiplyScalar(uW.dot(nW))).normalize();
    this.basis = { n: nW.applyQuaternion(qInv).normalize(), u: uW.applyQuaternion(qInv).normalize() };
  }

  // ---- case-file pages
  _initPages(startPage) {
    const docs = []; this.node.traverse((o) => { if (/^CF_Page_\d+/.test(o.name)) docs.push(o); });
    docs.sort((a, b) => a.name.localeCompare(b.name));
    if (!docs.length) { this.pages = null; return; }
    const g = docs[0].geometry; const bb = baseBox(g);
    const pageW = (bb.max.x - bb.min.x) * docs[0].scale.x;
    this.pageBox = bb;
    this.pages = docs.map((o) => ({ o, home: o.position.clone(), target: o.position.clone(), cur: o.position.clone(), lift: 0 }));
    this.slide=pageW*1.12; this.pageIdx=Math.min(startPage,docs.length-1);
    // The sheets share one position but their meshes sit at different offsets in the stack, so a fixed slide lands
    // deeper sheets on top of the pile. Slide each sheet until its left edge clears the right edge of the whole stack.
    const edges=docs.map((o)=>{ const b=baseBox(o.geometry); return { l:o.position.x+b.min.x*o.scale.x, r:o.position.x+b.max.x*o.scale.x }; });
    const stackR=Math.max(...edges.map((e)=>e.r)), gap=pageW*.08;
    this.pages.forEach((pg,i)=>{ pg.slide=stackR+gap-edges[i].l; });
    this.pages.forEach((pg,i)=>{ pg.o.visible=i===this.pageIdx; });
  }
  side() { return 1; }
  turnTo(idx) {
    if (!this.pages || this.state!=="held") return;
    this.pendingIdx=THREE.MathUtils.clamp(idx,0,this.pages.length-1);
    this.pages.forEach(pg=>pg.target.copy(pg.home));
    this.sequence="pageReturn"; this.sequenceTime=0;
  }
  _extract() {
    this.pages?.forEach((pg,i)=>{
      pg.o.visible=i===this.pageIdx;
      pg.target.copy(pg.home);
      if(i===this.pageIdx) pg.target.x+=pg.slide ?? this.slide;
    });
  }

  rotate() { /* Reading surfaces always remain parallel to the screen. */ }

  pick(raycaster) { return this.node ? raycaster.intersectObject(this.node, true)[0] || null : null; }

  _steer() {
    const pg = this.pages[this.pageIdx]?.o; if (!pg) return;
    this.node.updateMatrixWorld(true);
    const b = baseBox(pg.geometry).clone().applyMatrix4(pg.matrixWorld); if (b.isEmpty()) return;   // base pose: morph targets would inflate it
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      v.set(x, y, z).project(this.camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, F = this.frameNdc;
    const wantH = .86 * F.h, wantX = F.cx + .05 * F.w;
    this._steering = true;
    this.zoomT = THREE.MathUtils.clamp(this.zoomT * Math.pow(wantH / Math.max(1e-3, h), .2), 1, this.maxZoom);
    const D = this._fitDist() / this.zoom, tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.panT.x += (cx - wantX) * D * tanH * this.camera.aspect * .25;
    this.panT.y += (cy - F.cy) * D * tanH * .25;
    const L = this._panLimit(this.zoomT); this.panT.x = THREE.MathUtils.clamp(this.panT.x, -L.x * 1.5, L.x * 1.5); this.panT.y = THREE.MathUtils.clamp(this.panT.y, -L.y * 1.5, L.y * 1.5);
    this._steering = false;
  }

  update(dt) {
    if (!this.node) { this.blur = smooth(this.blur, 0, dt, 8); return false; }
    // Closing runs faster than opening (ux-motion: fast closing): lift 420ms, lower 240ms.
    if (this.state === "in" || this.state === "out") this.t = Math.min(1, this.t + dt / (this.state === "in" ? 0.42 : 0.24));
    const k = this.state === "in" ? ease(this.t) : this.state === "out" ? 1 - ease(this.t) : 1;
    this.blur = k;
    this.zoom = smooth(this.zoom, this.zoomT, dt, 12);
    this.pan.x = smooth(this.pan.x, this.panT.x, dt, 14); this.pan.y = smooth(this.pan.y, this.panT.y, dt, 14);
    const to = this._targetPose();
    const p = this.from.p.clone().lerp(to.p, k); p.y += Math.sin(Math.PI * k) * 0.04 * (this.state === "in" ? 1 : 0.6);
    const q = this.from.q.clone().slerp(to.q, k);
    this.node.matrixAutoUpdate = true; this.node.position.copy(p); this.node.quaternion.copy(q); this.node.scale.copy(this.from.s);

    if (this.pages) {
      const rate=this.reduced?1e3:22;
      this.pages.forEach(pg=>{
        pg.cur.lerp(pg.target,1-Math.exp(-dt*rate));
        pg.o.position.copy(pg.cur); // Straight X translation only; no curl, tilt, lift or idle tease.
      });
    }
    if (this.readLock && this.state === "held" && this.pages && this.frameNdc && !this.sequence) this._steer();
    if(this.state === "in" && this.t>=1) {
      this.state="held"; this.hooks.open?.();
      this.sequence="opening"; this.sequenceTime=0;
      this.hooks.change?.();
    }
    if(this.sequence) {
      this.sequenceTime+=dt;
      // opening waits for the cover (~410ms at 8x). Exits and page swaps are quick: the learner is done with that sheet
      // and swaps happen up to 18 times (ux-motion: fast closing, frequency of use). exitClose matches the 14x cover close.
      const duration={opening:.46, exitClose:.25, exitReturn:.16, pageReturn:.18}[this.sequence] ?? .3;
      if(this.reduced || this.sequenceTime>=duration) {
        const step=this.sequence; this.sequence=null; this.sequenceTime=0;
        if(step === "opening") { this._extract(); this.focusPage(); }
        if(step === "pageReturn") {
          this.pageIdx=this.pendingIdx; this._extract(); this.hooks.change?.();
        }
        if(step === "exitReturn") { this.hooks.close?.(); this.sequence="exitClose"; }
        if(step === "exitClose") { this.state="out"; this.t=this.reduced?1:0; }
      }
    }
    if (this.state === "out" && this.t >= 1) {
      if (this.pages) this.pages.forEach((pg) => { pg.o.position.copy(pg.home); pg.cur.copy(pg.home); });
      this.pages?.forEach(pg=>pg.o.visible=true);
      this.origParent.attach(this.node);
      const inv = new THREE.Matrix4().copy(this.origParent.matrixWorld).invert();
      this.origMatrix.clone().premultiply(inv).decompose(this.node.position, this.node.quaternion, this.node.scale);
      this.node = null; this.pages = null; this.state = "idle"; this.blur = 0;
      this.hooks.change?.();
    }
    return true;
  }
}
