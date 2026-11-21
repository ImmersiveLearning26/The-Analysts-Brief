// First-person 3D world. Rendering follows the investigation viewer's recipe: image-based light from an HDR baked
// inside the Evidence Room (the office is that room, turned -90°), AgX tone mapping, soft shadows, ambient occlusion,
// gentle bloom, and a grade pass that adds contrast and a vignette. When the case file is held, the room behind it is
// blurred and darkened and the file is drawn sharp on top (see inspector.js).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { cutaway, spatialControls, thickenWalls, contactShadow, visibleBounds } from "./spatial.js";
import { Inspector } from "./inspector.js";
import { PageTextures } from "./pages.js";

const cv = (v) => new THREE.Vector3(v[0], v[2], -v[1]); // Blender (x,y,z) -> three (x,z,-y), once.

// Per place: environment strength, exposure, live lights, and the grade (contrast around mid-grey, saturation,
// vignette). Contrast is applied in linear light before tone mapping, so it deepens shadows without crushing.
const MOODS = {
  // Studio look (design v3 §7): warm key against a cool fill, a little more contrast, the desk lamp as a practical.
  office: { env: .8, exposure: 1.05, windows: .45, ceil: .55, hemi: .5, sun: 2.5, lamp: 1.4, bg: 0xf4f3ee, contrast: 1.08, sat: 1.02, vig: 0, tint: [1, 1, 1] },
  model:  { env: .8, exposure: 1.05, windows: .45, ceil: .55, hemi: .5, sun: 2.5, lamp: 0, bg: 0xf4f3ee, contrast: 1.08, sat: 1.02, vig: 0, tint: [1, 1, 1] },
  // the hall carries baked lighting: less added light so the walls do not blow out
  hall:   { env: .38, exposure: .98, windows: .3, ceil: .3, hemi: .3, sun: 1.1, lamp: 0, bg: 0xf4f3ee, contrast: 1.1, sat: 1.04, vig: 0, tint: [1, .99, .97] },
  // Thursday evening: dusk outside, the desk lamp as the key light, cool window spill
  chair:  { env: .32, exposure: 1.0, windows: 1.1, ceil: .16, hemi: .24, sun: 0, lamp: 3.4, bg: 0x12111a, contrast: 1.12, sat: 1.0, vig: 0, tint: [1, .97, .93] },
};

const EDGE_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const EDGE_FRAG = /* glsl */ `
  uniform float uTime; uniform float uBoost; uniform vec3 uColor; varying vec2 vUv;
  void main(){
    float b = fract((vUv.x + uTime / 10.0) * 28.0);
    float band = smoothstep(0.0, 0.12, b) * (1.0 - smoothstep(0.12, 0.35, b));
    float lift = mix(0.55, 1.0, vUv.y) * (1.0 - smoothstep(0.80, 0.86, vUv.y)) + smoothstep(0.92, 1.0, vUv.y);
    float a = clamp((0.12 + band) * lift, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.6 + 1.6 * band) * (0.7 + uBoost), a * 0.75 * uBoost);
  }`;

const QUAD_VERT = "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
const BlurShader = {
  uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, radius: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: QUAD_VERT,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir, res; uniform float radius; varying vec2 vUv;
    void main(){ vec2 st = dir * radius / res; vec4 c = texture2D(tDiffuse, vUv) * 0.1964825501511404;
      c += (texture2D(tDiffuse, vUv + st*1.411764705882353) + texture2D(tDiffuse, vUv - st*1.411764705882353)) * 0.2969069646728344;
      c += (texture2D(tDiffuse, vUv + st*3.2941176470588234) + texture2D(tDiffuse, vUv - st*3.2941176470588234)) * 0.09447039785044732;
      c += (texture2D(tDiffuse, vUv + st*5.176470588235294) + texture2D(tDiffuse, vUv - st*5.176470588235294)) * 0.010381362401148057;
      gl_FragColor = c; }`,
};
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, contrast: { value: 1 }, sat: { value: 1 }, vig: { value: 0.35 },
    tint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: QUAD_VERT,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amt, contrast, sat, vig; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec3 x = max(c.rgb, 0.0) * tint;
      x = 0.18 * pow(x / 0.18, vec3(contrast));                       // contrast around mid-grey, in linear light
      float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
      x = max(mix(vec3(l), x, sat), 0.0);
      x = mix(x, mix(vec3(l), x, 0.9) * 0.95, amt);                    // held object: desaturate + darken the room
      float v = smoothstep(0.95, 0.25, distance(vUv, vec2(0.5)));
      x *= mix(1.0, mix(0.72, 1.0, v), clamp(vig, 0.0, 1.0));
      gl_FragColor = vec4(x, c.a); }`,
};

