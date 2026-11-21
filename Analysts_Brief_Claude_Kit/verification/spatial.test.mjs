// Offline transform regressions: useful even when a GPU/browser is unavailable.
import assert from 'node:assert/strict';
import * as THREE from '../web/node_modules/three/build/three.module.js';
import { Inspector } from '../web/src/inspector.js';
import { visibleBounds, cutaway } from '../web/src/spatial.js';
globalThis.innerWidth=1366; globalThis.innerHeight=768;
const scene=new THREE.Scene(), root=new THREE.Group();
root.userData.sim_interaction='open_close';root.scale.setScalar(.1); scene.add(root);
for(let i=0;i<18;i++){
 const geo=new THREE.PlaneGeometry(2.1,2.97);geo.rotateX(-Math.PI/2);
 const pg=new THREE.Mesh(geo,new THREE.MeshStandardMaterial()); pg.name=`CF_Page_${String(i+1).padStart(2,'0')}`;pg.position.y=.154-i*.0011;root.add(pg);
}
scene.updateMatrixWorld(true);
const camera=new THREE.PerspectiveCamera(28,1366/768,.02,300);camera.position.set(8,9,8);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const events=[];const inspector=new Inspector({camera,hooks:{open:()=>events.push('open'),close:()=>events.push('close')}});
const advance=t=>{for(let s=0;s<t;s+=1/120)inspector.update(1/120)};
assert(inspector.enter(root,{startPage:3}));assert.equal(events.length,0,'cover must stay closed during lift');
advance(.5);assert.deepEqual(events,['open']);advance(1);
assert.equal(inspector.state,'held');assert.equal(inspector.pageIdx,3);
assert.equal(inspector.pages.filter(p=>p.o.visible).length,1);
let pg=inspector.pages[3]; assert(pg.cur.x>pg.home.x,'sheet exits to right');
assert.equal(pg.cur.y,pg.home.y);assert.equal(pg.cur.z,pg.home.z);
root.updateWorldMatrix(true,true);
const normal=new THREE.Vector3(0,1,0).transformDirection(root.matrixWorld);
const cameraFacing=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
assert(normal.dot(cameraFacing)>.99999,'sheet normal must face camera');
advance(.5);const before=pg.o.position.clone();advance(5);assert(pg.o.position.distanceTo(before)<1e-6,'no idle teasing');
inspector.turnTo(4);advance(.15);assert.equal(inspector.pageIdx,3,'return sheet before extracting next');advance(.65);
assert.equal(inspector.pageIdx,4);assert.equal(inspector.pages.filter(p=>p.o.visible).length,1);
inspector.rotate(100,100);assert(inspector.spin.angleTo(new THREE.Quaternion())<1e-8,'reading cannot tilt');
inspector.exit();assert.equal(events.length,1);advance(.35);assert.equal(events[1],'close');assert.equal(inspector.state,'returning');advance(1);assert.equal(inspector.state,'idle');assert.equal(root.parent,scene);
assert(root.children.every(p=>p.visible),'restores stack on desk');
inspector.reduced=true;assert(inspector.enter(root));advance(.1);inspector.exit();advance(.1);assert.equal(inspector.state,'idle','reduced motion still completes close');
const model=new THREE.Group(), wall=new THREE.Mesh(new THREE.BoxGeometry(6,3,6),new THREE.MeshStandardMaterial()), ceiling=new THREE.Mesh(new THREE.BoxGeometry(6,.1,6),new THREE.MeshStandardMaterial());wall.name='ARCH_Walls';ceiling.name='ARCH_Ceiling';ceiling.position.y=3;model.add(wall,ceiling);cutaway(model,'office');assert.equal(ceiling.visible,false);assert.equal(wall.castShadow,false);assert(!visibleBounds(model).isEmpty());
console.log('SPATIAL_TRANSFORMS_PASSED: lift/open, straight extraction, page replacement, no idle motion, no tilt, return/close, reduced motion, cutaway');
