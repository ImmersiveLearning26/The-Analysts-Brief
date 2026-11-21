# The Analyst’s Brief — Existing Claude Build Update
Date: 20 November 2026
Status: design and implementation addendum for the user’s existing Claude build.
This file records requested changes. It does not claim that the external Claude project has been edited. Include this file in the next handoff ZIP.

## Apply as an incremental update
The user has already done work in Claude. Inspect that implementation first and reuse its components, assets, routing/state, and animation facilities. Apply the changes below to it. Preserve working simulation logic, assessment, narrative, saved progress, and unrelated screens. Do not restart the project or substitute a new generic district/market simulation.

The latest user requirements take precedence over earlier mockups where they conflict. Existing authored script content remains authoritative for names, evidence, choices, outcomes, and character appearances.

## Latest environment direction — isometric model on a plain stage
This section supersedes the earlier first-person-only environment framing and the generated photographic office/tabletop backdrops. The user now explicitly wants the environment to be isometric, with white surrounding space or a colour that matches the model, and movement like the newly supplied video.
Keep the learner character off-screen. The document-reading interaction stays direct and front-facing. Do not require a walk-through camera move into a photorealistic room to reconcile the older direction.

Reference: george_railean_ssspin.io_1795180267.mp4 (22.2 seconds).
Reviewed across the clip at half-second intervals, with closer inspection of selected views. The observations below describe the visible result; the clip alone cannot establish the original camera projection, software, or whether the model or camera is being rotated.

### Observed reference behaviour
| Approximate time | Visible behaviour |
|---|---|
| 0–4 seconds | Furnished roofless/cutaway apartment model on a plain navy field; gentle change in viewing angle; room labels give way to localized markers and line overlays. |
| 4–8 seconds | View moves toward top-down, with model reframed to the left while a right-hand information column opens. |
| 8–12 seconds | View returns to a diagonal elevated angle; selected room boundaries become prominent while information remains at the side. |
| 12–14 seconds | Information column withdraws; model turns through a larger arc, becomes smaller, and recentres. |
| 14–18 seconds | Thin schematic lines appear across selected areas of the interior. |
| 18–22 seconds | Schematic overlay recedes; the model returns toward its earlier angle and scale, with labels returning. |

### Apply to this simulation
- Present the office as one coherent cutaway 3D scene on an uninterrupted white, off-white, or subtly model-matched stage. Kalinda and the hall use the same presentation language where relevant to their scripted activity.
- The stage is the surrounding space, not a photograph of another room behind the room model. Remove the persistent giant tabletop and city background from evidence-reading views.
- Keep furniture and objects physically consistent within the environment model. Use natural materials, a restrained palette, and soft contact shadows to give depth on the plain background.
- Show the whole relevant model with generous margins. A proposed starting composition is 55–65% viewport width for overview; tune to the actual model and screen. Avoid excessive tiny prop detail.
- Start from an elevated three-quarter, isometric-style view. An orthographic camera is an implementation option, not something proven by the video. Allow controlled orbit/tilt around a stable model centre while keeping the model upright.
- Use smooth rotation, reframing, and modest zoom to focus on a selected desk or location. Hold the view still once reading or input begins.
- Model and camera movement must be one coherent system. Keep furnishings fixed relative to each other; do not rotate unrelated pieces independently to mimic the reference.
- Move/reframe the model into available space when requested information opens. Do not cover the object being inspected with a panel.
- Use small contextual highlights only when helpful. The video’s dense property sidebar, minimap, financial controls, repeated labels, and technical line networks are not requirements.
- On closing a detail, reverse the reframing and restore the learner’s previous view. Preserve the selected object and saved decisions.

### Folder and AI behaviour within the new environment
The learner selects the desk/dossier from the isometric overview. The camera/model may ease closer to locate it. The folder then enters the existing front-facing interaction space and opens straight; one paper slides horizontally out, also straight. Keep the environment visually quiet behind or outside the reading area. Do not leave a duplicate folder at the source.
After reading, return paper and folder through their existing sequence and restore the overview.
Keep the AI globe and composer as screen-space controls so orbiting the environment cannot tilt their text. Object markers follow their 3D anchors, but their labels remain readable. Only the current task’s relevant markers are visible.

