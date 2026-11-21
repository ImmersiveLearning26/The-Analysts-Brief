> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Motion, composer and one persistent orb

## Authority
Generated images are mood/composition guides and sometimes show inaccurate positions. This contract overrides them. One orb exists in the DOM for the full session. No second dormant orb remains in the corner while it is at the composer or map. The artwork may accidentally show a duplicate; do not replicate it.

## Dimensions at 1366 × 768
- Dock: 44 × 44 hit target, visual particles 28–32 px, top 20 px/right 24 px. Settings sits immediately left with an 8 px gap. Orb remains discoverable, never fully hidden offscreen.
- Composer: normal width 560 px, max viewport width minus 48 px; bottom 28 px, centre X. 22 px radius, 16–18 px padding, 54 px left inset for orb. Height 96–180 px; three long options may reach 220 px. No full-screen dialog for routine prompts.
- Field: 44–52 px high, text 16 px, thin neutral border, one circular send arrow with 44 px hit target. Multiline findings/briefing field grows to 140 px max, then scrolls internally.
- Surface: SharedLove #F7F7F8 at 94% opacity, 18 px blur, subtle white keyline and low shadow. Readability outranks transparency. Body #111113; accent #F28C38. Avoid luminous neon outline.
- Active orb stays at composer left. Computing orb at centre of model projection, visual 48–64 px max. No globe that obscures buildings.

## Orb lifecycle
| From → to | Trigger | Motion | Input during motion | Completion |
|---|---|---|---|---|
| Docked → alert | A new required prompt becomes available | One soft ring expands 32→52 px, opacity .18→0, 600 ms | Orb can be activated | Remains docked if user is reading |
| Alert → travelling | User taps orb OR first scene briefing begins | Translate dock to composer origin, 440 ms, ease-out | Other scene targets remain accessible unless camera also moving | Open composer |
| Travelling → expanded | Arrival | Composer slides up 16 px and fades in, 220 ms; width expands from 48→560 px over 260 ms | Focus moves to label/input after layout | Ready |
| Expanded → folded | Submit or dismiss | Field and copy fade 120 ms, surface narrows toward orb over 220 ms | Prevent duplicate submission only | Save exact validated action |
| Folded → docked | No immediate computation | Orb glides to upper right, 360 ms | Scene available immediately | Restore prior reading focus |
| Folded → working | Run test | Travel to projected map centre 360 ms; sphere→rounded cube→sphere particle morph, 900–1200 ms | Guard only repeat Run; offer Skip animation | Reveal deterministic result once |
| Working → expanded | Result ready | Move to lower composer, fade in result | Result controls accessible | User decides next action |

Do not call it “thinking” or imply a network AI request when a local rule runs. “Running the model” is accurate. The local result is computed immediately; the short animation communicates state and is skippable. Never make a long artificial loading wait. A real network call uses a different “Interpreting request” label and cancel/retry.

The ripple is local around the orb. If adding a screen-edge wash, opacity <= .06, single cycle, no flashing, no permanent bloom. Particles are 48–96 points at normal quality and static dots in reduced motion. Pause stops particle RAF, camera tweens, media and ambient loops together. No endless busy animation after errors.

## Physical interactions
| Object/action | Numbers and timeline | End state |
|---|---|---|
| Desk approach | 800 ms camera interpolation between named first-person poses, ease-in-out, no head bob | Eye at CAM_Desk |
| Folder open | 0→165° cover around long-edge hinge, 600 ms | Open on left |
| Paper extract | Lift 15 mm 120 ms; slide right 360 ms; rotate to 70° read tilt 220 ms overlapping slide | Stable readable HTML aligned over paper |
| Tag apply | Fade label 100 ms; press 1.0→.97→1.0 160 ms; subtle paper tick | Same tag remains on filed document |
| Paper return | Fade HTML 100 ms; lower and slide 300 ms; next sheet extract 360 ms only on Next | One active sheet; no autoplay past unread content |
| Folder review tabs | Crossfade active list 160 ms; selected tab 2 mm lift | Filtered papers, classification unchanged |
| Model activate | Folder closes 400 ms; gaze moves to model 700 ms, or model platform moves into reach | No simultaneous competing focus |
| Baseline/test headline | Fade outgoing 120 ms; incoming 180 ms; user advances | Same year maintained for comparison |
| Buildings | 1–2 mm settle/light change 300 ms; mast radio ring 600 ms on relevant headline | No geographical damage or missing pieces |
| Send findings | Up to source 3-second email/phone ritual; Skip equivalent | Single commit then Diallo reply |
| Hall transition | 300 ms fade out, day/location text 700 ms, 350 ms fade in; audio crossfade 600 ms | Seated CAM_Hall, no travel task |
| Submit response | Source 4-second rustle/Chair-confers ritual, skippable | Reaction shown for computed strand, then continue |
| Chair transition | 350 ms fade each side, evening light | CAM_ChairOffice |
| Brief/debrief sheet | Raise/tilt 400 ms | Learner text preserved exactly |

The reference `app/orb.mjs` implements persistent movement and particle morphing. `app/app.mjs` demonstrates state guards and commit paths. It is not a claim that every Blender clip or production audio behavior is implemented. Claude completes source clips, cancellation, animation skipping, unified pause and frame timing per this table.

## Accessibility and small screens
Honor OS and user reduced-motion settings: no spatial travel/morph; use <=100 ms opacity, same final state and same inputs. Every 3D hotspot has an HTML button. Dialog closes with Escape and returns focus. Paper readers and long optional notes may scroll internally; the surrounding scene does not. At 390 px use width calc(100vw − 24px), a single-sheet view with the folder minimized, and a bottom safe-area inset. Long options remain fully available without tiny text. Important feedback also uses aria-live. Keep voiced captions at least 18 px, separate from decorative document text.
