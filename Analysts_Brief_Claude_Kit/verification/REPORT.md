> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Verification report

## Observed passing checks
- Original GLBs parsed structurally, with embedded author/source/license metadata and clip/node inventory retained.
- Exact rule engine tested over all 128 binary factor configurations: 76 Coup, 32 Personalised rule, 20 Consolidation. Every F7 toggle leaves points unchanged.
- All 243 response configurations tested in each of 3 climates (729 checks). Every combination resolves. Counts recorded in rule_results.json.
- Worked example discrepancy checked: the literal L5-2 package costs 7, whereas replacing it with L5-1 costs 9. Formal tables govern the engine.
- Source threshold, three sourcing bands, findings rules, climate, forward-view logic and briefing keyword detection checked.
- JavaScript syntax checked for the application and Three adapter.
- Blender 4.3.2 executed make_reference_geometry.py and exported four BLEND/GLB reference pairs successfully. Log retained. These are primitive references, not final art.
- Five orthographic plates produced from numeric construction data, PNG plus editable SVG. Map and tag plate spot checks completed.
- Six selected source models bundled; unused alternatives remain documented in the complete inventory.
- Fifteen separate generated playthrough guide images included; the gallery and written instructions prominently warn about positional inaccuracies.

## Not verified / production work still required
- Browser end-to-end attempt could not launch: the environment denied Chromium's socket operation. No claim of browser visual, keyboard or responsive test success. The provided browser script must be run in the builder environment.
- The default app is a reference with CSS geometry, not a finished Blender-integrated WebGL experience. Three adapter is syntax-checked only. Source asset merges, final materials, animation clips, camera clipping and raycasting still require production integration and visual QA.
- Orb movement/particle morph and state flows are reference implementations. Full-width collapse animation, one-shot ripple, skip animation, complete unified pause, production captions/media and precise physical paper travel remain implementation tasks defined in the motion contract.
- Portrait isolation and audio/video generation were not performed. Prompts, transcripts and appearance map are included. No paid AI or speech-to-text service is connected. Text and explicit choices remain the baseline.
- Microphone recording code is included but not exercised with a real device. Reference audio stays in memory; optional cloud storage and consent flow require production work.
- Human learner pacing, screen-reader behavior, keyboard-only flow, mobile virtual keyboard and final source-model visual fit were not user-tested.
- Embedded source licenses are inventoried, not independently verified. Original procedural reference replacements are available.

## Reproduce
Run `node verification/rules.test.mjs`. Start `python3 -m http.server 8000` at kit root; open `/app/` and the gallery. For browser automation install Playwright locally and run `node verification/browser.test.cjs` with BASE_URL=http://127.0.0.1:8000/app/. Browser binary must be available. The production acceptance checklist is separate.

## Handoff interpretation
No live site or finished simulation was built or published. The package supplies the requested plan, concept imagery, exact data/rules, editable reference code, and Blender construction references for Claude to complete production.
