> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Page-by-page replication specification

**Every generated image is a guide only. Written dimensions, content and cameras take precedence.** Fifteen principal view states support four learning stages; they are not fifteen independent tasks. Exact content is in `app/content.mjs`; each state branch is in `app/app.mjs` render().

## P00 · Title

- Reference: `pages/P00_title.png` (concept, not a production screenshot).
- Camera: `CAM_OfficeEntry` from `blender/layout.json`.
- Learner action: Start or continue saved run.
- State and validation: No new work; saved run offers Continue and explicit Restart.
- Layout: Title centre; single Start; tiny corner controls.
- Exit: P01.
- Code: `app/app.mjs`, branch `P00`; shared style `app/style.css`, engine `app/engine.mjs`.

## P01 · Identity

- Reference: `pages/P01_identity.png` (concept, not a production screenshot).
- Camera: `CAM_Desk` from `blender/layout.json`.
- Learner action: Type name into compact composer.
- State and validation: Trim whitespace; 1–60 characters; preserve all other state.
- Layout: One text input; name never written by AI.
- Exit: P02.
- Code: `app/app.mjs`, branch `P01`; shared style `app/style.css`, engine `app/engine.mjs`.

## P02 · Declaration and situation briefing

- Reference: `pages/P02_situation_briefing.png` (concept, not a production screenshot).
- Camera: `CAM_Desk` from `blender/layout.json`.
- Learner action: Declare the role’s connection, hear/read Diallo, open case file.
- State and validation: Declaration persists; full transcript accessible; no quiz.
- Layout: Two sequential composer turns, same view. Portrait 48 px max; situation summary.
- Exit: P03.
- Code: `app/app.mjs`, branch `P02`; shared style `app/style.css`, engine `app/engine.mjs`.

## P03 · Document reading and tagging

- Reference: `pages/P03_document_reading.png` (concept, not a production screenshot).
- Camera: `CAM_Document` from `blender/layout.json`.
- Learner action: Read one source, select Foundations or Set aside, then Next.
- State and validation: 18 items; retain source and tag; allow retag before commit; claim feedback per source.
- Layout: Folder left, paper right. No extra tray. Short decision composer below paper.
- Exit: P04.
- Code: `app/app.mjs`, branch `P03`; shared style `app/style.css`, engine `app/engine.mjs`.

## P04 · Foundations review

- Reference: `pages/P04_foundations_review.png` (concept, not a production screenshot).
- Camera: `CAM_Document` from `blender/layout.json`.
- Learner action: Review retained/set-aside sources; open case notes.
- State and validation: At least 14/16 reliable items retained and both claims decided; commit S1.
- Layout: Folder tabs filter; lightweight summary sheet, optional scrollable record.
- Exit: P05.
- Code: `app/app.mjs`, branch `P04`; shared style `app/style.css`, engine `app/engine.mjs`.

## P05 · Case notes and model choices

- Reference: `pages/P05_kalinda_choices.png` (concept, not a production screenshot).
- Camera: `CAM_Model` from `blender/layout.json`.
- Learner action: Read seven notes/base headlines; select factors and confirm alternatives.
- State and validation: Seven IDs, binary states. Exact changed setting shown before run. Baseline remains available.
- Layout: Miniature is primary. One condition selector at a time, current-change summary on demand.
- Exit: P06 or P08.
- Code: `app/app.mjs`, branch `P05`; shared style `app/style.css`, engine `app/engine.mjs`.

## P06 · Model running

- Reference: `pages/P06_model_running.png` (concept, not a production screenshot).
- Camera: `CAM_Model` from `blender/layout.json`.
- Learner action: Watch brief particle morph or skip animation.
- State and validation: Snapshot selection; compute once; duplicate Run blocked; no score mutation on animation skip.
- Layout: Composer folds. Orb 48–64 px maximum above model. Result cannot be lost on reload.
- Exit: P07.
- Code: `app/app.mjs`, branch `P06`; shared style `app/style.css`, engine `app/engine.mjs`.

## P07 · Headlines and comparison

- Reference: `pages/P07_model_results.png` (concept, not a production screenshot).
- Camera: `CAM_Model` from `blender/layout.json`.
- Learner action: Step through five dated headlines; compare same year across runs.
- State and validation: Append immutable test record. Compare preserves selected year. No result invented by LLM.
- Layout: One headline at a time; comparison drawer optional. Do not put five cards around map.
- Exit: P05 or P08.
- Code: `app/app.mjs`, branch `P07`; shared style `app/style.css`, engine `app/engine.mjs`.

## P08 · Findings and Diallo reply

- Reference: `pages/P08_findings.png` (concept, not a production screenshot).
- Camera: `CAM_Model` from `blender/layout.json`.
- Learner action: Choose up to three factors; type a sentence; send.
- State and validation: Select 1–3; nonempty sentence; no-run reminder can be bypassed; set S2/climate.
- Layout: Small chip selector and composer. Reply appears as short separate turn, then Continue.
- Exit: P09.
- Code: `app/app.mjs`, branch `P08`; shared style `app/style.css`, engine `app/engine.mjs`.

## P09 · School hall briefing

- Reference: `pages/P09_hall_briefing.png` (concept, not a production screenshot).
- Camera: `CAM_Hall` from `blender/layout.json`.
- Learner action: Read/hear Chair and climate-dependent press reaction.
- State and validation: Uses S1/S2; budget 9/8/7; crisis details available without a second folder task.
- Layout: Eye-level from planning table. No walking, no extra evidence sorting.
- Exit: P10.
- Code: `app/app.mjs`, branch `P09`; shared style `app/style.css`, engine `app/engine.mjs`.

