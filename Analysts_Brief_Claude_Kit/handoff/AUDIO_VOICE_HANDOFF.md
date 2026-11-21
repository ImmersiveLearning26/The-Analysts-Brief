# Character voice audio: handoff for Lovable

**Status (2026-11-21, done):** Lovable generated every line in §4 plus the opener music bed. The files are in `web/public/audio/` (23 mp3s), the text-to-clip map is `web/src/voice-lines.js`, and the player, globe pulse, Voice toggle and opener music are wired in `web/src/main.js`.

---

## 1. Goal

When a cast member speaks in the composer, the learner hears the line in that character's voice, and the **AI globe pulses with the speech audio**. That means real loudness, not a fake envelope. The on-screen text stays as the transcript.

## 2. Tooling

- **ElevenLabs text-to-speech**, model `eleven_multilingual_v2`, output `mp3_44100_128`.
- **Pre-render every line to a static file** in `web/public/audio/`. Never call the API from the browser: that would put the key on the client and add a delay before each line.
- Settings: stability 0.55, similarity 0.75, style 0, speaker boost on, speed 0.95.

## 3. Voices (from the ElevenLabs voice library)

| Character | First choice | Alternative |
|---|---|---|
| Dr Amina Diallo, Research Director (West African, measured mentor) | **Pastie – Warm Nigerian Storyteller** `y47FZICqt6oFf4Z89DXT` | Nana – Warm Nigerian storyteller `QQswKXAu7aQVNxKFmOP8` |
| Hon. Grace Mwangi, Commission Chair (East African stateswoman) | **Maryanne – Soulful, calm and empowering** `hrMENUPSbAbVQk6jkV5k` | Wanjiku – Kenyan `CPIbwf9ux0uflGaU9jf1` |

Confirm the choice with the designer before generating every line. Generate one sample per voice first.

## 4. Line list

The ID is both the file name (`web/public/audio/<id>.mp3`) and the lookup key. The text must match `web/src/main.js` / `app/engine.mjs` word for word. If the copy changes, regenerate that line.

### Dr Amina Diallo
| ID | Where | Text |
|---|---|---|
| `diallo_p02_brief` | P02 | Kalinda faces a disputed election, clashes at the Crossing, rumours of an army mutiny and a corruption scandal. Check the evidence, test the causes, then recommend a response. |
| `diallo_voicenote` | P02 "Full transcript" panel (play button) | Good morning. The Dialogue opens on Friday, and everyone has a theory about how we got here. I need three things from you this week: a background section I can trust, a test of the explanations people are offering, and a response we can defend. Start with the sources. Use what is reliable and tell me what you set aside. And please note in your file that you grew up near the Crossing. It is an interest, not a disqualification. |
| `diallo_p03_hint` | P03 first-time hint | Read each source. Mark it with a blue O to keep it in Foundations, or a red X to set it aside. The next one comes up by itself. |
| `diallo_evidence_ready` | P03 all decided, enough kept | That's every source, and your foundations hold. Ready to build the background? |
| `diallo_evidence_thin` | P03 all decided, too few kept | You've decided on every source, but the background is too thin. Most of these are sourced: keep at least fourteen in Foundations. Look again at the ones you set aside. |
| `diallo_p04_good` | P04 ready | Good. Build the background on these. |
| `diallo_p04_notyet` | P04 not ready | Not yet. I need at least fourteen sourced pieces in Foundations, and a decision on both claims. |
| `diallo_norun` | P08, findings sent before any model run | You haven't tested your explanation on the model yet. Run a test first, or send your findings as they are? |
| `diallo_ending` | Final screen | No analysis can promise a safe future. Good analysis can show what is known, what is not, and what to do next. |

`diallo_evidence_thin`: the on-screen text includes "You have N." The audio deliberately leaves the number out. Do not record count variants.

