# Review: opener A, "One question, four rooms" (21 Nov 2026)

## Creative calls
- Storyline A (chosen by the user). B ("The headline that changes") and C ("The globe's eye") were not built; see ../STORYLINES.md.
- The supplied Miva logo is the white, reversed mark, so the ident sits on Miva navy #1f3a5f instead of recolouring the logo. It is 460 px wide, reduced at the user's request.
- User review (21 Nov): heavy contrast, bigger, bold and centred type. Each room is now one giant centred word behind its 3D model (orange #e05a00 on warm white, 3.36:1; warm white on indigo or dusk). Hero objects stand alone on the ground: the case file lifts off the desk as the office sinks away, and the Chair's props stand alone at dusk.
- Silent, by the user's choice. No music or effects.

## Measured vs looked at
- `check`: no errors. Remaining warnings:
  - `nested_structure_needs_subcomposition` (world and globe canvases): kept. Both are driven by `hf-seek` from global time in the root, which a scene file cannot do with ES-module Three.js.
  - `canvas_content_at_edge` (bottom): kept. Kalinda and the desk props run off the bottom edge on purpose, so the words above them stay clear.
  - `film_silent`: kept by choice.
- Looked at: review beats, the four seams, the phone sheet, plus extra snapshots of every room and the hook-to-READ seam after it was fixed. Every room word reads in full at 360 px.
- Not checked: the full-speed playback feel (only stills and strips were viewed). The MP4 has not been rendered.

## Weakest shot
TEST: the indigo map sits low and cropped under the word, so it reads more as a plinth than as the hero. With more time: a closer, lower orbit that brings the barracks vehicles to the foreground while keeping the word clear.

## Fixes made in this pass
- t=4.4–5.2 s · hook to READ · the camera flew into the office walls → the office now sinks 4 m between 4.35 and 4.95 s and hides; the folder lifts out cleanly.
