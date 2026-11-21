# Continue here, Claude

## Task and authority

Continue this existing build. The user wants a clean, minimally interruptive spatial simulation: isometric room/model, white or complementary background, compact agentic input boxes and restrained Apple-like open/close motion. The goal is a short, understandable experience. Preserve the supplied narrative, source requirements and scoring.

Read `CURRENT_DESIGN_CONTRACT.md` before changing the visual implementation. Its rules supersede older first-person-only environment instructions, dark-glass/subtitle layouts, screen-wide glow and bottom-centre globe instructions in this kit. The learner is never shown as an avatar. Documents still face the learner straight.

**Generated images are visual guides, not accurate representations of true positions or scale.** The previous user explicitly rejected distorted open folders. Never trace an image’s folder perspective into the implementation.

## What was actually changed

| File | Implemented change |
| --- | --- |
| `web/src/spatial.js` | Bounds-based framing, constrained orbit/zoom, runtime room cutaway, near-isometric camera helper |
| `web/src/world.js` | Light neutral background/lighting, no bloom/vignette, isolate Kalinda, fit named camera calls to models, quiet map, disable scene controls while reading, model shifts left for right-side UI |
| `web/src/inspector.js` | Lift first, open cover, extract one sheet straight right; return old sheet before replacing it; return sheet, close, lower folder; prohibit reading tilt and remove idle teasing |
| `web/src/agent.js` | Quiet upper-right globe with motion only during work/listening; remove full-screen activation glow and bounce; simple fallback when globe WebGL fails |
| `web/src/main.js` | Compact conversation, stable focus on same-page edits, optional feedback in agent menu, remove auto case-notes popup and auto source-ready interruption, on-demand topic check, capped artificial wait, text document fallback, view controls |
| `web/src/spatial.css` | Current light UI overrides, small frosted composer, corner dock, restrained entry/exit, legible text colours and 44px controls |
| `web/index.html` | Load visual overrides; accessible previous/next/read/review/close document controls |
| `verification/spatial.test.mjs` | Offline 3D interaction regression tests |

The original GLBs and assessment modules were not rewritten. `web/src/glow.js` remains in the source archive but is no longer imported by the agent.

## Start by running and reviewing, not rebuilding

1. `cd web && npm ci && npm run dev`.
2. Open `http://127.0.0.1:5180/?dev=1` in a real browser with WebGL. Review at 1366×768, then 390×844. Test regular learner navigation separately without the developer switcher.
3. Read the current test report. The code builds and offline checks pass; **there has been no successful browser visual review of this update**.
4. Verify the P03 folder sequence first, then P00/P01 model framing, Kalinda and hall. Tune the existing implementation.
5. Preserve `app/content.mjs`, `app/engine.mjs` and local storage key `analysts-brief-prod-v1`. Existing saved runs must remain compatible.
6. Deliver screenshots from the actual updated browser at key states, a short motion capture and an updated ZIP. Do not substitute generated concept images for runtime evidence.

## Priority work remaining

### P0 — actual browser validation

The local Chromium launch failed with `socket() failed: Operation not permitted`; the remote preview could not reach localhost. These are environment limitations, not successful UI tests. No new screenshots or claims of visual acceptance were produced.

Run `verification/spatial.browser.test.cjs` after installing Playwright in `web/` as a development dependency and installing its Chromium browser. The script is supplied for continuation and has NOT been executed successfully here. Also perform the manual checklist in `verification/SPATIAL_UPDATE_REPORT.md`.

Check for camera clipping, invisible models, cover/paper overlap, shader compilation errors, tiny text, inaccessible document tags, blank globe, mobile panel collisions and keyboard focus traps. The automated transform test uses representative page geometry; it does not prove the imported GLB renders correctly.

### P1 — replace runtime wall cuts with authored Blender cutaways

`spatial.js:cutaway()` hides ceiling objects and clips the two front architectural edges in the fragment shader. The original room meshes combine walls. This preserves assets but can leave uncapped edges, floating architectural decorations or unsuitable baked lighting. Architecture shadow casting is disabled to avoid invisible walls casting shadows. Raycasting does not know about fragment cuts: audit visible hotspots near walls.

In Blender, duplicate the production room source into a new cutaway variant, split walls into named near/far sections, retain two back walls and floor, remove the roof, shorten the two front walls to a low sill and cap the cut faces. Keep furniture and authored scene coordinates. Remove orphan window fittings/door frames above cut walls. Re-bake hall lighting if the roof/wall removal reveals lighting errors. Export and visually compare before replacing a runtime GLB. Update `copy-assets.mjs` if filenames change.

Avoid rebuilding the narrative room unnecessarily. The separately supplied full-size isometric-office source is not part of this uploaded build and has not been substituted in this patch.

### P1 — camera and motion finish

The update uses a 28° perspective camera, default view vector `(1, 1.05, 1)`, with azimuth limited to 20–70° and polar angle 20–65°. This approximates the requested isometric composition while retaining the existing document inspector camera. A mathematically orthographic overview is still a follow-up. If implementing it, give the document inspector its own perspective camera; update picking, fitting, resize and overlay projection together. Do not simply replace the camera class and leave `camera.fov` calculations in the inspector.

Calibrate model scale and the 13% desktop frame shift against real screenshots. The model should hold still while the learner reads or types. Camera motion is currently represented by bounded orbit and model framing; elaborate per-object focus choreography from the reference remains to be tuned.

### P1 — folder animation with real asset

Check that opening ends before the paper starts moving and closing begins only after it returns. The exported open/close animation runs at 8× its original speed (approximately 0.4 seconds). The sequence currently uses known durations; if you re-export the clip, replace timing assumptions with animation completion callbacks. All sheets stay in the same folder and tags persist. Do not introduce separate physical trays or paper curl.

The document has a narrow-screen focus view and an HTML `Read text` alternative. Adjust magnification if the real texture is not readable at laptop size. Do not enlarge the entire folder to fill the screen merely to make text readable.

### P2 — UI polish and access

`spatial.css` intentionally overrides legacy CSS to keep the patch reviewable. Once screenshots pass, consolidate duplicate rules if useful. Keep the 44px touch targets, distinguish selected tags without colour alone, verify contrast, reduced motion, keyboard navigation, screen readers and mobile keyboard reflow. Detailed response information may scroll inside its card; the main desktop page should not scroll.

Optional details currently use a native dialog and temporarily hide the underlying task surfaces. This is intentional progressive disclosure, but dialog focus restoration and rapid close/reopen need browser review. Keep confirmations only for microphone permission, abandoning a saved run or genuinely necessary decisions.

### P2 — remaining existing production features

No LLM or external reasoning service was connected. The globe presents scripted interactions and the existing deterministic teaching model; do not label it a predictive political AI. No new voice recordings, character videos, transcription or character avatars were produced. Real microphone recording, browser media permissions, performance on low-power hardware and audio resume remain unverified. Source speaker identities and where they appear are preserved in the current state machine.

## Completion criteria

A successful continuation preserves all assessment branches, shows a clean model on a plain complementary background, keeps the folder/paper square to the screen, uses one quiet assistant, avoids unsolicited overlays and passes real desktop/mobile playthroughs. Update the report with evidence and exact remaining limitations before calling the build finished.
