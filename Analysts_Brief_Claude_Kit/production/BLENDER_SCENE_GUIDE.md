> **Historical reference:** the 20 November spatial update supersedes older first-person-only environment, dark subtitle UI, bottom-centre globe and full-screen glow instructions. Read `handoff/CURRENT_DESIGN_CONTRACT.md` and `handoff/CONTINUE_IN_CLAUDE.md` from the kit root first. Generated images are approximate guides. Prior verification does not verify the updated `web/` build.

# Blender production guide

## Precise authority
Use `blender/layout.json` and the five orthographic plates for measured construction. Generated page images are suggestive: exact positions, proportions, furnishings, flags and UI pixels can be wrong. Use them for materials, restraint and first-person atmosphere only. The map outline in layout.json is a newly designed fictional symbolic base, not a geographic reference to an actual country.

## Coordinate convention
Blender metres, X right, Y into the room, Z up. Ground at Z=0. Parent roots scale 1, rotation 0. Apply source model scale before rigging. Export glTF Y-up; conversion of positions is (x,z,−y). Do not apply that conversion a second time to imported GLB scene nodes. JSON camera vectors are Blender-space and must be converted once for a Three.js camera.

Keep each environment in a separate .blend collection and export. Do not export cameras/lights into runtime objects unless deliberately used. Keep cameras in the source BLEND for review. Target runtime deliverables:
- `office.glb`: room shell, desk, window, restrained props.
- `folder.glb`: separate cover/hinge/back, paper stack, reusable extracted sheet.
- `kalinda.glb`: symbolic terrain, government, barracks, radio mast, four stalls, roads/river.
- `hall.glb`: shell and repurposed furniture.
- Chair office reuses office.glb with lighting/prop configuration, not another enormous asset download.

## Office
Room 6 × 5 × 3 m. Desk 1.80 × 1.10 m; top at .75 m centre with .04 m thickness. Folder local world position (−.20,.15,.776); moved 19 Nov 2026 from (−.45,−.05) with CAM_Document re-aimed to (.05,0,.98), because the old values left the folder below and left of the document view (P03 requires folder left, paper right). Keep the source isometric office as a furniture/shell donor. Rebuild missing wall faces visible from first person; a cutaway asset may not have them. Window on learner left, soft cool daylight; one warm low-intensity desk lamp. Remove distractors, certificates, TV posters and copyrighted-looking source textures from visible surfaces. Do not load every chair/prop just because it was supplied.

## Folder and tags
See plates 02/03. Cover 240 × 320 mm, spine .008 m envelope. Hinge along Y at X=−.12. A4 sheet .21 × .297 m, .4 mm physical thickness. Tags .046 × .018 m, .5 mm face thickness, 2 mm corner radius. Foundations sage; Set aside blue-grey. Add words and optionally different small glyphs so colour is not the only cue. Tags are flat edge labels, not wax seals, medals or badges.

Canonical nodes: FOLDER_Root, FOLDER_Hinge, FOLDER_Cover, FOLDER_Back, PAPER_01, PAPER_02, PAPER_03, TAG_Foundations, TAG_SetAside. Use one active extracted paper plus stack stand-ins, not 18 heavy meshes. Store all 18 evidence records in application data. Dynamic text is an HTML surface projected to the paper, never a baked image texture. Hide projected HTML during movement, reveal only when aligned; keep a normal DOM reading fallback.

The supplied `document_file_folder.glb` has an Anim clip and multiple page objects. Inspect before reusing; its duration and deformation have not been visually validated. The .16 MB `folder.glb` has a single mesh and no clips, so it cannot be assumed to open without separating geometry. The generated reference rig offers an original replacement if needed.

## Kalinda miniature
Base envelope 1.20 × .80 m, .025 m thick. Keep on desk at (0,0,.76): base rests directly on the desk surface (changed 19 Nov 2026 from .78, which floated the base above the Evidence Room desk). Reuse the supplied government model after simplifying and removing real location identifiers. The very small government file is a good candidate but not preapproved art. Build barracks from two generic low blocks and a simple fence if no suitable source structure is available. Radio tower source is a telecom-style mast: reuse visual structure as a symbolic communications landmark, not a literal claim about historic technology. Simplify to low polygon silhouette. Use the modular market pack for four stalls; the 147 MB stall asset is optional and excessive for a tabletop without aggressive reduction.

Canonical institutions and footprints are specified in layout.json. Keep a stable map across tests. F1/F5 integration, F4 economy, F2 army, F3/F6 governing rules and F7 diversity are concepts, not detachable geographic regions. Do not correlate a darker market with a numeric economic forecast unsupported by the rule set. Outcome headlines carry the conclusion.

## Hall from existing pieces
Shell 10 × 8 × 3.5 m; modest cream plaster, high windows, simple roof. Planning table centre (0,−2.1,.75), 2.4 × .8 m. Three rows of six chairs at the plotted centres with central aisle. Reuse suitable chairs/tables from office collection; generic replacements in reference geometry are allowed. Camera sits at front table, looking toward residents. Foreground stays clear for input overlay. No need for full school exterior, corridors, children, avatars or crowds with behavioral AI. Default minimum: hall shell + chairs + ambient crowd sound; distant static adult extras are optional polish.

## Chair office
Same office shell, evening lighting, lamp, paper stack, small recorder. Camera seat at (0,−1.15,1.2), looking to (0,.25,1.1). Chair is represented by the communication portrait, avoiding a need for a full human model. Warm light never darkens input text. Recorder uses a small red indicator only while actual recording is active.

## Camera table
All exact position/target/lens values are in layout.json. 35–45 mm lens on 36 mm sensor. No camera shake or head bob. CAM_OfficeEntry is standing 1.62 m. CAM_Desk/Document/ChairOffice are seated around 1.20 m. CAM_Model is a mild forward lean at 1.35 m, not aerial travel. CAM_Hall stays level at 1.20 m. Near plane .02 m; far 50 m. Test at 16:9 and narrow aspect ratios. Use object-fit/camera distance adjustments without changing the narrative viewpoint.

## Optimization and export
These are budgets to aim for, not measurements of supplied final assets: office/hall each <=150k triangles, map <=60k, folder <=5k, initial compressed download <=15 MB, total active textures <=2048 px each except exceptional close reads. Reuse atlas/materials; no 4K textures for tiny stalls. Bake static lighting where helpful, limit real-time shadows to one key light. Prefer instancing repeated chairs/stalls. Verify normals, material roughness, transparency sorting, UVs and finite bounds. Keep originals in source folder; optimize copies. No automatic deletion of user assets.

The included reference outputs are primitive construction geometry and are labelled as such. They prove dimensions, pivots and export naming. They do not match photorealistic concept materials or include a cleaned source model merge.
