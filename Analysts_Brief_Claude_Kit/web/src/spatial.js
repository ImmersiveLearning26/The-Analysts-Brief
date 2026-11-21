// Runtime adaptation of the supplied room assets. No GLB is rewritten.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function visibleBounds(root) {
  const box = new THREE.Box3();
  root?.updateWorldMatrix(true, true);
  root?.traverse(o => {
    if (!o.isMesh || o.name === "SPATIAL_ContactShadow") return;   // the soft shadow is wider than the model
    for (let a=o; a; a=a.parent) if (!a.visible) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return box;
}

export function cutaway(root, kind) {
  if (!["office", "hall"].includes(kind)) return;
  // Exterior backdrop cards and scenery existed for the old first-person window views. In a cutaway they float
  // outside the room and skew the framing bounds, so hide them before anything is measured.
  root.traverse(o => { if (/^ENV_|Exterior|HALL_Outside|HALL_Sky/i.test(o.name)) o.visible=false; });
  const box = visibleBounds(root), size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  // Existing assets combine walls. Cut just the front two architectural edges at runtime.
  // A production Blender pass should replace this with authored, capped wall meshes.
  root.traverse(o => {
    if (/Ceiling|CeilingFixtures|HALL_Block_Lamps|HALL_Lamp/i.test(o.name)) o.visible=false;
    if (kind === "hall" && /HALL_Painting|HALL_Misc/.test(o.name)) o.visible=false;   // would float above the section cut
    if (!o.isMesh || !/ARCH_|HALL_Block|HALL_Door|HALL_Window/.test(o.name)) return;
    if (/Floor/i.test(o.name)) return;
    o.castShadow=false;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    const cloned=materials.map(source=>{
      const m=source.clone(); m.side=THREE.DoubleSide;
      m.onBeforeCompile=shader=>{
        // hall: one uniform section cut at 1.3 m (a plan model of the T-shaped room); office: cut the two front walls
        const hall=kind==="hall";
        shader.uniforms.cutLimits={value:new THREE.Vector3(hall?-1e9:c.x+size.x*.32,box.min.y+(hall?1.6:.5),hall?-1e9:c.z+size.z*.32)};
        shader.uniforms.cutSill={value:box.min.y+.12};
        shader.vertexShader='varying vec3 cutWorld;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncutWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
        shader.fragmentShader='varying vec3 cutWorld; uniform vec3 cutLimits; uniform float cutSill;\n'+shader.fragmentShader;
        // hall: walls seen from behind are the near walls (their faces point into the room); open them down to a sill
        const nearCut=hall?'\nif(!gl_FrontFacing && cutWorld.y>cutSill) discard;':'';
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(cutWorld.y>cutLimits.y && (cutWorld.x>cutLimits.x || cutWorld.z>cutLimits.z)) discard;'+nearCut);
      };
      m.customProgramCacheKey=()=>`cutaway-${kind}`;
      return m;
    });
    o.material=Array.isArray(o.material)?cloned:cloned[0];
  });
}

export function spatialControls(camera, canvas) {
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false; controls.enableDamping=false; controls.enableZoom=true;
  controls.minPolarAngle=THREE.MathUtils.degToRad(20);
  controls.maxPolarAngle=THREE.MathUtils.degToRad(65);
  controls.minAzimuthAngle=THREE.MathUtils.degToRad(20);
  controls.maxAzimuthAngle=THREE.MathUtils.degToRad(70);
  controls.rotateSpeed=.45; controls.zoomSpeed=.55;
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
  /** Fit `root` into `frame` ({w,h} in CSS px, part of the full screen). The camera still spans the whole screen;
   *  world.js moves the image into the frame with a view offset, and clips the canvas to it. */
  function fit(root, frame={w:innerWidth,h:innerHeight}, closer=1) {
    let box=visibleBounds(root);
    if(box.isEmpty()) box=new THREE.Box3(new THREE.Vector3(-3,0,-3),new THREE.Vector3(3,3,3));
    const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
    // Narrow perspective gives an isometric-style model view while sharing the document camera. The bounding sphere
    // over-estimates a flat room seen from above, so the margin factor is below 1.
    // Exact fit: project the box corners through the real view direction so the model fills ~82% of the frame.
    const t=Math.tan(THREE.MathUtils.degToRad(28/2)), aspect=innerWidth/innerHeight, M=1.0;
    const kV=t*(frame.h/innerHeight)*M, kH=t*aspect*(frame.w/innerWidth)*M;
    const dir=new THREE.Vector3(1,1.05,1).normalize(), fwd=dir.clone().negate();
    const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize(), up=new THREE.Vector3().crossVectors(right,fwd);
    let distance=0; const rel=new THREE.Vector3();
    for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) {
      rel.set(x,y,z).sub(center);
      const along=rel.dot(dir);
      distance=Math.max(distance, along+Math.abs(rel.dot(up))/kV, along+Math.abs(rel.dot(right))/kH);
    }
    void size; distance/=closer;                 // thin shapes (the T-shaped hall) fill little of their box
    controls.target.copy(center); controls.minDistance=distance*.65; controls.maxDistance=distance*1.7;
    const direction=new THREE.Vector3(1,1.05,1).normalize();
    return {position:center.clone().addScaledVector(direction,distance),center};
  }
  return {controls,fit};
}

