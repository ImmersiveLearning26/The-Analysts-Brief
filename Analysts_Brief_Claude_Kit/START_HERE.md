# The Analyst’s Brief — updated build and Claude handoff

20 November 2026. This is an incremental update to the uploaded `The_Analysts_Brief_build_2026-11-20.zip`. Actual application code has changed. It is a development handoff, not a visually approved release.

**Start with `handoff/CONTINUE_IN_CLAUDE.md`.** It separates completed changes, checks, limitations and remaining work.

## Run the current app

Use Node 22.12+ (tested with Node 24.22.3). From this folder:

```sh
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:5180/ . Append `?dev=1` only during development to jump between P00–P14.

```sh
npm run build
npm run test:rules
npm run test:spatial
```

`app/` is the older reference UI and shared content/rules. **Continue the build in `web/`.** Do not mistake the old HTML reference or old screenshots for the updated app.

## Read in this order

1. `handoff/CONTINUE_IN_CLAUDE.md` — exact starting point and remaining work.
2. `handoff/CURRENT_DESIGN_CONTRACT.md` — current UI, camera, document and motion rules.
3. `verification/SPATIAL_UPDATE_REPORT.md` — current evidence and unverified items.
4. `handoff/CHANGED_FILES.json` and `handoff/UPDATE.patch` — compare with the supplied ZIP.
5. Original SDD and `app/content.mjs`, `app/engine.mjs` — authoritative educational content and rules.
6. `design/current_references/README.md` — how to use the latest references.

## Images are guides

Generated images are NOT exact representations of camera positions, geometry, scale, document placement, character appearance or UI dimensions. Do not reproduce distortions, oversized panels, duplicate orbs or incidental text from those images. Current written rules take priority.

The newer **isometric environment** direction supersedes the earlier first-person-only environment instruction. The learner stays offscreen. Reading surfaces remain upright and straight toward the learner. The current implementation uses a narrow perspective camera for an isometric-style view; it is not a true orthographic camera.

Original GLBs, source content and assessment engine are preserved. The room cutaway is a runtime adaptation; Blender geometry cleanup and actual-browser visual acceptance remain outstanding.
