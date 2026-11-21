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

## Opener film (Miva shell)

`npm run assets` copies `../opener/The_Analysts_Brief_Opener.mp4` (rendered from `../opener/film` with HyperFrames) to `public/opener/opener.mp4`. It plays once per saved run before the title screen (`playOpener()` in `src/main.js`): skippable (button, Esc, Enter, Space), never under reduced motion, and Settings → Replay intro plays it again. `?opener=1` forces it, `?opener=0` turns it off. A missing or failed file goes straight to the title.
