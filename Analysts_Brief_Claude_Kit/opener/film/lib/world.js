// The opener's 3D world: the game's own models, lit like the app (web/src/world.js), and one camera whose every
// frame is a pure function of timeline time. render(t) never reads the previous frame.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { cutaway, thickenWalls, contactShadow, visibleBounds } from "./spatial.js";
import { GlobeStill, speech } from "./globe.js";

const cv = (v) => new THREE.Vector3(v[0], v[2], -v[1]);   // Blender (x,y,z) -> three
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const E = {
  lin: (x) => x,
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  in2: (x) => x * x,
  out3: (x) => 1 - Math.pow(1 - x, 3),
  inOut3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Places in the one world. The office sits at the origin as in the app; the others are set apart so the camera can travel.
const KAL_AT = V(0, -40, 0), HALL_AT = V(80, 0, 0);

// Moods, from the app (web/src/world.js MOODS)
const MOODS = {
  office: { env: 0.8, exposure: 1.05, windows: 0.45, ceil: 0.55, hemi: 0.5, sun: 2.5, lamp: 0 },
  model:  { env: 0.8, exposure: 1.1, windows: 0, ceil: 0, hemi: 0.7, sun: 2.6, lamp: 0 },
  hall:   { env: 0.38, exposure: 0.98, windows: 0.3, ceil: 0.3, hemi: 0.3, sun: 1.1, lamp: 0 },
  chair:  { env: 0.5, exposure: 1.05, windows: 1.1, ceil: 0.16, hemi: 0.5, sun: 0, lamp: 3.4 },
};

// Grounds behind the transparent canvas
const GROUND = {
  warm: "#f4f3ee",
  model: "radial-gradient(120% 105% at 50% 122%,#5a3fd0 0%,#2b2070 30%,#15142a 66%,#0d0d17 100%)",
  dusk: "radial-gradient(110% 100% at 70% 20%,#2a2740 0%,#17151f 55%,#0e0d13 100%)",
};

const EDGE_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const EDGE_FRAG = `
  uniform float uTime; uniform float uBoost; uniform vec3 uColor; varying vec2 vUv;
  void main(){
    float b = fract((vUv.x + uTime / 10.0) * 28.0);
    float band = smoothstep(0.0, 0.12, b) * (1.0 - smoothstep(0.12, 0.35, b));
    float lift = mix(0.55, 1.0, vUv.y) * (1.0 - smoothstep(0.80, 0.86, vUv.y)) + smoothstep(0.92, 1.0, vUv.y);
    float a = clamp((0.12 + band) * lift, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.6 + 1.6 * band) * (0.7 + uBoost), a * 0.75 * uBoost);
  }`;

export async function createWorld({ canvas, globeCanvas, ground, wash, pin }) {
  const W = 1920, H = 1080;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.02, 600);
  camera.filmGauge = 36;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = roomEnv;
  scene.environmentRotation.set(0, -Math.PI / 2, 0);

  RectAreaLightUniformsLib.init();
  const windows = [1.54, -1.55].map((x) => {
    const l = new THREE.RectAreaLight(0xd9e8ff, 1, 1.6, 1.9);
    l.position.copy(cv([x, -2.65, 1.85])); l.lookAt(cv([x, 0, 1.6])); scene.add(l); return l;
  });
  const ceil = new THREE.PointLight(0xfff3e4, 1, 7, 1.6); ceil.position.copy(cv([0, 0.9, 2.7])); scene.add(ceil);
  const hemi = new THREE.HemisphereLight(0xd6e2ff, 0x4a3524, 0.22); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c8, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const lampSpot = new THREE.SpotLight(0xffb46b, 0, 3.2, Math.PI / 3.2, 0.6, 1.5);
  lampSpot.position.copy(cv([0.74, 0.26, 1.19])); lampSpot.target.position.copy(cv([0.15, -0.05, 0.77]));
  lampSpot.castShadow = true; lampSpot.shadow.mapSize.set(1024, 1024); lampSpot.shadow.bias = -0.0006;
  scene.add(lampSpot, lampSpot.target);

  const draco = new DRACOLoader().setDecoderPath("lib/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const hdrP = new HDRLoader().loadAsync("assets/models/office_env.hdr").then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const tex = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); return tex;
  }).catch(() => null);

  async function load(name, file, place) {
    const g = await loader.loadAsync("assets/models/" + file);
    const root = g.scene; root.name = "ASSET_" + name;
    if (place) root.position.copy(place);
    root.traverse((o) => { if (o.isMesh && name !== "kalinda") { o.castShadow = true; o.receiveShadow = true; } });
    if (name === "office") root.traverse((o) => { if (o.isMesh && o.material?.name === "MAT_Wall_Sand") { const m = o.material.clone(); m.normalMap = null; m.color.set(0xe3d5c0); m.roughness = 0.95; o.material = m; } });
    scene.add(root); cutaway(root, name);
    if (name === "office") thickenWalls(root);
    if (["office", "kalinda", "hall"].includes(name)) contactShadow(root, name === "kalinda" ? 0.5 : name === "hall" ? 0.42 : 0.38);
    if (name === "hall") root.traverse((o) => { if (o.isMesh && /^MAT_Hall_Paint/.test(o.material?.name)) o.material.emissiveIntensity = 0.25; });
    return { root, mixer: new THREE.AnimationMixer(root), clips: g.animations };
  }
  const [officeEnv, office, casefile, kalinda, hall, chair] = await Promise.all([
    hdrP,
    load("office", "office.glb"),
    load("casefile", "casefile.glb", cv([-0.2, 0.15, 0.776])),
    load("kalinda", "kalinda.glb", KAL_AT),
    load("hall", "hall.glb", HALL_AT),
    load("chair", "chair_office_props.glb"),
  ]);
  const node = (a, n) => a.root.getObjectByName(n);
  contactShadow(chair.root, 0.5);
  { const m = contactShadow(office.root, 0.34); if (m) { casefile.root.attach(m); m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(0.62, 0.5);
      const at = cv([-0.2, 0.15, 0.776]).add(V(0.05, -0.012, 0)); m.position.copy(casefile.root.worldToLocal(at)); m.rotation.set(-Math.PI / 2, 0, 0); } }

  // ---- the case file: authored open clip, white paper, the top sheet painted and later slid out
  const cfRoot = node(casefile, "CASEFILE_Root");
  const cfClip = casefile.clips.find((c) => c.name === "CaseFile_OpenClose");
  const cfAct = cfClip ? casefile.mixer.clipAction(cfClip) : null;
  if (cfAct) { cfAct.setLoop(THREE.LoopOnce, 1); cfAct.clampWhenFinished = true; cfAct.play(); cfAct.paused = true; }
  cfRoot.traverse((o) => {
    if (/^CF_Page_\d+/.test(o.name)) { o.material = o.material.clone(); o.material.color.set(0xffffff); o.material.roughness = 0.82; o.material.toneMapped = false; }
    if (/^CF_PaperStack_Edges/.test(o.name)) { o.material = o.material.clone(); o.material.toneMapped = false; o.material.color.set(0xefebe2); }
  });
  const sheet = node(casefile, "CF_Page_01");
  const sheetHome = sheet.position.clone();
  sheet.geometry.computeBoundingBox();
  const sb = sheet.geometry.boundingBox, sheetW = (sb.max.x - sb.min.x);
  const pageCv = document.createElement("canvas"); pageCv.width = 1024; pageCv.height = 1448;
  const pageTex = new THREE.CanvasTexture(pageCv); pageTex.colorSpace = THREE.SRGBColorSpace; pageTex.anisotropy = 8;
  pageTex.flipY = false;
  sheet.material.map = pageTex; sheet.material.needsUpdate = true;
  let lastMark = -1;
  function paintPage(mark) {
    if (Math.abs(mark - lastMark) < 1e-4) return; lastMark = mark;
    const x = pageCv.getContext("2d");
    x.fillStyle = "#fbfaf7"; x.fillRect(0, 0, 1024, 1448);
    x.fillStyle = "#a8763e"; x.font = '700 30px Manrope'; x.letterSpacing = "6px";
    x.fillText("SOURCE 04 · RADIO KALINDA", 96, 150);
    x.letterSpacing = "0px";
    x.fillStyle = "#1d2321"; x.font = '600 84px "Afacad"';
    x.fillText("Election night", 96, 270); x.fillText("broadcast", 96, 360);
    x.fillStyle = "#1d23212e";
    for (let i = 0; i < 15; i++) { const w = i % 5 === 4 ? 420 : 832 - ((i * 37) % 90); x.fillRect(96, 450 + i * 52, w, 18); }
    if (mark > 0) {           // the blue O: drawn on, clockwise from the top
      x.strokeStyle = "#2f6bd8"; x.lineWidth = 16; x.lineCap = "round";
      x.beginPath(); x.arc(840, 210, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mark); x.stroke();
    }
    pageTex.needsUpdate = true;
  }

  // ---- Kalinda: edge wall shader, the authored loops and the Coup outcome
  const edgeMat = new THREE.ShaderMaterial({ vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uBoost: { value: 1.0 }, uColor: { value: new THREE.Color(0xff7a1a) } } });
  const wall = node(kalinda, "KAL_EdgeWall"); if (wall) { wall.visible = true; wall.traverse((o) => { if (o.isMesh) o.material = edgeMat; }); }
  const kalLoops = [], kalSim = [];
  for (const c of kalinda.clips) {
    const a = kalinda.mixer.clipAction(c); a.play(); a.paused = true;
    if (/_Loop$/.test(c.name)) kalLoops.push(a);
    else if (/^KAL_Sim_Coup__/.test(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; kalSim.push(a); }
  }

  // ---- the Chair's desk
  const rec = node(chair, "CHAIR_RecIndicator");
  if (rec) rec.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xff2a1a); o.material.emissiveIntensity = 4; o.material.toneMapped = false; } });

  const recGlow = new THREE.PointLight(0xff3020, 0, 0.22, 2);
  if (rec) { rec.getWorldPosition(recGlow.position); recGlow.position.y += 0.03; scene.add(recGlow); }

  // ---- anchors for the camera, measured from the models
  scene.updateMatrixWorld(true);
  const bOffice = visibleBounds(office.root), bKal = visibleBounds(kalinda.root), bHall = visibleBounds(hall.root);
  const cOffice = bOffice.getCenter(V()), cKal = bKal.getCenter(V()), cHall = bHall.getCenter(V());
  const folder = cv([-0.2, 0.15, 0.776]);
  const table = (node(hall, "HALL_PlanningTable")?.getWorldPosition(V())) || cHall.clone();
  const tableTop = table.clone().add(V(0, 0.8, 0));
  const recorder = node(chair, "CHAIR_Recorder").getWorldPosition(V());
  const bChair = visibleBounds(chair.root), cChair = bChair.getCenter(V());
  const LIFT = 0.45, folderUp = folder.clone().add(V(0, LIFT, 0));

  const tV = Math.tan(THREE.MathUtils.degToRad(14)), tH = tV * W / H;
  function fitDist(box, dir, margin = 1) {
    const d = dir.clone().normalize(), fwd = d.clone().negate();
    const right = V().crossVectors(fwd, V(0, 1, 0)).normalize(), up = V().crossVectors(right, fwd), c = box.getCenter(V());
    let dist = 0; const r = V();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      r.set(x, y, z).sub(c); const al = r.dot(d);
      dist = Math.max(dist, al + Math.abs(r.dot(up)) / tV, al + Math.abs(r.dot(right)) / tH);
    }
    return dist * margin;
  }
  const ISO = V(1, 1.05, 1).normalize();
  const rotY = (v, deg) => v.clone().applyAxisAngle(V(0, 1, 0), THREE.MathUtils.degToRad(deg));
  const Doff = fitDist(bOffice, ISO), Dkal = fitDist(bKal, ISO), Dhall = fitDist(bHall, ISO);

  // ---- the camera: shots as [t0, t1, from, to, ease]; each state is { target, dir, dist, oy (view offset px) }
  const S = (target, dir, dist, oy = 0, ox = 0) => ({ target, dir: dir.clone().normalize(), dist, oy, ox });
  const FC = folderUp.clone().add(V(0.09, 0, 0));          // between the folder and the sheet it slides out
  const DIRC = V(0.42, 1.25, 0.95), DIRB = V(0.2, 0.62, 1);
  const Dcase = 1.25, Dch = fitDist(bChair, DIRB);
  const shots = [
    [0.0, 2.4, S(cOffice, rotY(ISO, 18), Doff * 1.3, -300), S(cOffice, rotY(ISO, 18), Doff * 1.3, -300), E.lin],
    [2.4, 4.4, S(cOffice, rotY(ISO, 18), Doff * 1.3, -300), S(cOffice, rotY(ISO, 10), Doff * 1.22, -290), E.sine],
    [4.4, 5.6, S(cOffice, rotY(ISO, 10), Doff * 1.22, -290), S(FC, DIRC, Dcase * 1.25, -190), E.inOut3],
    [5.6, 8.6, S(FC, DIRC, Dcase * 1.25, -190), S(FC, rotY(DIRC, -6), Dcase * 1.22, -250), E.sine],
    [8.6, 9.0, S(FC, rotY(DIRC, -6), Dcase * 1.22, -250), S(FC.clone().add(V(0, -1.4, 0)), V(0.3, 1.8, 0.5), 0.3, -250), E.in2],
    [9.0, 11.2, S(cKal, rotY(V(0.25, 1, 0.35), -30), Dkal * 1.7, -330), S(cKal, rotY(ISO, -4), Dkal * 0.95, -330), E.out3],
    [11.2, 12.7, S(cKal, rotY(ISO, -4), Dkal * 0.95, -330), S(cKal, rotY(ISO, 8), Dkal * 0.9, -330), E.lin],
    [12.7, 13.0, S(cKal, rotY(ISO, 8), Dkal * 0.9, -330), S(cKal.clone().add(V(0, Dkal * 0.4, 0)), rotY(V(0.4, 1.4, 0.5), 8), Dkal * 2.2, -330), E.in2],
    [13.0, 14.6, S(cHall, rotY(V(0.6, 1.6, 0.9), 20), Dhall * 1.5, -110), S(cHall, rotY(ISO, 6), Dhall * 0.98, -110), E.out3],
    [14.6, 16.2, S(cHall, rotY(ISO, 6), Dhall * 0.98, -110), S(cHall, rotY(ISO, -4), Dhall * 0.92, -110), E.lin],
    [16.2, 16.5, S(cHall, rotY(ISO, -4), Dhall * 0.92, -110), S(table.clone(), rotY(ISO, -4), Dhall * 0.2, -110), E.in2],
    [16.5, 18.2, S(cChair, rotY(DIRB, 14), Dch * 1.5, -330), S(cChair, DIRB, Dch * 1.22, -330), E.out3],
    [18.2, 19.7, S(cChair, DIRB, Dch * 1.22, -330), S(cChair, rotY(DIRB, -5), Dch * 1.17, -330), E.lin],
    [19.7, 20.4, S(cChair, rotY(DIRB, -5), Dch * 1.17, -330), S(cChair, V(0.3, 1.2, 1), Dch * 4, -330), E.in2],
  ];
  function camAt(t) {
    const s = shots.find(([a, b]) => t >= a && t < b) || shots[shots.length - 1];
    const k = s[4](prog(t, s[0], s[1])), A = s[2], B = s[3];
    const target = A.target.clone().lerp(B.target, k);
    const dir = A.dir.clone().lerp(B.dir, k).normalize();
    return { target, pos: target.clone().addScaledVector(dir, lerp(A.dist, B.dist, k)), oy: lerp(A.oy, B.oy, k), ox: lerp(A.ox, B.ox, k) };
  }

  // ---- places: which models show, the mood, the ground
  function place(t) { return t < 9.0 ? "office" : t < 13.0 ? "model" : t < 16.5 ? "hall" : t < 20.2 ? "chair" : "end"; }
  let moodNow = null;
  function setMood(name) {
    if (moodNow === name) return; moodNow = name;
    const m = MOODS[name] || MOODS.office;
    scene.environment = officeEnv && name !== "hall" ? officeEnv : roomEnv;
    scene.environmentIntensity = officeEnv ? m.env : m.env * 0.5;
    renderer.toneMappingExposure = m.exposure;
    windows.forEach((l) => { l.intensity = m.windows; l.color.set(name === "chair" ? 0x5d74b8 : 0xd9e8ff); });
    ceil.intensity = m.ceil; hemi.intensity = m.hemi; sun.intensity = m.sun; sun.castShadow = m.sun > 0; lampSpot.intensity = m.lamp;
    // the sun follows the place so each one gets its own shadow frustum
    const at = name === "model" ? cKal : name === "hall" ? cHall : V(0, 0.3, -0.75);
    const span = name === "model" ? bKal.getSize(V()).length() * 0.6 : name === "hall" ? 9 : 4;
    sun.target.position.copy(at); sun.position.copy(at).add(name === "model" ? V(-span * 0.6, span * 1.2, span * 0.8) : cv([-1.2, -4.5, 3.6]).sub(cv([0, 0.3, 0.75])));
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: span * 4 + 14 });
    sun.shadow.camera.updateProjectionMatrix();
    casefile.root.visible = name === "office";
    kalinda.root.visible = name === "model";
    hall.root.visible = name === "hall";
    chair.root.visible = name === "chair";
    // the office itself is set per frame in render(): it sinks away while the case file lifts
    ground.style.background = name === "model" ? GROUND.model : name === "chair" ? GROUND.dusk : GROUND.warm;
  }

  // ---- washes between places: [peak time, colour, in (s), out (s)]
  const WASHES = [[9.0, "#15142a", 0.22, 0.4], [13.0, "#f4f3ee", 0.22, 0.4], [16.5, "#12111a", 0.22, 0.4], [20.2, "#f4f3ee", 0.4, 0]];

  // ---- the globe: [t, x, y, size(px), level]
  const globe = new GlobeStill(globeCanvas);
  const GK = [[2.4, 960, 210, 190, 0.2], [4.3, 960, 210, 190, 0.45], [5.0, 960, 984, 76, 0.25], [20.2, 960, 984, 76, 0.25], [21.0, 960, 330, 170, 0.4], [24, 960, 330, 170, 0.35]];
  function globeAt(t) {
    let i = 0; while (i < GK.length - 2 && t >= GK[i + 1][0]) i++;
    const a = GK[i], b = GK[i + 1], k = E.inOut3(prog(t, a[0], b[0]));
    return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k), s: lerp(a[3], b[3], k), level: lerp(a[4], b[4], k) };
  }

  function render(t) {
    // place, mood
    const p = place(t); setMood(p === "end" ? "office" : p);
    // the office rises into the hook
    const sink = -4.0 * E.in2(prog(t, 4.35, 4.95));
    office.root.position.y = -1.2 * (1 - E.out3(prog(t, 2.7, 3.9))) + sink;
    office.root.visible = p === "office" && t < 4.95;
    casefile.root.position.y = 0.776 + (t < 4.35 ? office.root.position.y : 0) + LIFT * E.inOut3(prog(t, 4.45, 5.4));
    // case file: cover opens 5.7-6.9 s over the authored open range (0-78 frames at 24 fps)
    if (cfAct) { cfAct.time = (78 / 24) * E.sine(prog(t, 5.7, 6.9)); casefile.mixer.update(0); }
    sheet.position.copy(sheetHome); sheet.position.x += sheetW * 1.06 * E.inOut3(prog(t, 6.95, 7.5)); sheet.position.y += 0.002;
    paintPage(E.out3(prog(t, 7.55, 7.9)));
    // Kalinda loops run on the clock; the Coup outcome plays 3.3x from 9.6 s
    for (const a of kalLoops) a.time = (t * 0.9) % a.getClip().duration;
    for (const a of kalSim) a.time = Math.min(a.getClip().duration, Math.max(0, (t - 9.6) * 3.3));
    kalinda.mixer.update(0);
    edgeMat.uniforms.uTime.value = t;
    // the recorder's light
    if (rec) rec.visible = t >= 18.0;
    recGlow.intensity = t >= 18.0 && p === "chair" ? 0.3 * E.out3(prog(t, 18.0, 18.15)) : 0;
    // camera
    const c = camAt(t);
    camera.position.copy(c.pos); camera.lookAt(c.target);
    camera.setViewOffset(W, H, c.ox, c.oy, W, H);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    // the pin on the hall table
    const pk = prog(t, 14.4, 14.75);
    if (p === "hall" && pk > 0) {
      const v = tableTop.clone().project(camera), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      pin.style.opacity = String(E.out3(pk) * (1 - prog(t, 16.15, 16.35)));
      pin.style.transform = `translate(${x}px, ${y - 40 * (1 - E.out3(pk))}px)`;
      pin.style.setProperty("--ring", String(((t - 14.75) % 1.2 + 1.2) % 1.2 / 1.2 * (t > 14.75 ? 1 : 0)));
    } else pin.style.opacity = "0";
    // wash
    let wa = 0, wc = "#f4f3ee";
    for (const [pk2, col, i, o] of WASHES) {
      const a = t <= pk2 ? E.in2(prog(t, pk2 - i, pk2)) : o > 0 ? 1 - E.out3(prog(t, pk2, pk2 + o)) : 1;
      if (a > wa) { wa = a; wc = col; }
    }
    wash.style.background = wc; wash.style.opacity = String(wa);
    // globe
    const g = globeAt(t), talk = t > 2.95 && t < 4.3 ? speech(t * 1.2) * 0.6 : 0;
    globeCanvas.style.transform = `translate(${g.x - 300}px, ${g.y - 300}px) scale(${g.s / 600})`;
    globe.draw({ clock: t * 1.3, level: Math.min(1, g.level + talk), pace: g.level, intro: E.out3(prog(t, 2.45, 3.4)) });
  }
  return { render };
}
