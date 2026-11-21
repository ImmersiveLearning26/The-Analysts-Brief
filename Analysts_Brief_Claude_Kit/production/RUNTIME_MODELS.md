> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Runtime models (exported 19 Nov 2026; case file and hall replaced 20 Nov 2026)

Files in `blender/production/export/`, produced by `blender/production/export_glb.py` from
`blender/production/analysts_brief_production.blend` (each scene is rebuilt by its `build_*.py` script).
Loaded back into Blender after export: all five import cleanly, every canonical node below is present, no texture is missing.

| File | Size | Drawn triangles | Kit budget | Load |
|---|---:|---:|---|---|
| `office.glb` | 6.42 MB | 71,722 | ≤150k | initial |
| `casefile.glb` | 2.48 MB | 1,541 | ≤5k | initial |
| `kalinda.glb` | 3.56 MB | 59,745 | ≤60k | initial |
| `hall.glb` | 3.14 MB | 37,758 | ≤150k | lazy (P09) |
| `chair_office_props.glb` | 1.24 MB | 16,474 | (with office) | lazy (P12) |

Initial download (office + case file + map + room HDR `office_env.hdr` 5.2 MB): **17.7 MB**, over the kit's 15 MB target because of the HDR (convert it to a smaller format if the budget matters). Without the HDR: 12.5 MB. All files are inside the kit's
triangle budgets (slimmed 19 Nov 2026):
- Office: Decimate modifiers on the copies of the heaviest Evidence Room pieces (metal case-file shelf 143k, bookcase,
  sideboard, wall cabinet, officer's chair, mug), applied at export; the shared source meshes are untouched.
- Map: city buildings/streets/trees reduced (0.05 / 0.2 / 0.06 - 0.035 broke the facades), one user kiosk per market
  cluster with container shops around it, coarser terrain grid (24 mm), fewer trees and village houses, lighter mast,
  pylons, watchtowers and trucks, edge line at half the points.

## Loader requirements
- Meshes are Draco-compressed (`KHR_draco_mesh_compression`): three.js needs `DRACOLoader` on the `GLTFLoader`.
- Textures are WebP (`EXT_texture_webp`), ≤2048 px. Also used: `KHR_texture_transform`, `KHR_materials_emissive_strength`,
  `KHR_materials_specular`, `KHR_materials_ior`, `KHR_materials_transmission` (hall only).
- No cameras or lights are exported. Cameras come from `blender/layout.json` (convert (x,y,z) -> (x,z,-y) once);
  lighting is set in three.js per state (office day, hall overcast, Chair office evening).

## Placement (Blender metres; GLTFLoader already converts orientation)
- `office.glb` at the origin. Its anchors: `HOTSPOT_CaseFile`, `ANCHOR_Folder`, `ANCHOR_PaperRead`, `ANCHOR_Map`, `ANCHOR_Recorder`.
- `casefile.glb` (`build_casefile.py`): the Evidence Room case file, re-labelled for the Commission (KAL/RU/2026/014, the
  police print painted out on a copy of the atlas), with 18 blank pages `CF_Page_01..18` (UV 0..1, painted at runtime
  from the evidence text). Put `CASEFILE_Root` at `ANCHOR_Folder` (-0.20, 0.15, 0.776), turned -0.07 rad about up.
  Measure it from base positions only: the folder's 210 morph targets inflate three.js bounding boxes.
- `kalinda.glb`: put `KAL_Root` at `ANCHOR_Map` (0, 0, 0.76); the base sits on the desk.
- `hall.glb` (`build_hall_lightmap.py`) at its own origin. It is the user's "Hall | Lightmap Test" (a T-shaped gallery,
  lighting baked into emission), with the planning table at the junction, the learner's seat in the stem and 18 chairs
  (16 residents in the arms, 2 officials). Paintings replaced by the Kalinda map (two views) and the Dialogue notice. `chair_office_props.glb` loads over `office.glb` for P12–P14.

## Clips
- `casefile.glb`: `CaseFile_OpenClose` (shape-key weights, 24 fps): open = frames 0-78, close = 92-168 (from the root's
  extras `sim_anim_open_frames` / `sim_anim_close_frames`). Played as segments, as in the investigation viewer.
- `kalinda.glb`: 13 looping clips: `KAL_EdgePulse_1..3_Loop` (10 s), `KAL_NetRing_1..3_Loop` (1.5 s),
  `KAL_NetPulse_<Government|Barracks|Market|City|Village1..3>_Loop` (2 s). Loop all; stop on Pause; first frame static
  under reduced motion. See `KALINDA_MAP_EFFECTS.md`.

## The app must do on load
- Hide `CHAIR_RecIndicator` (shown only while really recording):
  glTF has no visibility flag, so it arrives visible.
- Give `KAL_EdgeWall` its scrolling-band shader (UV u runs along the perimeter); the file carries a plain glowing
  translucent material.
- Rain on the office and hall windows is a runtime effect (the Blender rain sheets are preview-only and not exported).
- Document text is painted onto the case-file pages as canvas textures (`web/src/pages.js`); the same text is always
  available as HTML (Read as text, and the live region).

## What export changed (in the files only; Blender scenes keep their look)
- Terrain and woven hanging baked to images (`KAL_Terrain_Baked` 2048², hanging 256×512).
- Tinted / recoloured textures written into image copies (roads, wet grass, village/rock palette).
- Procedural plaster, paint, oak, manila and paper flattened to their base colours; sky flattened.
- The kiosk material's black glow map dropped (it also failed WebP conversion).

## Credits required where published (embedded source metadata)
CC-BY-4.0: city "chicken gun fruzer - city" (amogusstrikesback2); "Autumn Landscape" (alex.yefremov); "Whiteboards"
(Michael V); "Market Stall – Sleeping Dogs Universe" (Konstantin Koretskyi); "Early 90s Cassette-Corder Radio Free"
(John Logue); "Hall | Lightmap Test" (Pedro Silva); "Ministry of Foreign Affairs – Tiny Yerevan" (032sjapi); "3D design base transceiver station radio tower"
(Astroregal); "Isometric Office" (Companion_Cube); "Office – Assets" (SeverDoes3D).
**Sketchfab Standard licence (not CC; check terms before release):** "Game Landscape Tiles" (Shaina (Regan) Alvarez);
"Lowpoly buildings and structures collection" (badd).
The office and hall shells come from the user's Evidence Room project (`~/investigation assets`); check that project's
model licences before public release, as its README advises.