### Movement defaults for implementation, not extracted measurements
Use approximately 450–700 ms for a short focus/orbit transition and 300–500 ms for reframing to accommodate a panel. Smooth acceleration/deceleration; no continuous idle spinning.
A longer turn like the reference can demonstrate navigation, but it must not play automatically during every learner action.
Provide a discoverable reset-view action inside existing controls. If drag-to-orbit is supported, constrain elevation and zoom, distinguish dragging from object selection, and keep touch/keyboard alternatives available. Reduced motion uses immediate viewpoint changes or brief fades.
Do not introduce free roaming or complex navigation requirements just to achieve the visual style.

### Acceptance checks for this revision
- Plain white or model-matched space surrounds the isometric model.
- No photographic office background is treated as a required environment.
- Rotation, zoom, and focus transitions preserve object relationships and keep the model in frame.
- Selecting a desk/location produces a clear focus transition without exposing unnecessary UI.
- Documents and input remain straight and steady while the environment can use an elevated angle.
- Earlier clutter-reduction and interruption rules remain in force.
- Existing Claude implementation and script are extended incrementally; this file is guidance, not evidence of an applied patch.

## Confirmed visual direction
- Clean, minimal spatial interface, with only information needed for the current action.
- Isometric environment overview on a white or model-matched background, following the latest direction below. Keep the learner off-screen; focused documents face the learner directly.
- Follow the supplied spatial-interface video for restrained floating panels, comfortable scale, depth, and staged workspace changes.
- Opening and closing should feel polished and fluid, inspired by Apple UI and the user’s Procreate / CleanMyMac references. These are references to feel and transition quality, not instructions to reproduce branding or an unprovided exact animation.
- The UI expands from the selected object or agent globe and collapses back to its origin.
- Keep both folder and reading document straight and facing the learner. Do not skew, distort, curl, or rotate the document during its extraction/return.

## Remove visual clutter
Remove repeated project titles, breadcrumb trails, redundant instruction pills, decorative labels, and permanently expanded toolbars from activity views.
Consolidate sound, captions, pause, and other settings into one small settings entry where those functions exist. Preserve their functionality and accessible names.
Keep the active object as the focal point. Show task choices only when needed.
Do not leave unrelated dioramas, evidence panels, old prompts, or completed options visible behind the current activity.
Never hide controls needed to complete, dismiss, or revisit the active task merely to make the screenshot look cleaner.

## Dossier and document interaction
1. Rest: the dossier is closed on the desk at natural scale. Use an unobtrusive hover/focus affordance instead of a permanent “Open dossier” instruction panel.
2. Select: the dossier lifts to the reading area and aligns with the screen. Any rotation needed to move from the desk finishes before it opens.
3. Open: the cover hinges open naturally. Its settled front-facing position has straight horizontal and vertical edges, without perspective distortion. Keep the folder on the left and reserve the right for the selected document.
4. Extract: exactly one paper slides horizontally out to the right. Keep its face parallel to the screen and its vertical orientation unchanged. Use the same apparent paper size at extraction; any additional reading enlargement must be uniform, subtle, and clearly separate from extraction.
5. Read: hold the camera and paper steady. Render actual script text sharply; do not use generated placeholder lines as final content. Give the document priority over the empty folder cover.
6. Decide: reveal compact Foundation / Set aside choices only when classification is relevant. Reuse the existing script’s exact labels if different.
7. Mark and return: attach the selected tag, then return the paper along the same horizontal path into the same folder. Persist the classification. Revisions must be possible through the existing review flow.
8. Finish: retract any active paper before closing the cover; then return the closed dossier to its resting position and clear the task UI.

