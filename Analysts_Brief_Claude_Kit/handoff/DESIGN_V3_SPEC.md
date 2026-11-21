# The Analyst’s Brief — Design v3 spec (20 Nov 2026)

Source: the user’s direction after the first browser run, plus the references in `design/current_references/`
(Fuselab apartment model, Airbnb/Orizon diorama, Bino glass UI) and the user’s own editorial type system in
*The Fashion Illustration Workbook* (Nasara Studios). This spec supersedes the screen layout in
`CURRENT_DESIGN_CONTRACT.md` (upper-right globe, right-hand composer). Content, scoring, saved-run schema and the
straight front-facing document rules from that contract still apply.

Goal: it should feel designed by an Apple designer who thinks like a motion-graphics artist. Icons do most of
the talking, text appears when asked for, and nothing covers the model.

## 1. Layout: three zones that never compete

| Zone | Desktop (≥ 1024px) | Purpose |
| --- | --- | --- |
| **Preview** | Rounded box (radius 28px), inset 20px, from the left edge to about 74% of the width | The model, shown like a Sketchfab viewer. Its own studio background, lighting and shadow. |
| **Rail** | Right 340px column, inset 20px | Context, as icons first. Hovering an icon reveals its label and detail. Status (sources tagged, year) as small meters. |
| **Agent** | Globe at the bottom centre of the preview; the conversation grows up out of it | The only place that talks. A ChatGPT- or Claude-style input card that expands to fit what it has to say. |

- The view capsule (zoom, top view, reset) stays as icons inside the preview's left edge.
- The model is framed into the free part of the preview. When the conversation opens, the model reframes up and
  slightly smaller, so the card never sits on it (reference: Fuselab reframing when its panel opens).
- Phones: the preview fills the screen, the rail becomes an icon row at the top and the conversation a bottom sheet.

## 2. Material: iOS-style liquid glass

- Light glass: white at 30–45% with `backdrop-filter: blur(24px) saturate(180%)`, a 1px inner highlight on the top
  edge, a faint darker lower edge and a soft long shadow. Over the dark simulation stage the same glass turns smoky
  (white at 8–12%).
- Shapes: capsules for controls, 22–28px radii for cards, circles for icon buttons. One radius family throughout.
- No hard borders and no heavy drop shadows. Depth comes from blur and highlight.

## 3. Type hierarchy (from the workbook)

| Role | Style |
| --- | --- |
| Kicker | Manrope 600, 11px, uppercase, tracking 0.2em, warm tan `#a8763e` |
| Title and headers | Afacad 600 (user’s choice, 20 Nov), 22–30px, with optional italic accent; also the evidence-sheet titles |
| Body | Manrope 400, 14.5px / 1.55, ink-2 |
| Meta | Manrope 500, 12px, ink-3; numbers in tabular figures, sections numbered 01, 02 … |
| Rules | Hairline 1px at 12% ink to separate, never boxes inside boxes |

Everything is left-aligned. Each card shows at most kicker + title + one short line. Detail goes on hover or
expansion.

## 4. Icons

Phosphor, **bold** weight, 20px in 44px targets. Every icon has an accessible name. Its label reveals on hover or
focus with an iOS-style lift (scale 1 → 1.08, label slides out 8px with opacity, 220ms ease-out; 120ms back).

## 5. Labels that never cover the model

- In the scene, a point of interest is a small glass dot (12px) with a soft pulse ring once, never a text label.
- Hover or focus a dot (or its matching rail icon): the object highlights, corner brackets draw around its screen
  box (the "boxy vector" motion from Fuselab), then a dotted leader line draws out to the nearest empty margin.
  A glass callout card appears there with kicker / title / one line. Sequence: highlight 0ms → brackets 0–180ms →
  line 120–360ms → card 300–520ms (staged, ease-out). Leaving reverses in about half the time.
- Occasionally (at most once per scene, after about 8s idle) a Bino-style question capsule floats up near a relevant
  object, e.g. "What does the Barracks stand for?". Click to open its callout; it dismisses itself after 6s.

## 6. Agent: globe and conversation

- The globe is hidden until the agent has something to say. It pops up at the bottom centre (scale 0.6 → 1,
  spring-like `cubic-bezier(.32,.72,0,1)`, 420ms).
- The conversation card morphs out of the globe like the Dynamic Island: a clip from a 56px circle to the full card
  (420ms), then its content fades up in staged order (speaker, line, input, actions; 40ms apart).
- It grows to fit its content (max 46% of the viewport height, scrolling inside). Collapsing reverses into the
  globe in 240ms.
- Thinking (P06 and any computation): the globe changes form. The strands tighten into a ring and spin up, the glow
  rises and the globe scales to 1.12. It settles back when done.

## 7. Preview look (Sketchfab quality)

- Studio background inside the preview: a soft radial gradient (light neutral for the office and hall) with a
  ground contact shadow under the model.
- Lighting: one warm key, a cool fill and rim; practical lights that actually glow (desk lamp, ceiling fixtures)
  with gentle bloom; ambient occlusion on. Filmic tone, slightly higher contrast than now.
- Walls read as solid: the cut faces show a flat cap colour (cross-section look) instead of a hollow plane.
- Idle: no auto-spin. Transitions reframe on smooth arcs (450–700ms).

## 8. Background colour (answer to the user)

Pure white is not the best choice for the 3D: it flattens the model and gives the shadow nothing to sit on. Use a
warm neutral page (`#ecebe6`) with a lighter studio gradient inside the preview for the office, hall and Chair’s
office. For the test-simulation phase (Kalinda, P05–P08), switch the whole stage to the Orizon look: a deep
near-black to indigo gradient (`#0d0e17` → `#1b1640` → `#3a2a8a` glow at the bottom). This tells the learner
"you are inside the model now", and the miniature glows against it the way the Fuselab apartment does on navy.