### Hon. Grace Mwangi
| ID | Where | Text |
|---|---|---|
| `mwangi_p09_hall` | P09 | Two district boundaries have changed. Residents fear weaker representation; officials cite new population figures. Test a response we can explain and carry out. |
| `mwangi_p12_sixty` | P12 (chair office, evening) | Sixty seconds. What do I tell the Dialogue in the morning? |
| `mwangi_dialogue_strong` | Dialogue response, Strong | This is a response we can defend in public and carry out. The Dialogue will adopt it. |
| `mwangi_dialogue_fragile` | Dialogue response, Fragile | This will not hold. We have to start again from the evidence. |
| `mwangi_dialogue_mixed` | Dialogue response, Mixed (prefix) | We will take most of this forward. One concern goes back to you: |
| `mwangi_concern_0` … `_n` | Mixed: the concern that follows | One file per *negative* sentence in `situation()` in `app/engine.mjs` (index = situation row). Play it straight after `mwangi_dialogue_mixed`. |

Lines from Reception, "The model", "Your file" and "Your findings" are UI text, not characters. Leave them silent.

### Voice-answer questions (the globe reads these in voice mode)
Each input bar has a mic button. When it's pressed, the globe grows at the lower centre, reads the question, then listens and transcribes the learner's answer into the field (`voiceMode()` in `main.js`). Until these files exist, the browser's built-in voice reads the question. Use a neutral narrator voice for the globe, not a cast voice.

| ID | Form | Text |
|---|---|---|
| `q_identity` | P01 name | Welcome. What should we call you? |
| `q_findings` | P08 findings | Which factors best explain what happened? Say why, using your tests. |
| `q_rationale` | P11 trade-offs | What trade-offs and uncertainties remain? |
| `q_brief` | P13 briefing | Sixty seconds. What do you recommend the Chair tells the Dialogue in the morning? |

The text lives on each form as `data-question`, and the ID as `data-voice`. Keep them in sync. `speakQuestion()` already loads `public/audio/<id>.mp3` and drives the globe from it, so nothing else needs wiring.

## 5. Wiring (web app)

1. **Manifest:** add a `VOICE` map in `main.js` that maps a line ID to its file. Pass the ID to `speaker()` (for example `speaker(name, role, "mwangi_p09_hall")`) so the composer knows which clip belongs to which line.
2. **Playback:** one shared `<audio>` element feeding a Web Audio `MediaElementSource` → `AnalyserNode` (fftSize 512) → destination. Create or resume the `AudioContext` on the first user gesture (browser autoplay rules).
3. **Timing with the portrait intro:**
   - On a character's first appearance, `portraitIntro()` shows the large face with the globe parked beside it. **Start the audio when the face lands at full size**, so the voice is coming from the globe beside her.
   - The docking and composer reveal then carry on as now, while the line keeps playing.
   - On later lines (no intro), start the audio when the words begin streaming in (the `.w` animation start, about 620 ms after the composer appears).
4. **Globe pulse:** each animation frame while audio is playing, read the RMS from `getByteTimeDomainData`, smooth it (attack about 60 ms, release about 180 ms), and call `orb.level(v)` (it already exists in `agent.js`, 0…1) with `orb.listen(true)`. On `ended`, call `orb.level(0); orb.listen(false)`. This replaces the fixed-length `orb.speak(ms)` envelope while audio is playing. Keep `speak()` as the fallback when audio is muted or missing.
5. **Interruptions:** if a new composer line replaces the current one, fade the current clip out over 120 ms and start the new one. Pages stop the audio on navigation.
6. **Settings:** add a "Voice" on/off toggle, on by default, saved with the existing settings. When it's off, nothing plays and the globe uses `speak()`.
7. **Reduced motion:** audio still plays, but cap the globe pulse amplitude at 0.35.
8. **Missing file:** if a file fails to load, the line silently falls back to text plus `speak()`. It must never block the flow.
9. **Accessibility:** captions are already on screen (the composer text). Add an aria-live note "Playing voice line" only if the screen-reader text differs from the composer text.

## 6. Done when

- Every ID in §4 exists as an mp3 in `web/public/audio/`, generated with the chosen voices.
- The globe visibly pulses with syllables and pauses, and is still when the line ends.
- On each character's first appearance, the voice starts while the large portrait is on screen with the globe beside it.
- Muting, reduced motion and missing files all degrade cleanly.
- Test with `?dev=1&sandbox`. A plain URL overwrites the learner's saved run.
