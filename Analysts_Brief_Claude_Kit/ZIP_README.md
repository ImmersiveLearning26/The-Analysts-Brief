> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# The Analyst's Brief: build snapshot (20 Nov 2026)

A first-person 3D simulation for IRS 103 (Introduction to African Politics). Vite + Three.js 0.187, plain ES modules.

## Run it
```sh
cd web
npm install
npm run dev      # copies the models into public/ and serves http://127.0.0.1:5180  (?dev=1 adds a page switcher)
```

## Where things are
- `web/src/main.js`: the P00-P14 state machine, the subtitles (composer), the globe menu, the case-file stamps, all actions.
- `web/src/world.js`: rendering (room HDR, AgX, shadows, AO, bloom, blur + grade), models, cameras, moods per place.
- `web/src/inspector.js`: the case file to the screen; click the page to slide it aside.
- `web/src/pages.js`: paints the 18 evidence pages.
- `web/src/agent.js`, `web/src/glow.js`, `web/src/strands.js`: the globe (React Bits Strands) and the Apple Intelligence-style edge glow.
- `web/src/styles.css`: the whole look. `web/index.html`: the page shell.
- `app/content.mjs`, `app/engine.mjs`: the kit's content and rules (imported by the app via the `@kit` alias; tested by `verification/`).
- `blender/layout.json`: camera poses and placements. `blender/production/*.py`: the Blender build scripts.
- `blender/production/export/`: the runtime models (GLB) and the room HDR.
- `production/`, `design/`, `handoff/`, `START_HERE.md`: the kit's specs and production notes.

Not included (too large): the Blender working file `analysts_brief_production.blend` (793 MB), the kit's source `assets/`,
the 1K hall texture copies, `node_modules` and `dist`.