## 9. Orizon test-simulation phase

- Entering P05: the office cross-dissolves into the indigo stage (700ms). A thin-line emblem (two concentric arcs
  around the word "Kalinda", 1px strokes) draws itself with stroke-dashoffset, holds 600ms, then the map rises into
  the preview as the emblem fades.
- P06 (running the test): the map dims to 40%, the arcs redraw around the globe as a progress ring, and year ticks
  (Year 2, 4, 6, 8, 10) light in sequence. Capped at 1.4s total; the engine result is unchanged.
- Leaving the model phase reverses into the warm studio.

## 10. Build order

1. Layout shell, glass tokens, type scale, icons (preview box, rail, view capsule restyle).
2. Agent at the bottom centre: globe pop, Dynamic Island morph, expanding composer, model reframes above it.
3. Scene dots with highlight → brackets → leader line → callout; rail icons with hover reveal; question capsule.
4. Preview look: studio gradient, contact shadow, lighting, bloom, wall caps.
5. Globe thinking morph and the Orizon simulation phase.

Each step is verified in a real browser at 1366×768 and 390×844 before the next.

## 11. v3.1 — user review, 20 Nov (implemented)

| Request | Implementation |
| --- | --- |
| Paper must be legible | Reading view zooms onto the extracted sheet (~86% of preview height); the folder peeks in from the left. |
| Foundations / Set aside as office pins | Blue pin = Foundations, red pin = Set aside. Hover lifts the pin and slides its name out; choosing presses it in with a spring, the other pin steps back. |
| Strong hover contrast | One accent: orange `#ff7a1a` with white glyphs for every hover/selected state and focus ring. |
| Hide the developer page switcher | Hidden by default; Cmd/Ctrl+Shift+H shows or hides it (remembered per device). |
| Collapse the chapter card | A compact pill (icon, chapter, title); hover, focus or click expands it. Connector line removed. |
| Cards announce, then get out of the way | On a new chapter or info card the rail opens for ~5s, then shrinks to tags and the model reframes to the full preview. |
| No pop-ups in the middle | Settings, Notebook, feedback and every other detail open as a panel in the rail under the chapter card. |
| Agent input like Claude's | The card sizes to its content (380–640px); inputs grow as you type. |
| The agent should feel like it communicates | Each new line: the globe thinks (~0.5s), then words arrive one by one while it pulses with speech. |
| The globe should visibly think | A glowing shell morphs circle → rotated square → blob → circle with a hue drift and pulse, plus the orbiting arcs. |
| Springy, fluid motion (CleanMyMac-like) | `--spring` / `--spring-pop` (CSS `linear()`) on panels, pills, pins, callouts, capsule, conversation; children follow through. |
| Pop-ups feel off | Callouts and the question capsule are now a near-black HUD (white type, orange kicker, orange brackets/leader) that springs out of the leader's end. |
| Response package layout | Numbered grid: lever label / choice (bold) / round edit button; tested view shows level badges; time meter in a footer. |
| Camera liveliness | Front / top / isometric buttons; choosing a factor glides to its institution and points it out; after 18s idle the camera tours the points of interest; any input stops it. |
| See the simulation | The Blender-authored loops (edge pulses, mast rings, network packets) play in the model chapter; a test run energises them while the camera arcs around the map under a light Orizon HUD; the result is then spotlit. No people. |

Still to do: outcome-specific authored animation in Blender (vehicles along roads, market stalls, lights by year and outcome, no people), a hall/Chair visual pass, and consolidating `styles.css` + `spatial.css` into `v3.css`.

## 12. Hall and Chair pass (20 Nov, implemented)
- Per-scene light moods (`world.js` MOODS). Hall: less added light because the model carries baked lighting.
  Chair's office: Thursday evening, with the desk lamp as key, cool window spill, low ambient, a dusk-amber stage and dark glass UI.
- Hall: one uniform section cut at 1.3 m through all walls and doors (plan-model look for the T-shaped room); paintings
  hidden; framed 1.3x closer; deeper warm-grey studio; softer contact shadow.
- Chair desk points: Recorder (record your briefing) and Notebook (type it); each does what its button does.
- Response plan options are wrapped radio cards with the lever as an Afacad question; announced as radios.
- Debrief strands are numbered rows with Strong / Mixed / Fragile badges, readable in light and dark themes.
- Phones: the view capsule stands vertically on the left so it no longer collides with the tool icons.

## 13. v3.2 — user review, 21 Nov (implemented)
- Chapter pill shows icon + title only (no "Chapter 02 of 06", no counts); counts removed from callouts.
- Tools merged into one quiet button (dots-nine); hover/focus unfolds Notebook, Feedback, Settings, Pause with a spring stagger.
- Rail cards dock flush to the right screen edge (rounded left corners, square right).
- Tag marks: blue O = Foundations, red X = Set aside, as pen marks on paper chips (draw-on when chosen) and drawn on the sheet.
- Office walls: the sand plaster normal map (read as stains) replaced by clean matte plaster, before the cutaway shader.
- Scene dots no longer pulse; the focused callout has a thin thread of light travelling round its edge.
- Cover: title and buttons vertically centred left; the office larger on the right; the camera swings slowly (±50°, ~26 s).
- Blinking dots (after React Bits "Blinking Dots", built natively in Three.js) in every 3D scene: jittered two-layer
  field around the model, size-driven colour ramp per scene, gentle twinkle, slow drift, cursor parallax.
- Hall: near walls (seen from behind) open down to a 12 cm sill; far walls cut at 1.6 m.
- Reading view: the extracted sheet is measured on screen each frame and zoom/pan steer it to ~86% of the preview
  height, just right of centre; any user zoom/pan releases the lock.