/** Solid-looking walls for the rectangular office: plaster slabs behind the two back walls (their tops read as the
 *  cut section, like the Fuselab model) and low sills where the front walls were cut. Runtime-only; the authored
 *  Blender cutaway (handoff P1) should replace this. */
export function thickenWalls(root) {
  const walls = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse(o => { if (o.isMesh && /ARCH_Walls__mesh02|WallBand/.test(o.name)) { o.geometry.computeBoundingBox(); walls.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  if (walls.isEmpty()) return null;
  const t = .14, sill = .5, { min, max } = walls, H = max.y - min.y, X = max.x - min.x, Z = max.z - min.z;
  const mat = new THREE.MeshStandardMaterial({ color: 0xeee8de, roughness: .92, metalness: 0 });
  const g = new THREE.Group(); g.name = "SPATIAL_WallSection";
  const slab = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  const e = .006;                                                              // set back from the wall planes: flush faces z-fight (the patchy squares)
  slab(X + 2 * t, H, t, min.x + X / 2, min.y + H / 2, min.z - t / 2 - e);      // back wall along x
  slab(t, H, Z, min.x - t / 2 - e, min.y + H / 2, min.z + Z / 2);              // back wall along z
  slab(X + 2 * t, sill, t, min.x + X / 2, min.y + sill / 2, max.z + t / 2 + e);    // front sills
  slab(t, sill, Z + t, max.x + t / 2 + e, min.y + sill / 2, min.z + Z / 2 + t / 2);
  root.parent.attach(g); root.attach(g);                                       // keep world placement, follow the room
  return g;
}

/** A soft contact shadow under a model, so it sits on the studio instead of floating. */
let shadowTex = null;
export function contactShadow(root, strength = .42) {
  if (!shadowTex) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"), r = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    r.addColorStop(0, "rgba(0,0,0,1)"); r.addColorStop(.45, "rgba(0,0,0,.55)"); r.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = r; x.fillRect(0, 0, 256, 256); shadowTex = new THREE.CanvasTexture(c);
  }
  const b = visibleBounds(root); if (b.isEmpty()) return null;
  const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 1.45, s.z * 1.45),
    new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x2a2118, transparent: true, opacity: strength, depthWrite: false, toneMapped: false }));
  m.name = "SPATIAL_ContactShadow"; m.rotation.x = -Math.PI / 2; m.position.set(c.x, b.min.y - .02, c.z); m.renderOrder = -1;
  root.parent.attach(m); root.attach(m);
  return m;
}
