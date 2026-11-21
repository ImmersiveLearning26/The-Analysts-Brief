# Character portrait prompts (Higgsfield)

All characters are fictional. Use the same shared style block for every portrait so the set matches.
Output: square 1:1, at least 1024×1024. Save as PNG or WebP to `web/public/portraits/<file>`.

## Shared style block (append to every prompt)

> editorial portrait photograph, head and shoulders, centred, eye level, soft window light from the left, warm off-white seamless background (#f4f3ee), muted natural colour grade with a subtle warm tone, shallow depth of field, 85mm lens, calm dignified expression, realistic skin texture, no text, no logos, no watermark

**Negative prompt:** cartoon, illustration, 3D render, heavy makeup, glamour retouching, dramatic shadows, busy background, flags, insignia, text, watermark, extra fingers, distorted face

---

## 1. Dr Amina Diallo, Research Director: `diallo.png`

> West African woman in her late forties, the director of a government research unit, short natural hair with a few grey strands, thin dark-rimmed reading glasses, charcoal blazer over a simple ivory blouse, small gold stud earrings, attentive and quietly demanding look, the face of a mentor who expects rigour + [shared style block]

## 2. Hon. Grace Mwangi, Chair of the National Dialogue: `mwangi.png`

> East African woman in her late fifties, a senior stateswoman chairing a national peace dialogue, hair in a neat low bun, deep green tailored jacket with a patterned silk scarf, single strand of pearls, composed and authoritative but warm, slight evening warmth in the light + [shared style block]

*(For the chair-office scene, P12, you can make a second version with dusk lighting: replace "soft window light from the left" with "warm desk-lamp light, dusk blue window behind, out of focus". Save it as `mwangi_evening.png`.)*

## 3. Nana Efua, elder and oral historian: `efua.png`

> Ghanaian elder woman in her late seventies, a respected keeper of family history, close-cropped white hair, headwrap in faded indigo and ochre kente-inspired cloth, deep laugh lines, wise, patient gaze, simple cotton garment + [shared style block]

*(Optional archival variant for the source card: append "black-and-white 1950s documentary photograph, film grain, slightly faded print, square format". Save it as `efua_archive.png`. The source is her grandmother's 1958 recording, so this image would read as the grandmother.)*

## 4. Evidence 15: "The chief at the rally" press photo: `chief_rally.png`

Do NOT use the shared style block for this one.

> press photograph of a traditional chief at an election rally in a fictional West African country, elderly man in rich woven ceremonial cloth and beads, seated under a large patterned umbrella, a politician in a suit leaning in to greet him, a crowd behind holding generic unmarked placards, daytime harsh sun, newspaper photojournalism style, slight grain, 3:2 landscape, no readable text, no real party logos or flags

---

## Consistency tips

- Generate Diallo first, then reuse the same seed or style reference for the others so the lighting and grade match.
- Keep faces looking slightly off-camera to the right. The portraits sit at the left of the composer, so the characters will face into the text.
- Don't model any character on a real public figure.
