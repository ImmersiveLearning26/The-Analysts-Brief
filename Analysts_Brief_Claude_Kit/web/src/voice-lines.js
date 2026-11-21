// Maps a character's on-screen line to its clip ids in public/audio/.
export const norm = (t) => String(t).replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const VOICE = [
  ["diallo_p02_brief", "Kalinda faces a disputed election"], ["diallo_voicenote", "Good morning. The Dialogue opens on Friday"],
  ["diallo_p03_hint", "Read each source. Mark it with a blue O"], ["diallo_evidence_ready", "That's every source, and your foundations hold"],
  ["diallo_evidence_thin", "You've decided on every source, but the background is too thin"], ["diallo_p04_good", "Good. Build the background on these"],
  ["diallo_p04_notyet", "Not yet. I need at least fourteen"], ["diallo_norun", "You haven't tested your explanation"],
  ["diallo_ending", "No analysis can promise a safe future"], ["mwangi_p09_hall", "Two district boundaries have changed"],
  ["mwangi_p12_sixty", "Sixty seconds. What do I tell the Dialogue"], ["mwangi_dialogue_strong", "This is a response we can defend in public"],
  ["mwangi_dialogue_fragile", "This will not hold."], ["mwangi_dialogue_mixed", "We will take most of this forward"],
];
const CONCERNS = ["Claims and facts are tangled", "The same voices dominate", "People doubt the Dialogue", "The rally grows"];
export function voiceIds(text) {
  const t = norm(text), hit = VOICE.find(([, s]) => t.startsWith(norm(s)));
  if (!hit) return [];
  if (hit[0] !== "mwangi_dialogue_mixed") return [hit[0]];
  const i = CONCERNS.findIndex((c) => t.includes(norm(c)));
  return i < 0 ? [hit[0]] : [hit[0], `mwangi_concern_${i}`];
}