export function createWorld({ canvas, layout, onHotspot, onInspect, onError = console.warn, onProgress }) {
  // Transparent canvas: the stage colour comes from the page (CSS), so tone mapping cannot grey it.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const DPR_MAX = Math.min(devicePixelRatio, 1.5);
  let DPR = Math.min(DPR_MAX, 1.25);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const dirtyShadows = () => { renderer.shadowMap.needsUpdate = true; };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.02, 300);
  camera.filmGauge = 36;
  const spatial = spatialControls(camera, canvas);
  let poseName = "CAM_OfficeEntry";
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  let officeEnv = null;
  scene.environment = roomEnv;
  scene.environmentRotation.set(0, -Math.PI / 2, 0);   // the office is the Evidence Room turned -90° about Z

  // ---- lights (glTF cannot carry Blender area lights; rebuilt here, as in the viewer)
  RectAreaLightUniformsLib.init();
  const windows = [1.54, -1.55].map((x) => {
    const l = new THREE.RectAreaLight(0xd9e8ff, 1, 1.6, 1.9);
    l.position.copy(cv([x, -2.65, 1.85])); l.lookAt(cv([x, 0, 1.6])); scene.add(l); return l;
  });
  const ceil = new THREE.PointLight(0xfff3e4, 1, 7, 1.6); ceil.position.copy(cv([0, 0.9, 2.7])); scene.add(ceil);
  const hemi = new THREE.HemisphereLight(0xd6e2ff, 0x4a3524, 0.22);   // cool sky fill, warm bounce scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c8, 0.8);             // daylight through the windows behind the learner
  sun.position.copy(cv([-1.2, -4.5, 3.6])); sun.target.position.copy(cv([0, 0.3, 0.75]));
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14 });
  scene.add(sun, sun.target);
  const lampSpot = new THREE.SpotLight(0xffb46b, 0, 3.2, Math.PI / 3.2, 0.6, 1.5);   // Chair office desk lamp
  lampSpot.position.copy(cv([0.74, 0.26, 1.19])); lampSpot.target.position.copy(cv([0.15, -0.05, 0.77]));
  lampSpot.castShadow = true; lampSpot.shadow.mapSize.set(1024, 1024); lampSpot.shadow.bias = -0.0006;
  scene.add(lampSpot, lampSpot.target);

  // ---- post-processing (viewer recipe)
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.0, scale: 1.0 });
  gtao.blendIntensity = 0.9;
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.6, 0.92);
  bloom.enabled = true; bloom.strength = .2; bloom.radius = .45; bloom.threshold = .96; composer.addPass(bloom);   // only practicals glow
  const blurs = [[1, 0], [0, 1], [1, 0], [0, 1]].map(([x, y]) => {
    const p = new ShaderPass(BlurShader); p.uniforms.dir.value.set(x, y); p.enabled = false; composer.addPass(p); return p;
  });
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const clock = new THREE.Clock();
  const assets = {};
  const loops = [];
  let edgeMat = null, tween = null, paused = false, reduced = false, mood = "office", extBlur = 0;

  new HDRLoader().load("/models/office_env.hdr", (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    officeEnv = pmrem.fromEquirectangular(hdr).texture; hdr.dispose();
    setMood(mood);
  }, undefined, () => console.warn("office HDR not found; using the generic room environment"));

  // ---- inspector + the case file
  const pageTex = new PageTextures(renderer);
  let caseRoot = null, caseAction = null, caseState = "closed", segEnd = null, segTarget = null, closeAfterOpen = false;
  const inspector = new Inspector({ camera, environment: roomEnv, hooks: {
    open: () => { if (caseState === "closed") toggleCase(); else if (caseState === "moving" && segTarget === "closed") closeAfterOpen = false; },
    close: () => { if (caseState === "open") toggleCase(); else if (caseState === "moving" && segTarget === "open") closeAfterOpen = true; },
    change: () => { dirtyShadows(); onInspect?.({ state: inspector.state, page: inspector.pageIdx }); },
  } });
  function toggleCase() {
    if (!caseAction || segEnd !== null) return;
    const u = caseRoot.userData, fps = u.sim_anim_fps || 24;
    const [o0, o1] = u.sim_anim_open_frames || [0, 78], [c0, c1] = u.sim_anim_close_frames || [92, 168];
    if (caseState === "closed") { caseAction.time = o0 / fps; segEnd = o1 / fps; segTarget = "open"; }
    else { caseAction.time = c0 / fps; segEnd = c1 / fps; segTarget = "closed"; }
    caseState = "moving"; caseAction.paused = false;
    if (reduced) { caseAction.time = segEnd; }
  }
  function stepCase(dt) {
    if (!caseAction) return;
    assets.casefile.mixer.update(caseAction.paused ? 0 : dt * (segTarget === "closed" ? 14 : 8));   // close faster than open
    if (segEnd !== null && caseAction.time >= segEnd) {
      caseAction.time = segEnd; caseAction.paused = true; assets.casefile.mixer.update(0); caseState = segTarget; segEnd = null;
      if (closeAfterOpen && caseState === "open") { closeAfterOpen = false; toggleCase(); }
      dirtyShadows();
    }
  }
  function prepareCaseFile() {
    caseRoot = node("casefile", "CASEFILE_Root");
    if (!caseRoot) return;
    caseRoot.rotation.y = 0;                       // spine away from the learner; the flap opens to the left
    const clip = assets.casefile.clips.find((c) => c.name === (caseRoot.userData.sim_anim_clip || "CaseFile_OpenClose"));
    if (clip) {
      caseAction = assets.casefile.mixer.clipAction(clip);
      caseAction.setLoop(THREE.LoopOnce, 1); caseAction.clampWhenFinished = true; caseAction.play(); caseAction.paused = true; caseAction.time = 0;
      assets.casefile.mixer.update(0);
    }
    caseRoot.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      // Paper skips tone mapping so white stays white and ink stays dark (AgX otherwise greys both toward the middle).
      if (/^CF_Page_\d+/.test(o.name)) { o.material = o.material.clone(); o.material.color.set(0xffffff); o.material.roughness = 0.82; o.material.toneMapped = false; }
      // The remaining pile reads as plain paper, a step quieter than the sheet being read.
      if (/^CF_PaperStack_Edges/.test(o.name)) { o.material = o.material.clone(); o.material.toneMapped = false; o.material.color.set(0xefebe2); }
    });
  }
  // The source model's fanned page edges look crooked beside the straight extracted sheet. Hide them only while the
  // file is held, so the closed folder on the desk keeps its thickness.
  let fanHidden = false;
  function setFan(hidden) {
    if (!caseRoot || fanHidden === hidden) return;
    fanHidden = hidden;
    caseRoot.traverse((o) => { if (/^CF_PageEdge_/.test(o.name)) o.visible = !hidden; });
  }
  /** Paint the pages: `pageInfo(i)` returns { e, tag, note }. Only pages near `focus` get their text. */
  function paintPages(pageInfo, total, focus) {
    if (!caseRoot) return;
    caseRoot.traverse((o) => {
      const m = /^CF_Page_(\d+)/.exec(o.name); if (!m) return;
      const i = +m[1] - 1, info = pageInfo(i); if (!info) return;
      const t = pageTex.get(i, info.e, total, info.tag, info.note, focus);
      // the page's own texture also lights it a little, so paper reads as white paper under AgX, like a document viewer
      if (o.material.map !== t) { o.material.map = t; o.material.emissiveMap = t; o.material.emissive.setScalar(0.32); o.material.needsUpdate = true; }
    });
  }
  function inspectCase(startPage = 0) {
    if (!caseRoot || inspector.active) return false;
    inspector.stage.environment = scene.environment;
    const entered = inspector.enter(caseRoot, { startPage });   // measures the folder with its edges, then hide them
    if (entered) setFan(true);
    return entered;
  }

  // ---- blinking dots (v3.2, after React Bits "Blinking Dots": a jittered field in parallax depth layers, size-driven
  // colour ramp, soft glow falloff, gentle twinkle, slow drift, slight cursor parallax), placed in 3D around the model.
  const DOT_N = 760;
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(DOT_N * 3), 3));
  const rnd = (a, b) => a + Math.random() * (b - a);
  dotGeo.setAttribute("aPhase", new THREE.Float32BufferAttribute(Float32Array.from({ length: DOT_N }, () => rnd(0, 6.283)), 1));
  dotGeo.setAttribute("aSpeed", new THREE.Float32BufferAttribute(Float32Array.from({ length: DOT_N }, () => rnd(.5, 1.5)), 1));
  dotGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(Float32Array.from({ length: DOT_N }, () => Math.pow(Math.random(), 2.2)), 1));   // mostly small, a few large
  dotGeo.setAttribute("aLayer", new THREE.Float32BufferAttribute(Float32Array.from({ length: DOT_N }, (_, k) => k % 3 === 0 ? 1 : 0), 1));      // 1 = far layer
  const dotMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uFrom: { value: new THREE.Color(0x8c7d6a) }, uTo: { value: new THREE.Color(0xb88a52) },
      uOpacity: { value: .6 }, uTwinkle: { value: .4 }, uLayerFade: { value: .5 } },
    vertexShader: `attribute float aPhase; attribute float aSpeed; attribute float aSize; attribute float aLayer;
      uniform float uTime; uniform float uPx; uniform float uTwinkle; uniform float uLayerFade; varying float vB; varying float vS;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * aSpeed * 1.6 + aPhase);
        vB = (1.0 - uTwinkle * tw) * mix(1.0, uLayerFade, aLayer); vS = aSize;
        gl_PointSize = (1.6 + aSize * 4.2) * uPx * mix(1.0, 0.7, aLayer); }`,
    fragmentShader: `uniform vec3 uFrom; uniform vec3 uTo; uniform float uOpacity; varying float vB; varying float vS;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        float glow = pow(1.0 - d, 2.0);
        gl_FragColor = vec4(mix(uFrom, uTo, vS), glow * vB * uOpacity); }` });
  const dots = new THREE.Points(dotGeo, dotMat); dots.name = "SPATIAL_BlinkingDots"; dots.frustumCulled = false; dots.raycast = () => {};
  const dotRig = new THREE.Group(); dotRig.add(dots); scene.add(dotRig);
  const DOT_THEME = { light: [0x8c7d6a, 0xb88a52, .55, false], model: [0x8f7bff, 0xffffff, .85, true], chair: [0xb8743a, 0xffe2b8, .8, true] };
  function placeDots(root, theme) {
    if (!root) { dotRig.visible = false; return; }
    const b = visibleBounds(root); if (b.isEmpty()) return;
    const sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), pos = dotGeo.attributes.position, layer = dotGeo.attributes.aLayer;
    const span = Math.max(sz.x, sz.z), g = Math.ceil(Math.sqrt(DOT_N));            // stratified jittered grid in plan, two depth layers
    for (let i = 0; i < DOT_N; i++) {
      const far = layer.getX(i) > .5, reach = far ? 1.25 : .85, cx = (i % g + .5 + rnd(-.3, .3)) / g, cz = (Math.floor(i / g) + .5 + rnd(-.3, .3)) / g;
      pos.setXYZ(i, c.x + (cx - .5) * span * 2 * reach, b.min.y + rnd(-.1, 1.1) * (sz.y + span * .35) * (far ? 1.2 : 1), c.z + (cz - .5) * span * 2 * reach);
    }
    pos.needsUpdate = true; dotRig.visible = true; dotRig.position.copy(c); dots.position.copy(c).negate();
    const t = DOT_THEME[theme] || DOT_THEME.light;
    dotMat.uniforms.uFrom.value.set(t[0]); dotMat.uniforms.uTo.value.set(t[1]); dotMat.uniforms.uOpacity.value = t[2];
    dotMat.blending = t[3] ? THREE.AdditiveBlending : THREE.NormalBlending; dotMat.needsUpdate = true;
  }
  const dotPointer = new THREE.Vector2();
  addEventListener("pointermove", (e) => { dotPointer.set(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5); });

  // ---- the cover: the camera swings slowly around the office so each side is seen (stops on any other page)
  let swing = null;
  function titleSwing(on) {
    if (!on) { swing = null; return; }
    const c = spatial.controls.target.clone(), sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(c));
    swing = { c, r: sph.radius, phi: sph.phi, th: sph.theta, t: 0 };
  }

  // ---- loading
  async function load(name, url, place) {
    try {
      const g = await loader.loadAsync(url, (e) => onProgress?.(name, e.loaded, e.total));
      const root = g.scene; root.name = "ASSET_" + name;
      if (place) root.position.copy(place);
      root.traverse((o) => { if (o.isMesh && name !== "kalinda") { o.castShadow = true; o.receiveShadow = true; } });
      // the office's sand plaster normal map reads as stains under the studio key light: clean matte plaster, set before
      // cutaway() so the cut shader is attached to the material actually used
      if (name === "office") root.traverse((o) => { if (o.isMesh && o.material?.name === "MAT_Wall_Sand") { const m = o.material.clone(); m.normalMap = null; m.color.set(0xe3d5c0); m.roughness = .95; o.material = m; } });
      scene.add(root); cutaway(root, name);
      if (name === "office") {
        thickenWalls(root);
      }
      if (["office", "kalinda", "hall"].includes(name)) contactShadow(root, name === "kalinda" ? .5 : name === "hall" ? .42 : .38);
      const mixer = new THREE.AnimationMixer(root);
      assets[name] = { root, mixer, clips: g.animations };
      if (name === "casefile") prepareCaseFile();
      if (name === "hall") root.traverse((o) => { if (o.isMesh && /^MAT_Hall_Paint/.test(o.material?.name)) o.material.emissiveIntensity = 0.25; });
      dirtyShadows();
      return assets[name];
    } catch (error) {
      onError({ name, url, error });
      return null;
    }
  }
  function node(asset, name) { return assets[asset]?.root.getObjectByName(name) || null; }

  // ---- highlight: a warm glow on the object being pointed at (materials are swapped, never edited in place,
  // because the source GLBs share materials between objects)
  let lit = null;
  const GLOW = new THREE.Color(0xffb866);
  function highlight(obj) {
    if (lit === obj) return;
    if (lit) lit.traverse((o) => { if (o.isMesh && o.userData._mat) { o.material = o.userData._mat; delete o.userData._mat; } });
    lit = obj || null;
    lit?.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.userData._mat = o.material;
      const wrap = (m) => { const c = m.clone(); if (c.emissive) { c.emissive = GLOW.clone(); c.emissiveIntensity = .35; } return c; };
      o.material = Array.isArray(o.material) ? o.material.map(wrap) : wrap(o.material);
    });
    dirtyShadows();
  }

  // ---- cameras (named first-person poses)
  function pose(name, duration = 800) {
    poseName = name;
    tween?.resolve?.();
    const key = name === "CAM_Model" ? "kalinda" : name === "CAM_Hall" ? "hall" : "office";
    const fitted = spatial.fit(assets[key]?.root, frameRect, key === "hall" ? 1.3 : key === "kalinda" ? 1.35 : 1);   // thin T hall and the flat map with a tall mast fill little of their boxes
    const to=fitted.position, tmp=camera.clone(); tmp.position.copy(to); tmp.lookAt(fitted.center); tmp.fov=28; tmp.updateProjectionMatrix();
    if (!duration || reduced) {
      camera.position.copy(to); camera.quaternion.copy(tmp.quaternion); camera.fov=28; camera.updateProjectionMatrix(); tween=null;
      return Promise.resolve();
    }
    return new Promise(resolve => { tween={from:camera.position.clone(),to,q0:camera.quaternion.clone(),q1:tmp.quaternion.clone(),
      f0:camera.getFocalLength(), f1:tmp.getFocalLength(),duration:Math.min(duration,1000),elapsed:0,resolve}; });
  }
  function view(action) {
    if (inspector.active) return;
    if (action === "reset") return pose(poseName, 360);
    const v=camera.position.clone().sub(spatial.controls.target);
    const spherical=new THREE.Spherical().setFromVector3(v);
    if(action === "in" || action === "out") {
      const c=spatial.controls;
      spherical.radius=THREE.MathUtils.clamp(spherical.radius*(action === "in" ? .85 : 1/.85),c.minDistance,c.maxDistance);
    }
    else if(action === "top") { spherical.phi=THREE.MathUtils.degToRad(4); spherical.theta=Math.PI/4; }      // true top view
    else if(action === "front") { spherical.phi=THREE.MathUtils.degToRad(72); spherical.theta=Math.PI/4; }   // low, square-on
    else if(action === "iso") return pose(poseName, 600);
    else spherical.theta=THREE.MathUtils.clamp(spherical.theta+(action === "left" ? -.15 : .15),.35,1.22);
    const to=spatial.controls.target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
    const tmp=camera.clone(); tmp.position.copy(to); tmp.lookAt(spatial.controls.target);
    if(reduced) { camera.position.copy(to); camera.quaternion.copy(tmp.quaternion); return; }
    // Short eased move from wherever the camera is now, so repeated presses retarget instead of queueing.
    tween?.resolve?.();
    const f=camera.getFocalLength();
    tween={from:camera.position.clone(),to,q0:camera.quaternion.clone(),q1:tmp.quaternion,f0:f,f1:f,duration:action === "in" || action === "out" ? 240 : 650,elapsed:0};
  }

  /** Glide to an object (Fuselab-style focus): same viewing direction, closer, aimed at the object. */
  function focusOn(obj, { closer = .5, duration = 950 } = {}) {
    if (!obj || inspector.active) return Promise.resolve();
    const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) return Promise.resolve();
    const target = b.getCenter(new THREE.Vector3());
    const dir = camera.position.clone().sub(spatial.controls.target);
    const dist = Math.max(dir.length() * closer, spatial.controls.minDistance * .5);
    const to = target.clone().add(dir.normalize().multiplyScalar(dist));
    const tmp = camera.clone(); tmp.position.copy(to); tmp.lookAt(target);
    tween?.resolve?.();
    const f = camera.getFocalLength();
    if (reduced) { camera.position.copy(to); camera.quaternion.copy(tmp.quaternion); spatial.controls.target.copy(target); return Promise.resolve(); }
    return new Promise((resolve) => { tween = { from: camera.position.clone(), to, q0: camera.quaternion.clone(), q1: tmp.quaternion, f0: f, f1: f, duration, elapsed: 0,
      resolve: () => { spatial.controls.target.copy(target); resolve(); } }; });
  }
  const home = (duration = 900) => pose(poseName, duration);

  let lastW = 0, lastH = 0;
  function resize() {
    const w = innerWidth, h = innerHeight;
    if (w === lastW && h === lastH && renderer.getPixelRatio() === DPR) return;
    lastW = w; lastH = h;
    renderer.setPixelRatio(DPR); renderer.setSize(w, h, false);
    composer.setPixelRatio(DPR); composer.setSize(w, h);
    gtao.setSize(w * DPR, h * DPR); bloom.setSize(w * DPR, h * DPR);
    for (const p of blurs) p.uniforms.res.value.set(w * DPR, h * DPR);
    const f = camera.getFocalLength();
    camera.aspect = w / h; camera.setFocalLength(f); camera.updateProjectionMatrix();
    if (!inspector.active) pose(poseName, 0);
  }

  // ---- clips (map loops)
  function startLoops(asset) {
    const a = assets[asset]; if (!a) return;
    for (const c of a.clips) {
      if (/^KAL_Sim_/.test(c.name)) continue;          // outcome clips are driven by simShow(), never looped
      const act = a.mixer.clipAction(c); act.setLoop(THREE.LoopRepeat, Infinity); act.play(); loops.push(act);
    }
    prepareSim(a);
  }
  function prepareKalinda() {
    const wall = node("kalinda", "KAL_EdgeWall");
    if (wall) {
      edgeMat = new THREE.ShaderMaterial({ vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, transparent: true,
        depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uBoost: { value: .45 }, uColor: { value: new THREE.Color(0xf28c38) } } });
      wall.traverse((o) => { if (o.isMesh) o.material = edgeMat; });
    }
    // v3.1: the Blender-authored loops (edge pulses, mast rings, network packets) play in the model chapter so the
    // map reads as a live simulation. They are decoration only; results come from the rule engine.
    if (wall) wall.visible = true;
    startLoops("kalinda"); simulate("calm");
  }
  // ---- outcome animation authored in Blender (build_kalinda_sim.py): clips KAL_Sim_<Outcome>__<object>, 10 s each,
  // 2 s per simulated year. Every clip sits paused; time 0 is the untouched map. simShow() puts one outcome at a time
  // (optionally gliding there), every other outcome stays at time 0. Decoration of the engine's result only.
  const sim = { groups: {}, cur: null, t: 0, from: 0, to: 0, el: 0, dur: 0 };
  function prepareSim(a) {
    for (const c of a.clips) {
      const m = /^KAL_Sim_(\w+?)__/.exec(c.name); if (!m) continue;
      const act = a.mixer.clipAction(c); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); act.paused = true; act.time = 0;
      (sim.groups[m[1]] ||= []).push(act);
    }
    a.mixer.update(0);
  }
  const SIM_KEY = { Coup: "Coup", "Personalised rule": "Rule", Consolidation: "Consolidation" };
  function applySim() {
    for (const [k, acts] of Object.entries(sim.groups)) for (const act of acts) act.time = k === sim.cur ? Math.min(sim.t, act.getClip().duration) : 0;
    assets.kalinda?.mixer.update(0);
  }
  /** Show an outcome at simulated time t (seconds, 2 s per year). ms > 0 glides there; null outcome = untouched map. */
  function simShow(outcome, t = 0, ms = 0) {
    const key = outcome ? SIM_KEY[outcome] || outcome : null;
    if (key !== sim.cur) { sim.cur = key; sim.t = 0; }
    if (!key) { applySim(); return; }
    if (!ms || reduced) { sim.t = t; sim.dur = 0; applySim(); return; }
    sim.from = sim.t; sim.to = t; sim.el = 0; sim.dur = ms;
  }
  function stepSim(dt) {
    if (!sim.dur) return;
    sim.el += dt * 1000; const p = Math.min(1, sim.el / sim.dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    sim.t = sim.from + (sim.to - sim.from) * (sim.dur > 2000 ? p : e);     // the long run plays at an even pace
    applySim(); if (p >= 1) sim.dur = 0;
  }
  let simBoost = .45, simBoostT = .45;
  /** "calm" while the learner works, "run" while a test runs (faster, brighter), then back to calm. */
  function simulate(level) {
    const k = level === "run" ? 2.2 : level === "calm" ? .7 : 0;
    if (assets.kalinda) assets.kalinda.mixer.timeScale = k;
    simBoostT = level === "run" ? 1.4 : .45;
  }
  /** A slow cinematic arc around the current target (degrees), easing in a little closer. */
  function orbit(deg, duration = 3000) {
    if (inspector.active || reduced) return Promise.resolve();
    const c = spatial.controls.target.clone(), sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(c));
    tween?.resolve?.();
    const f = camera.getFocalLength();
    return new Promise((resolve) => { tween = { arc: { c, r: sph.radius, phi: sph.phi, th0: sph.theta, th1: sph.theta + THREE.MathUtils.degToRad(deg) },
      from: camera.position.clone(), to: camera.position.clone(), q0: camera.quaternion.clone(), q1: camera.quaternion.clone(), f0: f, f1: f, duration, elapsed: 0, resolve }; });
  }
  function prepareChairProps() { const rec = node("chair", "CHAIR_RecIndicator"); if (rec) rec.visible = false; }
  function setRecording(on) { const rec = node("chair", "CHAIR_RecIndicator"); if (rec) rec.visible = !!on; }

  // ---- places and moods
  function setMood(name) {
    mood = name;
    const m = MOODS[name];
    scene.environment = officeEnv && name !== "hall" ? officeEnv : roomEnv;
    inspector.stage.environment = scene.environment;
    scene.environmentIntensity = officeEnv ? m.env : m.env * 0.5;
    renderer.toneMappingExposure = m.exposure;
    scene.background = null;   // m.bg is painted by the page behind the transparent canvas
    windows.forEach((l) => { l.intensity = m.windows; l.color.set(name === "chair" ? 0x5d74b8 : 0xd9e8ff); });
    ceil.intensity = m.ceil; ceil.position.copy(cv(name === "hall" ? [-0.4, 0, 2.6] : [0, 0.9, 2.7])); hemi.intensity = m.hemi; sun.intensity = m.sun; sun.castShadow = m.sun > 0;
    lampSpot.intensity = m.lamp;
    grade.uniforms.contrast.value = m.contrast; grade.uniforms.sat.value = m.sat; grade.uniforms.vig.value = m.vig;
    grade.uniforms.tint.value.set(...m.tint);
    const vis = (asset, v) => { if (assets[asset]) assets[asset].root.visible = v; };
    placeDots(assets[name === "model" ? "kalinda" : name === "hall" ? "hall" : "office"]?.root, name === "model" ? "model" : name === "chair" ? "chair" : "light");
    vis("office", name === "office" || name === "chair");
    vis("casefile", name === "office" || inspector.active);
    vis("kalinda", name === "model");
    vis("hall", name === "hall");
    vis("chair", name === "chair");
    for (const l of loops) l.paused = paused || reduced || name !== "model";
    dirtyShadows();
  }

  // ---- input: hotspots in the room; read/turn/zoom while the file is held
  const HOT = { CASEFILE_Root: "caseFile", KAL_Government: "institution:Government", KAL_Barracks: "institution:Barracks",
    KAL_Radio: "institution:Radio", KAL_Market: "institution:Market", HALL_PlanningTable: "hallTable" };
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const setRay = (x, y) => { pointer.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(pointer, camera); };
  let hoverFile = false;
  const mouse = { down: false, x: 0, y: 0, dragged: false, button: 0, shift: false };
  canvas.addEventListener("pointerdown", (e) => { Object.assign(mouse, { down: true, x: e.clientX, y: e.clientY, dragged: false, button: e.button, shift: e.shiftKey }); });
  canvas.addEventListener("pointermove", (e) => {
    if (!mouse.down) {
      if (!inspector.active) { setRay(e.clientX, e.clientY); canvas.style.cursor = hotAt() ? "pointer" : ""; }
      else {
        setRay(e.clientX, e.clientY);
        const over = !!inspector.pick(ray);
        canvas.style.cursor = over ? "pointer" : "zoom-out";
        if (over !== hoverFile) { hoverFile = over; onInspect?.({ hover: over }); }
      }
      return;
    }
    if (Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y) > 5) mouse.dragged = true;
    if (mouse.dragged && inspector.active) {
      if (mouse.button === 2 || mouse.shift) inspector.rotate(e.movementX, e.movementY); else inspector.panBy(-e.movementX, -e.movementY);
      canvas.style.cursor = "grabbing";
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    const wasDrag = mouse.dragged; mouse.down = false;
    if (wasDrag) return;
    setRay(e.clientX, e.clientY);
    if (inspector.active) {
      if (inspector.state !== "held") return;
      const h = inspector.pick(ray);
      onInspect?.({ click: h ? (inspector.side(h.point) || 1) : 0 });
      return;
    }
    const id = hotAt(); if (id) onHotspot?.(id);
  });
  canvas.addEventListener("pointercancel", () => { mouse.down=false; });
  canvas.addEventListener("contextmenu", (e) => { if (inspector.active) e.preventDefault(); });
  canvas.addEventListener("wheel", (e) => { if (inspector.active) { e.preventDefault(); inspector.wheel(e); } }, { passive: false });
  function hotAt() {
    const hits = ray.intersectObjects(scene.children, true).filter((h) => { for(let o=h.object;o;o=o.parent) if(!o.visible) return false; return true; });
    for (const h of hits.slice(0, 4)) {
      let o = h.object;
      while (o) { if (HOT[o.name]) return HOT[o.name]; o = o.parent; }
    }
    return null;
  }

  // ---- projection for HTML anchors
  const _v = new THREE.Vector3();
  function project(obj) {
    obj.getWorldPosition(_v).project(camera);
    return { x: ((_v.x + 1) * innerWidth) / 2, y: ((1 - _v.y) * innerHeight) / 2, visible: _v.z >= -1 && _v.z <= 1 };
  }

  /** Screen points on the open file's top page: its right edge (top, middle) and its bottom centre. */
  const _box = new THREE.Box3();
  function caseAnchor() {
    if (!inspector.pages || inspector.state === "idle") return null;
    const pg = inspector.pages[inspector.pageIdx]?.o; if (!pg) return null;
    _box.setFromBufferAttribute(pg.geometry.attributes.position);
    pg.updateWorldMatrix(true, false);
    const P = (x, z) => { _v.set(x, 0, z).applyMatrix4(pg.matrixWorld).project(camera); return { x: ((_v.x + 1) * innerWidth) / 2, y: ((1 - _v.y) * innerHeight) / 2 }; };
    const { min, max } = _box;
    return { top: P(max.x, min.z), mid: P(max.x, (min.z + max.z) / 2), bottom: P((min.x + max.x) / 2, max.z), left: P(min.x, (min.z + max.z) / 2) };
  }

  // ---- loop (adaptive quality as in the viewer: drop resolution, then ambient occlusion, when frames run slow)
  const perf = { ema: 16, slow: 0 };
  // ---- the preview frame: the rounded box the model lives in (set by the page layout), minus whatever the
  // conversation reserves at its bottom. The model is fitted to the frame, then zoomed/offset into the free region,
  // so the conversation never sits on it.
  let frameRect = { x: 0, y: 0, w: innerWidth, h: innerHeight, r: 0 }, reserve = { bottom: 0, left: 0, right: 0 };
  const frameView = { x: 0, y: 0, z: 1, init: false };
  function setFrame(rect) {
    frameRect = rect;
    const W = innerWidth, H = innerHeight;
    canvas.style.clipPath = `inset(${rect.y}px ${W - rect.x - rect.w}px ${H - rect.y - rect.h}px ${rect.x}px round ${rect.r}px)`;
    inspector.frac = { w: rect.w / W, h: rect.h / H };
    if (!inspector.active) pose(poseName, 0);
  }
  /** Space the page needs inside the frame (px): the conversation at the bottom, the title on the left. */
  function setReserve(r) { reserve = { bottom: Math.max(0, r.bottom || 0), left: Math.max(0, r.left || 0), right: Math.max(0, r.right || 0) }; }
  function adapt(dt) {
    if (document.hidden || dt >= 0.05) return;
    perf.ema += (dt * 1000 - perf.ema) * 0.05;
    perf.slow = perf.ema > 22 ? perf.slow + dt : 0;
    if (perf.slow > 1.2) { perf.slow = 0; if (DPR > 1) { DPR = 1; lastW = 0; } else if (gtao.enabled) gtao.enabled = false; }
  }
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    resize();
    {
      const W = innerWidth, H = innerHeight, f = frameRect;
      const insp = inspector.active;
      inspector.frameNdc = { cx: ((f.x + f.w / 2) / W) * 2 - 1, cy: 1 - ((f.y + f.h / 2) / H) * 2, w: f.w / W * 2, h: f.h / H * 2 };
      // the conversation may overlap the room's front corner (mostly empty floor), so only ~half its height is reserved
      const freeH = insp ? f.h : Math.max(f.h * .6, f.h - reserve.bottom * .5);
      const freeL = insp ? 0 : Math.min(f.w * .55, reserve.left), freeR = insp ? 0 : Math.min(f.w * .45, reserve.right || 0);
      const freeW = f.w - freeL - freeR;
      const tz = insp ? 1 : Math.min(1, freeH / f.h, freeW / f.w * (freeL ? 1.5 : 1.3));   // the cover's office may run under the title's margin
      const tx = W / 2 - (f.x + freeL + freeW / 2), ty = H / 2 - (f.y + freeH / 2);
      const k = reduced || !frameView.init ? 1 : 1 - Math.exp(-dt * 9);      // ~350ms settle, eased, interruptible
      frameView.x += (tx - frameView.x) * k; frameView.y += (ty - frameView.y) * k; frameView.z += (tz - frameView.z) * k; frameView.init = true;
      camera.zoom = frameView.z;
      camera.setViewOffset(W, H, frameView.x, frameView.y, W, H);
    }
    spatial.controls.enabled = !paused && !inspector.active && !tween && !document.body.classList.contains("talking") && !document.querySelector("#drawer")?.open;
    if (!paused) {
      for (const [k, a] of Object.entries(assets)) if (k !== "casefile") a.mixer.update(dt);
      stepSim(dt);
      stepCase(dt);
      if (!reduced) { dotMat.uniforms.uTime.value += dt; dotRig.rotation.y += dt * .012; }   // slow drift
      dotMat.uniforms.uPx.value = DPR;
      dotRig.rotation.x += (dotPointer.y * .05 - dotRig.rotation.x) * (1 - Math.exp(-dt * 3));      // gentle cursor parallax
      dotRig.rotation.z += (-dotPointer.x * .05 - dotRig.rotation.z) * (1 - Math.exp(-dt * 3));
      if (swing && !tween && !mouse.down && !inspector.active) {      // ±50° around the office over ~26 s
        swing.t += dt; const a = swing.th + THREE.MathUtils.degToRad(50) * Math.sin(swing.t * Math.PI * 2 / 26);
        camera.position.setFromSphericalCoords(swing.r, swing.phi, a).add(swing.c); camera.lookAt(swing.c);
      }
      if (edgeMat && !reduced) { edgeMat.uniforms.uTime.value += dt * (simBoostT > 1 ? 2.4 : 1); simBoost += (simBoostT - simBoost) * (1 - Math.exp(-dt * 3)); edgeMat.uniforms.uBoost.value = simBoost; }
      if (tween) {
        tween.elapsed += dt * 1000;
        const p = Math.min(1, tween.elapsed / tween.duration), t = p * p * (3 - 2 * p);
        if (tween.arc) {          // travel on the sphere, not the chord, so the model turns rather than swings
          const a = tween.arc; camera.position.setFromSphericalCoords(a.r * (1 - .1 * t), a.phi - .06 * t, a.th0 + (a.th1 - a.th0) * t).add(a.c); camera.lookAt(a.c);
        } else {
          camera.position.lerpVectors(tween.from, tween.to, t);
          camera.quaternion.slerpQuaternions(tween.q0, tween.q1, t);
        }
        camera.setFocalLength(tween.f0 + (tween.f1 - tween.f0) * t);
        if (p === 1) { const r = tween.resolve; tween = null; r?.(); }
      }
      camera.updateMatrixWorld();
      inspector.update(dt);
      if (fanHidden && !inspector.active) setFan(false);
      if (caseAction && !caseAction.paused) dirtyShadows();
    }
    const b = Math.max(inspector.blur, extBlur);
    blurs.forEach((p, i) => { p.enabled = b > 0.002; p.uniforms.radius.value = b * (i < 2 ? 2.2 : 3.2); });
    grade.uniforms.amt.value = b;
    composer.render(dt);
    if (inspector.node) {
      renderer.autoClear = false; renderer.clearDepth();
      renderer.render(inspector.stage, camera);
      renderer.autoClear = true;
    }
    adapt(dt);
  }
  renderer.setAnimationLoop(frame);
  pose("CAM_OfficeEntry", 0);
  setMood("office");

  function setPaused(v) { paused = v; for (const l of loops) l.paused = v || reduced || mood !== "model"; }
  function setReduced(v) { reduced = v; inspector.reduced = v; for (const l of loops) l.paused = paused || v || mood !== "model"; }
  function setBlur(v) { extBlur = v; }

  function dispose() {
    renderer.setAnimationLoop(null);
    scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    composer.dispose(); renderer.dispose(); pmrem.dispose(); draco.dispose();
  }

  return { THREE, scene, camera, renderer, assets, inspector, cv, load, node, pose, setMood, setRecording, project,
    prepareKalinda, prepareChairProps, setPaused, setReduced, setBlur, inspectCase, paintPages, caseAnchor, dispose,
    view, setFrame, setReserve, highlight, focusOn, home, simulate, orbit, simShow, titleSwing,
    get caseState() { return caseState; } };
}
