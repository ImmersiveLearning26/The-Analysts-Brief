# Kalinda map: scale, assets and looping effects (updated 19 Nov 2026)

## One map scale: 1:450
Every real-world object uses the same scale (user instruction: "let the scaling be proper"). The 1.2 x 0.8 m base
shows 540 x 360 m. A 12 m house is 27 mm, a car 11 mm, a 9 m tree 20 mm, a 2.8 m kiosk 6 mm, the main road ~5 m,
the river 13.5 m. Two source files state no real size, so real sizes were chosen: radio mast 90 m, footbridge 16 m.
The road bridge's 16.6 m four-lane deck was narrowed to a 7 m two-lane deck on its true 35 m span.
The capital city sits east of the government compound, turned 90 deg; the government building (85 m) is at true scale.

Built by `blender/production/build_kalinda.py` from the user's assets. Copies only; no source file is written.

| Element | Source asset |
|---|---|
| Capital city: buildings, streets, city trees | `The Analyst’s Brief/chicken_gun_fruzer_-_city (1).glb` (CC-BY-4.0, amogusstrikesback2, sketchfab.com/3d-models/chicken-gun-fruzer-city-3fafd2e8275c457382fe497fcdf1c789; ammo boxes, embedded photos and sub-mm props removed; credit required where published) |
| Ground textures (grass, earth, cobble path) | `The Analyst’s Brief/game_landscape_tiles.glb` |
| Pines, rounded crowns (recoloured green), bushes, wooden footbridge | `~/Downloads/autumn_landscape.glb` |
| Barracks, watchtowers, walls, gate, pads, generator, road bridge, houses, barn, well, fences, water tanks, container shops, pylons + lines, vehicles, military trucks, street lamps, rocks | `~/Downloads/lowpoly_buildings_and_structures_collection.glb` |
| Market kiosks | `~/Downloads/market_stall__sleeping_dogs_universe.glb` |
| Government, radio mast, fruit crates | kit `assets/source` |

Generated from layout data only: terrain shape, river and road ribbons (they follow `layout.json`), and the effect geometry below.
Triangle count is about 92k against the kit's 60k aim (the city is ~21k after heavy reduction; dense donors are decimated on the copies). Further cuts trade away detail.

## Looping effects (60 fps; runtime loops every clip; reduced motion shows the first frame, static)
- `KAL_EdgeWall`: translucent band 13 mm above the terrain edge. UV u = distance along the perimeter (0..1), v = height.
  The Blender preview drives moving light bands with `frame/600`; the runtime reproduces it by scrolling a band
  texture or shader along u (one full lap every 10 s, 28 bands). Accent #F28C38.
- `KAL_EdgeLine`: constant bright line along the wall top.
- `KAL_EdgePulse_1..3` (clips `KAL_EdgePulse_n_Loop`, 10 s): light pulses running round the edge, a third apart.
- `KAL_NetRing_1..3` (clips `KAL_NetRing_n_Loop`, 1.5 s): signal rings expanding from the mast top, staggered.
- `KAL_NetLink_*` + `KAL_NetPulse_*` (clips `KAL_NetPulse_*_Loop`, 2 s): arcs from the mast to each institution and
  village with packets running along them.
Pause stops these with all other motion. They are decoration: they never encode a result or a score.

## Outcome animation (added 20 Nov 2026, `blender/production/build_kalinda_sim.py`)
No people. Run after `build_kalinda.py` in the production file, then export Kalinda only (`export_glb.py` with
`EXPORTS` narrowed to `kalinda.glb`). Clips `KAL_Sim_<Coup|Rule|Consolidation>__<object>`, 10 s at 60 fps,
2 s per simulated year (Year 2 at 2 s ... Year 10 at 10 s). Time 0 is the untouched map (helpers at scale 0).
- Coup (9 clips): army trucks drive barracks gate -> main road -> a clear route through the capital (A* over
  ray-cast city ground) -> government forecourt; jeeps hold checkpoints at the bridge and market; red tower beacons.
- Rule (11): warm light shaft and spreading ring at the government; radio-mast-to-government link; banners rising.
- Consolidation (18): civilian vehicles drive the roads; awnings unfold over the stalls; village lights come on.
Runtime (`web/src/world.js` `simShow`): one outcome at a time; the run plays 0 -> 10 s in 3.3 s; the result screen
glides to 2 + 2 x year. Illustrates the engine's outcome only; never decides it. Previous GLB: `export/kalinda_before_sim.glb.bak`.
