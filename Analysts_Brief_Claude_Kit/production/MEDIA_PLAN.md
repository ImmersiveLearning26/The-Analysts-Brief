# Characters, generation instructions and audio

The playthrough pictures are visual guides only. Do not use their inconsistent portrait crops as final identity references. Produce and approve one clean portrait per speaking colleague, then reuse it. No character videos or 3D human rigs are required for this design.

## Character appearances
| Character | Role | First appearance | Reuse | Minimum media |
|---|---|---|---|---|
| Dr Amina Diallo | Research Director / supervisor | P02 briefing | P08 feedback, P14 closing | One portrait; original briefing; three conditional replies; closing line |
| Hon. Grace Mwangi | Commission Chair | P09 hall briefing | P11 package reaction; P12 request; P14 final reply | One portrait; brief lines and three conditional responses |
| Nana Efua | Elder quoting grandmother | P03 evidence item E05 only | Replay in evidence/notebook | One short recording + transcript; portrait unnecessary |
| Learner | Junior analyst, connection to Crossing | P01/P02 | Entire playthrough | No model, no external body/face, no mandatory visible hands |
| Residents | Environmental atmosphere | P09–11, optional | Hall only | Off-camera murmur sufficient; distant adults optional |

## Clean portrait prompts
Generate each separately, 1024 × 1024, natural photographic skin detail, soft neutral grey background, chest-up eye-level, no text/logos/UI. Fictional Black African adult, no likeness to a real public figure. Keep eyes approximately 42% down image so 48 px circular crops work.

DIALLO: “Fictional Black African woman, approximately 45, short natural tightly curled hair, charcoal tailored jacket over an ivory blouse, calm approachable analytical expression, direct eye-level portrait, soft window lighting, realistic documentary photograph, restrained professional styling, neutral grey background, no jewellery emphasis, no text.”

MWANGI: “Fictional Black African woman, approximately 55, neatly shaped short natural hair, deep green professional jacket over a warm ivory top, composed measured expression, distinct face from Diallo, direct eye-level portrait, soft window light, realistic documentary photograph, neutral grey background, no text.”

Once approved, assign `diallo_portrait.webp` and `mwangi_portrait.webp`; use those exact files everywhere. Do not regenerate on every screen. No portrait image must obscure source text. Display at 40–48 px beside the speaker label. Optional expanded portrait no larger than 96 px.

## Environment/art production
The 15 image prompts are in PAGE_IMAGE_PROMPTS.md. Those are concepts, not final static backgrounds. Actual scene geometry comes from Blender; do not bake controls into environment textures. If producing fallback backgrounds, render clean office, desk, model, hall and Chair views without text/UI/portraits from the final Blender scene so camera continuity is exact. Render 1920 × 1080, export WebP plus lossless archival PNG. Avoid generative signage, flags and invented national emblems.

Map and tag orthographic plates are already supplied as precise plotted PNG/SVG. Rebuild from numeric geometry, not by tracing the generative perspective image. Preserve identical map shape and institution positions across every test. Office material look: matte plaster, oak, softly worn paper; not glossy toy plastic or sci-fi chrome.

## Original S1 briefing (source transcript)
Dr Diallo, calm warm Nigerian English delivery, natural pace; approximately 30–40 seconds depending on voice:
“Good morning. The Dialogue opens on Friday, and everyone has a theory about how we got here. I need three things from you this week: a background section I can trust, a test of the explanations people are offering, and a response we can defend. Start with the sources. Use what is reliable and tell me what you set aside. And please note in your file that you grew up near the Crossing. It is an interest, not a disqualification.”

The interest acknowledgement appears as a simple composer turn, not a request for private real-life political disclosures.

Nana Efua, older woman, warm unhurried Nigerian English, light archive texture without obscuring speech:
“My grandmother said the king never decided alone. The council spoke first.”

## Other spoken lines
- P05 Diallo: use the S2 email text from source p9; it can remain text-only to reduce repeated narration. Do not read all seven notes automatically.
- P08 Diallo: use `content.diallo[Strong|Mixed|Fragile]` verbatim. Only the selected branch plays.
- P09 Mwangi: “We have limited time and resources. Test the package before you bring it to the Dialogue.” The summary gives the context; full scenario is in Details. Press voice reads only `content.press[climate]`.
- P11 Mwangi: use `dialogue(result)` source response. For Mixed include the actual adverse indicator’s sentence.
- P12 Mwangi: “Sixty seconds. What do I tell the Dialogue in the morning?”
- P14 Mwangi: `content.chair[forwardIndex]`.
- P14 Diallo closing: “No analysis can promise a safe future. Good analysis can show what is known, what is not, and what to do next.”

Generate once and reuse. Voices must sound distinct, gender-matched, natural African English; Nigerian delivery is the proposed production direction. Never caricature accents. No narration for every click. Runtime spoken material should remain under roughly three minutes on a typical path, as in the source.

## Audio and files
Proposed filenames: `diallo_intro.mp3`, `nana_e05.mp3`, `diallo_strong.mp3`, `diallo_mixed.mp3`, `diallo_fragile.mp3`, `mwangi_hall_intro.mp3`, `press_calm.mp3`, `press_strained.mp3`, `press_hostile.mp3`, `mwangi_response_strong.mp3`, `mwangi_response_fragile.mp3`, selected Mixed indicator variants, `mwangi_brief_request.mp3`, `mwangi_final_f1.mp3` through f3, `diallo_closing.mp3`.

Effects: restrained paper slide, folder fold, soft tag tap, single phone buzz, quiet radio click. Ambience: office rain, hall distant murmur + tin-roof rain, evening quieter rain. No music required. If added later, keep unobtrusive and duck below speech. Pause must stop all audio and motion. Skip finishes the current message without skipping the decision. Replay available. Caption toggle separate from sound; captions default on, 18 px minimum, transcript available. Missing audio falls back immediately to text; no blocked progress.

This handoff contains prompts and transcripts, not generated voice files, videos or approved isolated character portraits. Claude should generate approved portraits and audio only as the production step, using the user’s configured services. The simulation remains functional without paid media or live AI.
