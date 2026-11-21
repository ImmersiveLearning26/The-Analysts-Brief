// Copies the exported runtime models and the Draco decoder into public/ (idempotent).
import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const exportDir = path.resolve(web, "../blender/production/export");
const models = path.join(web, "public/models");
const draco = path.join(web, "public/draco");
mkdirSync(models, { recursive: true });
mkdirSync(draco, { recursive: true });

for (const f of ["office.glb", "casefile.glb", "kalinda.glb", "hall.glb", "chair_office_props.glb", "office_env.hdr"]) {
  const src = path.join(exportDir, f);
  if (!existsSync(src)) throw new Error(`Missing ${src}: run blender/production/export_glb.py first`);
  const dst = path.join(models, f);
  if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) cpSync(src, dst);
}
const dec = path.join(web, "node_modules/three/examples/jsm/libs/draco/gltf");
for (const f of readdirSync(dec)) cpSync(path.join(dec, f), path.join(draco, f));
// The opener film (rendered from ../opener/film with HyperFrames). Optional: the app skips the intro if it is missing.
const opener = path.resolve(web, "../opener/The_Analysts_Brief_Opener.mp4");
if (existsSync(opener)) {
  mkdirSync(path.join(web, "public/opener"), { recursive: true });
  const dst = path.join(web, "public/opener/opener.mp4");
  if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(opener).mtimeMs) cpSync(opener, dst);
}
console.log("assets ready:", readdirSync(models).join(", "));
