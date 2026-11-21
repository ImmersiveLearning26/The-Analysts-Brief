# Current design contract — 20 November 2026

## Presentation

The environment is a roofless isometric model on warm white (`#f4f3ee`) or a closely matching neutral. The model is the main visual. The learner is offscreen. This supersedes the previous requirement that every environment camera be first-person. Inspected documents are still front-facing and readable, with no skew or decorative rotation.

Use the reference videos for spatial movement and the four Bino images for restraint, capsule controls and compact information. Do not copy their clocks, recording UI, toolbars, florals, labels or icons unless needed by the simulation. Generated images throughout the older kit are conceptual and can be inaccurate.

## UI dimensions implemented

| Element | Desktop | Narrow screen |
| --- | --- | --- |
| Agent globe | 48px, 22px from right / 18px from top | 48px, 14px right / 12px top |
| Composer | Up to 380px wide, right 22px, top 82px | Width viewport minus 28px, bottom 18px; max 48dvh |
| Composer padding/radius | 18px / 22px | 15px / 22px |
| Main text | Manrope, 15px, line-height 1.55 | 14px |
| Secondary result card | Bottom right, up to 380px wide, max 34dvh | Top 78px, max 30dvh |
| Task actions | Minimum 44px height | Minimum 44px height |

These are implementation starting values, not a claim of pixel-perfect review. The reference’s visual intent overrides accidental geometry or text in an image. Tune spacing when a real browser shows a collision. Avoid repeated headings, unexplained icons and excessive controls.

## Assistant behaviour

One persistent upper-right globe. Clicking opens its small menu. A necessary scripted question opens a compact frosted chat-like composer. Hiding it collapses toward its anchor; reopening restores the same task. No giant chat panel, full-screen ripple, scene bounce, idle breathing or repeated unsolicited questions. The input area and relevant options are prominent but compact. The scene holds still during reading or typing. Optional detail replaces the visible task surface temporarily.

This iteration keeps the globe at its dock while the composer appears adjacent to it. The earlier flying-to-screen-centre particle spectacle is superseded by the user's later request to reduce interruptions. No calendar/date/timer strip is added.

## Document sequence

1. Folder rests closed on the desk.
2. Selection lifts and aligns it square to the view (about 420ms).
3. Cover opens while the aligned object holds still (about 400–460ms).
4. Exactly one selected document slides horizontally to the right (about 300ms to settle). The folder stays on the left. No curl, diagonal drift, page fanning, texture warping or idle tease.
5. Foundation / Set aside tags are applied to that document without another assistant question. Choices persist in the existing state and appear on its texture.
6. Next/Previous returns the current document along the same path, then brings out the next. Every document belongs to the same source folder.
7. Closing returns the paper, closes the cover, then lowers the folder (about 350ms). Reduced motion completes the same state changes without a prolonged transition.

Desktop keys: arrows/PageUp/PageDown, F for Foundations, S for Set aside, +/- zoom, Esc close. Visible contextual controls provide the same reading/navigation actions. `Read text` is an HTML alternative and a fallback when 3D is unavailable.

## Motion values

| Action | Current implementation |
| --- | --- |
| Composer appear / disappear | 320ms / 240ms, restrained translation and scale |
| Optional detail appear / close | 240ms / 160ms |
| Camera reframe | Capped at 520ms, smooth interpolation |
| Desktop model position | Smooth 13% horizontal frame offset; 0 during inspection |
| Globe working | 1.06× local scale; strand motion only while working/listening |
| Teaching-model computation beat | Capped at 350ms; actual engine remains synchronous |
| World idle | No automatic orbit or model loop |

## State map and character appearances

| State | Main visual / task | Speaker |
| --- | --- | --- |
| P00 | Light cutaway office, title and Start / saved run | None |
| P01 | Same model, compact name composer | Reception |
| P02 | Declare connection, then mission briefing | Junior analyst context; Dr Amina Diallo |
| P03 | Front-facing folder and straight extracted sheet; direct tags | No automatic assistant interruption |
| P04 | Source review/filter; existing evidence gate | Dr Amina Diallo |
| P05 | Isolated Kalinda miniature; choose condition, inspect baseline, run test | Scripted model interface |
| P06 | Brief local computation; quiet globe activity | No fabricated thinking narrative |
| P07 | Same miniature; trajectory headline and compare/change/findings actions | Scripted model interface |
| P08 | Same held-still miniature; choose factors and write findings | Learner |
| P09 | School hall cutaway; situation briefing | Hon. Grace Mwangi; Diallo feedback optional in menu |
| P10 | Same hall; one response lever at a time | Response plan interface |
| P11 | Same hall; package/result plus rationale input | Learner |
| P12 | Chair-office context using existing office/props; briefing choice | Hon. Grace Mwangi; Dialogue feedback optional in menu |
| P13 | Briefing input; topic check only on request | Learner |
| P14 | Debrief with original three strands and Restart | Dr Amina Diallo; original Chair feedback |

Characters remain named text speakers. No new physical character positions, animation rigs, footage or videos are implied. Keep the actual fictional place names and chronology from the SDD. Kalinda is the simulation’s fictional case, not a real-world prediction.

## Invariants

Preserve every source record, the requirement for at least fourteen sourced foundations and decisions on both claims, model factors, response options, assessment bands, saved run schema and reflection/briefing. The simplified presentation must not silently remove a learning task. Never make the map appear to establish a causal result that the rule engine does not support.
