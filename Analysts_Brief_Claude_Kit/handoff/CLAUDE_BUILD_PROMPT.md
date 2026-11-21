> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Build instruction for Claude

Build The Analyst’s Brief for first-year students from this package. The learner is a junior political analyst in fictional Kalinda; they evaluate sources, test explanations, design a response and brief the Chair. Deliver a simple, legible first-person experience, with one clear action at a time.

**Images are visual guides, not authoritative coordinates or exact UI layouts. Some generations are inaccurate.** Use `blender/layout.json`, the orthographic plates, `PAGE_SPECIFICATIONS.md` and `MOTION_AND_ORB.md` whenever a reference picture differs. Never blindly match an image’s geometry, duplicate orb, invented signage, map borders, oversized panel or inconsistent face.

1. Read START_HERE and every production contract. Inspect the supplied original SDD and discrepancy register. Keep all 18 evidence items, 7 factors, 5 levers with 3 settings, and exact rubric behavior.
2. Start with the runnable reference’s content and engine, not hard-coded screenshot text. Every state is already named. Preserve deterministic outcomes; the orb is not an authority that invents politics or writes assessed answers.
3. In Blender inspect original source models. Reuse office furniture for the hall where suitable. Replace primitive references with clean art while retaining canonical node names and dimensions. Use the source asset inventory to identify components, animation clips, provenance and optimization needs. Import only chosen pieces. Keep original source files unchanged.
4. Produce the office, document rig, miniature map, hall and Chair-office variants. The learner never appears externally. No third-person walk cycle, free-roam mission, dollhouse camera or cutaway room in the final playthrough. Object inspection can rotate the folder/map while the camera stays at the learner’s eyes.
5. Wire a persistent DOM composer and single particle orb over WebGL. Use semantic HTML for text and inputs. Size by CSS pixels, not percentage-of-screen guesses. 560 px wide normal composer; 96–180 px normal height; up to 220 px for three long choices; 22 px corners. 44 px targets. No giant central modal for routine turns.
6. Complete the first slice: Start → name → interest declaration → Diallo briefing → desk focus → folder open → read → tag → return paper → next document. Preserve tags across reload. Exercise keyboard and tap navigation.
7. Complete model selection, run/compare, findings and Diallo feedback. Then five hall choices, preview/revision/rationale, Chair reaction and final briefing. Preserve weak outcomes and allow progression; do not force a perfect answer.
8. Finish record/export, debrief, reflections, restart, audio settings, reduced motion, and optional mic path. Do not connect a paid live AI or transcription service until an actual provider is configured. Typed input and explicit choices must remain fully usable.
9. Test the supplied rule suite and the acceptance checklist. Render the exact laptop target, 1366 × 768, plus 390 × 844. The scene never requires page scrolling; supplementary record drawers may scroll internally. Check keyboard, focus, screen reader announcements, saving and media cleanup.

## Do not infer from a generated image
- Buildings are symbolic institutions, not geographic explanations for conflict.
- No part of the country disappears for an unfavorable outcome.
- All document tags return to one folder; no separate trays.
- The large floating paper is a document surface, not a huge agentic popup.
- Character portraits are brief communication cues. Do not create animated human rigs unless later requested.
- Source content outranks abbreviated text in a picture.

## Integration approach
The included `app/` is a framework-free design reference. You may port to React/TypeScript and Three.js if appropriate, keeping `engine.mjs` pure and preserving content IDs. `production/THREE_INTEGRATION.md` and `app/three-bridge.mjs` define the 3D adapter. A production port must implement the full motion/media contracts, not claim that the CSS world stand-in is the final 3D scene.

## Completion report
State what you built, source assets selected, any replacements, tests run, and remaining limitations. Do not call source model import, lip sync, live AI or transcription complete unless actually connected and verified.