“Straight on” refers to the folder and paper in their settled interaction state. It does not require flattening the environment. The new isometric overview and the front-facing document interaction are separate presentation states.

## Agent globe and compact composer
Use one persistent agent globe, small and quiet, docked in the upper-right area with suitable separation from Settings.
Open assistance when the learner requests it or reaches a required decision boundary. Optional guidance stays available through the docked globe without automatically opening. For required assistance, bring the globe toward a clear area beside/below the active content and expand a compact rounded composer from that same globe.
Use soft translucency with sufficient contrast, a short prompt, and only the necessary input or choices. Long information belongs in the relevant document, not in an oversized chat panel.
For processing, animate a gentle pulse and restrained shape changes only while real work or a defined simulation transition is occurring.
On submit or dismissal, fold the composer back into the globe, then return the globe to its dock. Do not render a second globe during the transition.
Move assistance out of the reading area. Avoid continuous ripples, particles, or screen effects while the learner reads.
Keep responses/actions tied to the actual state and existing reasoning system; animation must not invent outcomes or create a new dependency on a live AI service.

## Motion implementation defaults
These values are proposed implementation starting points, not measurements from the reference video. Tune them in the existing build.

| Transition | Starting duration | Behaviour |
|---|---:|---|
| Hover/focus feedback | 120–160 ms | Subtle material/contrast change |
| Dossier lift and alignment | 350–450 ms | Smooth deceleration, settle before opening |
| Cover opening | 280–360 ms | Hinge rotation, no rubbery deformation |
| Paper extraction/return | 280–360 ms | Straight horizontal translation, zero paper rotation |
| Composer opening | 240–320 ms | Expand from globe, fade in contents after shell begins |
| Composer closing | 180–240 ms | Reverse toward globe, then dock |
| Clearing one activity / revealing next | 300–500 ms | Staged fade/scale after prior objects withdraw |

Use a restrained spring or ease-out on entry and a controlled ease-in on exit. Avoid conspicuous bounce, overshoot, exaggerated zoom, and simultaneous competing animations.
Read the source object’s actual screen position when starting an animation. Recalculate positions on viewport changes rather than hard-coding one screenshot’s coordinates.

## State and accessibility requirements
Use explicit phases so repeated clicks cannot duplicate papers or open multiple composers.
Suggested phases: resting → aligning → opening → extracting → reading → returning → closing → resting.
The globe/composer has its own docked → opening → active → closing → docked phases.
State changes must retain saved decisions even if motion is interrupted. Escape should dismiss the current layer safely without losing confirmed work.
Keyboard users must be able to open the dossier, select documents, classify, dismiss, and return focus to the originating control.
Reduced-motion mode should retain the same sequence using brief fades or instant positioning, without camera travel or morphing.
At 1366×768, keep the primary interaction within the viewport with legible text and usable controls. On smaller screens, prioritize the document and collapse the folder to a compact accessible return control rather than shrinking everything until unreadable.

## Image/reference authority
All generated images are conceptual guides. They may contain incorrect dimensions, position, perspective, interface scale, labels, or background objects.
The recent upright-folder image illustrates front-facing alignment only. Its large folder, persistent map, repeated header, and always-open classification bar are not approved requirements.
Earlier generic market labels such as “Delivery record”, “Access”, “Cost”, and “Reliability” were visual placeholders. Do not add them to the simulation unless they belong to the actual script.
Do not reproduce generated flags, implied real-world geography, or invented evidence.
Use the written requirements in this file for behaviour and the supplied video for spatial visual character. Preserve the real script and existing build functionality.

## Acceptance review
- Only the active task’s objects and necessary controls are visible.
- Folder opens straight on and the paper exits straight, without distortion.
- Opening and closing visibly connect each UI element to its source.
- Closing reverses the interaction cleanly; no abandoned panels, duplicate orbs, or floating pages remain.
- The learner can read without continuous camera or particle movement.
- Tags and decisions survive reopening, dismissal, and saved-run restoration.
- Existing narrative and assessment still behave as before.
- Review actual motion in the browser; a generated still image cannot validate animation quality.

