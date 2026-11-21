# SPEC: The Analyst's Brief, opener A, "One question, four rooms"

GOAL:    A first-time learner knows the four verbs of the course (Read, Test, Respond, Brief) and the title, and wants to start.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    24.0 s x 30 = 720 frames. No voiceover.

LOOK:    The game's own look, nothing invented.
         Ground: warm white #f4f3ee (office, hall), Orizon indigo radial (#5a3fd0 to #2b2070 to #15142a to #0d0d17) for Kalinda,
         dusk #12111a for the Chair's office. Miva ident on Miva navy #1f3a5f (the supplied logo is the white, reversed mark).
         Ink #1d2321 on warm, #f2f0fa on indigo or dusk. Tan kicker #a8763e (on dark: #c9a46a).
         Orange #ff7a1a: the giant room words on warm white and the Kalinda edge wall. Blue O mark #2f6bd8.
         TYPE (user review 21 Nov: heavy contrast, bigger, bold, centred): one giant centred room word per room, Afacad 700 caps,
         600 px (RESPOND 420 px), -3.5% tracking, BEHIND the 3D model (layer under the canvas) so the model stands in front of it,
         orange on warm white, warm white on indigo/dusk; Manrope 800 30 px kicker above it. Hook 150 px Afacad 700 centred;
         title 176 px centred under the globe, tagline Manrope 600 40 px, credit Manrope 800 28 px caps. Miva logo 460 px wide.
         Hero objects stand alone on the ground (the case file lifts off the desk as the office sinks; the Chair's props alone at dusk).
         Medium: the game's 3D models (office.glb, casefile.glb, kalinda.glb, hall.glb, chair_office_props.glb), a 28-degree lens,
         AgX tone mapping, the office HDR, a warm key against a cool fill, soft contact shadows. No bloom.
OBJECTS: the case file (a folder with a hinge cover and real pages), the Kalinda island map (government, barracks, radio mast,
         market, the orange edge wall, moving vehicles), the T-shaped hall with its planning table and chairs, the Chair's desk with the
         tape recorder and its red record light, the strands globe (the app's own shader).
MOTION:  Camera: one continuous move per room, sine.inOut; dives between rooms speed up into the cut (power2.in, last 9 frames)
         and settle out of it (power3.out, 18 frames). Type in: 14-frame power3.out rise of 24 px plus opacity. Type out: 8 frames power2.in.
         Close faster than open (the app's rule).
SHOTS:
  0-72     IDENT. Navy. The Miva logo rises 18 px and clears a mask from its baseline (18 f), holds. The navy lifts away upward (12 f) onto warm white.
  72-150   HOOK. Globe (300 px) left of centre, energy rising; "Kalinda is in crisis." types in to its right, 2 frames a character.
           The office cutaway rises from 1.2 m below into an iso view under the line. The globe shrinks to 76 px and parks bottom-centre.
  150-270  READ. The camera pushes from the iso wide to the desk. The case file cover opens (the authored clip), the top sheet slides right,
           and a blue O draws onto it in 10 frames. Kicker THE EVIDENCE, verb "Read." bottom-left.
  270-390  TEST. The camera dives down past the desk into indigo, then comes down out of the sky over Kalinda: the edge wall pulses,
           vehicles leave the barracks (the authored Coup clip at 3.3x). THE MODEL, "Test."
  390-495  RESPOND. A lift up from the map into warm white, down into the hall cutaway; the camera glides to the planning table, and
           an orange-ringed glass pin lands on it. THE HALL, "Respond."
  495-600  BRIEF. A push through to dusk: the Chair's desk under the lamp, the recorder; its red light comes on at frame 540.
           THE BRIEFING, "Brief."
  600-720  TITLE. The room pulls back into warm white; the globe rises to centre-left at 150 px, and the title builds beside it:
           "The Analyst's Brief", then "Check the evidence. Test the causes. Brief the Chair.", then "Miva Open University · IRS 103".
SOUND:   Silent, by the user's choice (21 Nov). The type and the pictures carry it alone.
BANNED:  The defaults in the skill's list, plus: numbered chapter labels (the app removed them in v3.2); a redrawn or recoloured Miva logo;
         the logo docked in a corner; people; drifting titles; glow rings around the globe; three cards in a row.
QA:      Frames 40 (ident), 120 (hook), 230 (blue O on the sheet), 340 (Kalinda with vehicles), 450 (hall pin), 560 (recorder light),
         700 (end card). Each: hero at 40% or more of the frame, text inside title-safe, nothing covering the hero.
