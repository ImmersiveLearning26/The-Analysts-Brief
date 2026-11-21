import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

// The kit's content, rules engine and layout stay single-source in ../app and ../blender:
// "@kit/app/engine.mjs" is the same file the rules test suite exercises.
export default defineConfig({
  resolve: { alias: { "@kit": path.resolve(here, "..") } },
  server: { fs: { allow: [path.resolve(here, "..")] } },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