## Additional UI references — reduce interruptions
The user supplied Bino_MR_kids_07.webp, Bino_MR_kids_10.webp, Bino_MR_kids_11.webp, and Bino_MR_kids_12.webp as UI references. They show environmental views with restrained translucent controls, a narrow question capsule, and an expanded information state. Use these for interface restraint and progressive disclosure. Keep this simulation's mature visual style and subject matter.

These are still-image references; they do not establish exact animation timing. The earlier video and Apple-like opening/closing direction continue to guide motion.

### Apply the references selectively
- Keep the environment visible around the task. Use soft frosted surfaces whose tint fits the office, while ensuring text remains readable over both bright and dark backgrounds.
- Default assistance to a slim rounded question/input capsule with one short prompt. Expand only when the current answer or action requires more space.
- Expanded information replaces the compact state within the same interaction. Do not accumulate another modal, another panel, and a confirmation toast.
- Keep the centre available for the active document or model. Put temporary prompts in available space beside or below it, without covering text or selected locations.
- The reference's image-plus-description pair is useful only when both are necessary. Do not introduce two cards for every response or duplicate the active document in a second panel.
- Keep the single settings entry and single agent globe already specified. Do not copy the full side rails, bottom dock, zoom slider, clock, date, recording controls, or save hints merely because they appear in the examples.
- If an existing recording task is actively recording, show a small status indicator and an accessible stop action. Do not add recording or microphone permissions to unrelated tasks.
- Use one short contextual cue for the current task when needed; avoid leaving labels on every object at once.

### Interruption policy
| Situation | Behaviour |
|---|---|
| Reading, typing, or inspecting | Keep camera and layout stable; no unsolicited expanded panels or focus changes |
| Optional help | Keep it in the docked globe; open on user request |
| Required choice | Show the smallest sufficient inline choice control at the task boundary |
| Classification | Update the document tag; avoid an extra confirmation dialog |
| Saved successfully | Save silently; show recoverable error feedback if saving fails |
| Model running | Use one compact status; no fabricated progress or forced pause for decorative animation |
| Result ready | Update the existing result surface; let the learner choose when to inspect detail or continue |
| Expanded detail dismissed | Reverse into its origin; restore focus and the previous reading position |

Do not trigger assistance merely because time has elapsed. Do not repeatedly ask the same question or replay explanations on reopening. Queue nonessential updates while the learner is reading, editing, or using another control. Necessary errors and required decisions must remain discoverable and must not be silently discarded.

Keep classification efficient: show the relevant two choices in one compact surface when the learner enters the decision state. Do not insert a separate “Are you ready?” step before every document. Retain required script activities and offer concise detail on demand; minimal UI must not silently remove educational content.

### Additional review checks
- No unsolicited movement into the centre while reading or typing.
- At most one expanded assistant/detail surface at a time; the folder and its extracted paper remain the active task objects.
- A translucent surface never makes document text or controls hard to read.
- Dismissal does not lose drafted input, confirmed choices, or reading position.
- Reduced motion and keyboard focus work without requiring hover.
- Background remains visible; clocks, toolbars, and extra cards are not copied from the references without a functional reason.

## Later ZIP integration
Include this file as handoff/EXISTING_BUILD_UPDATE.md.
Include george_railean_ssspin.io_1795180267.mp4 under references/motion/ and identify it as the current environment/orbit reference. Older photographic office concepts are superseded for the environment backdrop; the earlier video still informs compact spatial panels.
Include the four user-supplied Bino UI references under references/ui/ with a note that they guide material, compact controls, and progressive disclosure, not simulation content or a requirement to copy every visible control.
Keep the latest written specifications authoritative and label older conflicting screenshots as superseded or illustrative.
Include approved new references only after review, alongside any actual patch made against the user’s current Claude project.
Do not describe this addendum alone as an implemented or tested application update.

