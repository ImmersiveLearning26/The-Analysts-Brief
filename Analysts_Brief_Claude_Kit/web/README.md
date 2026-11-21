# Current production app

Vite + plain ES modules + Three.js. Continue work here; `../app/` supplies the unchanged content and rule engine.

```sh
npm ci
npm run dev
npm run build
npm run test:rules
npm run test:spatial
```

Use Node 22.12+; this patch was built using Node 24.22.3. Development URL: http://127.0.0.1:5180/ . `?dev=1` exposes the page switcher and `window.__ab`; never include it in a learner release.

Models are copied from `../blender/production/export/` by `npm run assets`. `public/models`, `public/draco`, `dist` and `node_modules` are regenerated locally and intentionally excluded from this handoff ZIP. Keep this folder beside `app/` and `blender/`; do not move it out of the kit.

Read `../handoff/CONTINUE_IN_CLAUDE.md`. New visual authority is `src/spatial.css`; camera/cutaway controls are in `src/spatial.js`, integrated into `src/world.js`. The front-facing reading sequence is in `src/inspector.js`. The agent is compact, upper-right and quiet. `src/glow.js` is unused legacy code.

Current verification: production build, exact rule suite and offline transform regressions pass. Browser visual checks, real imported-asset animation, mobile layout and microphone recording are outstanding. Historical browser verification of the previous build is not evidence for these changes.
