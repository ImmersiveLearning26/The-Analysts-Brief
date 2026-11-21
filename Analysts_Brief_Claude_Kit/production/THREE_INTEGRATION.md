> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Connecting Blender to the application

`app/three-bridge.mjs` is dependency-injected with THREE and GLTFLoader. It is not activated by the default CSS stand-in harness. Claude should install/pin Three.js in the production project and verify its current official APIs. Load clean exports, never the entire source packs.

| View | Runtime node | Event | Guard/result |
|---|---|---|---|
| P02–03 | HOTSPOT_CaseFile | OPEN_CASE | Briefing complete; camera to desk |
| P03 | FOLDER_Hinge / Folder_Open | OPEN_FOLDER | Wait for open before extract |
| P03 | PAPER_01 | OPEN_DOCUMENT(id) | Valid content ID; text from JS |
| P03 | TAG_Foundations / TAG_SetAside | SET_TAG(id,value) | One visible; data persisted |
| P04 | Folder tab proxies | FILTER_DOCUMENTS(tag) | No reclassification |
| P05 | KAL_Base | ENTER_MODEL | Camera CAM_Model |
| P05–07 | HOTSPOT_KAL_* | INSPECT_INSTITUTION | Description only; never changes factor |
| P06 | Map projection + DOM orb | RUN_MODEL | Snapshot factor IDs; calculate once |
| P09–11 | Hall table | ENTER_HALL | CAM_Hall; climate retained |
| P12 | Recorder | REQUEST_MIC | Consent first |
| P14 | Memo | OPEN_DEBRIEF | Compute from committed strands |

The reference emits `analyst:state` on `go` and `analyst:tag` after tagging. In a production port, centralize every transition, including ritual completion, through a reducer and event dispatcher. P00–02 use CAM_OfficeEntry/Desk; P03–04 Document; P05–08 Model; P09–11 Hall; P12–14 ChairOffice. Convert JSON coordinates (x,z,−y) once; GLTFLoader already handles exported orientation.

Use `project` for readable HTML at paper anchors. Hide text during travel; reveal at rest with a screen-space fallback if the projected paper is too small. Never put the only accessible text in a texture. Every 3D hotspot has an equivalent HTML button.

On asset failure retain all controls and current text, offer Retry, preserve choices. Lazy-load hall, reuse office, dispose of old resources. Unified Pause must also pause the adapter, orb and media. This adapter has not been run against the final production exports; Claude must test model replacement, animation names, hit meshes and camera clipping.

## Exported runtime models (19 Nov 2026)
The production GLBs, their sizes, clips, canonical nodes, loader requirements and what the app must do on load are in `RUNTIME_MODELS.md`. Use `blender/production/export/`, not the primitive `blender/generated/` references.