## P10 · Response choices

- Reference: `pages/P10_response_choice.png` (concept, not a production screenshot).
- Camera: `CAM_Hall` from `blender/layout.json`.
- Learner action: Choose one setting for each of five levers.
- State and validation: Three options each; stable IDs, session-stable random display order; revise before submit.
- Layout: One lever at a time in composer. Tiny time/choice summary. Previous/Next maintain choices.
- Exit: P11.
- Code: `app/app.mjs`, branch `P10`; shared style `app/style.css`, engine `app/engine.mjs`.

## P11 · Test, rationale and Dialogue reaction

- Reference: `pages/P11_response_results.png` (concept, not a production screenshot).
- Camera: `CAM_Hall` from `blender/layout.json`.
- Learner action: Run test; inspect words; revise; write trade-off/uncertainty rationale; submit.
- State and validation: All five set + nonempty rationale; compute latest choices; over budget is consequence; commit S3.
- Layout: Result strip/sheet is separate from small input composer. Four words, no score dashboard.
- Exit: P12.
- Code: `app/app.mjs`, branch `P11`; shared style `app/style.css`, engine `app/engine.mjs`.

## P12 · Chair’s request

- Reference: `pages/P12_chair_briefing.png` (concept, not a production screenshot).
- Camera: `CAM_ChairOffice` from `blender/layout.json`.
- Learner action: Choose record or typed briefing.
- State and validation: No mic permission until explicit record consent; explain retention.
- Layout: Same office assets, evening light. Recorder on desk. Chair portrait, one short line.
- Exit: P13.
- Code: `app/app.mjs`, branch `P12`; shared style `app/style.css`, engine `app/engine.mjs`.

## P13 · Briefing and review

- Reference: `pages/P13_briefing_review.png` (concept, not a production screenshot).
- Camera: `CAM_ChairOffice` from `blender/layout.json`.
- Learner action: Record/stop/play/delete/re-record OR type; review four topic indicators; send.
- State and validation: About 60 seconds target, untimed; unscored. STT absent means check unavailable, never blocked send.
- Layout: Compact composer; longer draft in expandable writing surface. No automatic rewriting.
- Exit: P14.
- Code: `app/app.mjs`, branch `P13`; shared style `app/style.css`, engine `app/engine.mjs`.

## P14 · Debrief and restart

- Reference: `pages/P14_debrief.png` (concept, not a production screenshot).
- Camera: `CAM_ChairOffice` from `blender/layout.json`.
- Learner action: Read three strands and forward view; open why/record/reflection; restart.
- State and validation: Count Strong strands; no briefing grade; retain submitted record until restart confirmation.
- Layout: One physical memo; deeper explanations on demand, no giant dashboard.
- Exit: End or P00/P01.
- Code: `app/app.mjs`, branch `P14`; shared style `app/style.css`, engine `app/engine.mjs`.

## Shared substates (same scene, no extra compulsory activity)

| Substate | Parent | Visual behavior | Controls and exit |
|---|---|---|---|
| Role declaration | P02 | One short composer turn before Diallo | Declare → briefing |
| Original transcript | P02/P09/P12 | Readable optional drawer | Close/Escape restores origin focus |
| Claim note | P03 | Small margin flag on current document | Retag or next; no correctness banner |
| Filter empty | P03/P04 | “No documents with this tag yet” | All tab remains available |
| Case note | P05 | One readable note surface | Seven note tabs; Close returns to exact model settings |
| Confirm interpretation | P05 | Base→alternative text, then Confirm | Edit/Cancel without state mutation |
| Comparison | P07 | Base and selected test at same year | Change run/year; close |
| Diallo reply | P08 | Portrait + short source-defined response | Continue to hall, or review already-submitted results read-only |
| Hall package summary | P10/P11 | Five chosen settings in a summary surface | Edit a lever; return to same package |
| Dialogue reaction | P11 | Source-defined Chair line | Continue regardless of strength |
| Recording permission denied | P12/P13 | One explanatory sentence | Type instead always available |
| Recording live | P13 | Small red dot and elapsed duration, no countdown | Stop; never start without consent |
| Recording review | P13 | Compact audio player | Play/Delete/Retry/Send; transcript optional |
| Settings/pause | All | Small optional settings drawer | Sound, captions, reduced motion, Pause/Resume |
| Save/asset error | All | Non-blocking status | Retry; text controls still function |
| Restart confirmation | P00/P14 | Small confirmation dialog | Cancel preserves work; Restart clears run only |

## Focus and persistence
Name, role declaration, document tags, runs, conditions, findings, climate, hall choices/tests, rationale, typed briefing, reflection and preferences persist in a versioned save. Pending animation is never a saved authoritative state. Store committed decisions separately from editable drafts in production. Audio stays local until consent to save/upload; the reference keeps its Blob in memory only and states that limitation.

Browser refresh resumes at the last stable state. Back/Undo only edits unsubmitted choices; inspecting an earlier stage after submission is read-only. Fast repeated clicks cannot create duplicate tests or skip required inputs. All critical text is semantic HTML, safely escaped; enter/space supports every action. Invalid input gets a nearby explanation rather than silence.

## Responsive authority
At 1366 × 768, no page scroll. Physical page may occupy a larger central reading region while the agent composer stays compact. At 390 × 844, hide the folder body, keep document and controls stacked, and allow internal scrolling of long notes. Keyboard opening must not hide Send; use visualViewport/safe-area handling in production. The included reference permits internal reading/composer scroll as a functional fallback.
