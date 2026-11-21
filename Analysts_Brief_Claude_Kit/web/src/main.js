// The Analyst's Brief: production app shell. Ported from the kit's reference app (app/app.mjs) with the 3D world.
// Content and rules are the kit's own modules (single source, covered by verification/rules.test.mjs).
import { content as C } from "@kit/app/content.mjs";
import * as E from "@kit/app/engine.mjs";
import layout from "@kit/blender/layout.json";
import { voiceIds, norm } from "./voice-lines.js";
import { createWorld } from "./world.js";
import { createMarkers } from "./markers.js";
import { createTrays } from "./trays.js";
import { createReel } from "./reel.js";
import { icon } from "./icons.js";
import "@fontsource-variable/afacad/wght.css";          // titles and headers (Manrope stays for body text)
import "@fontsource-variable/afacad/wght-italic.css";
import { AgentGlobe } from "./agent.js";
import { Strands } from "./strands.js";

const $ = (s) => document.querySelector(s);
const stage = $("#stage"), panel = $("#composer"), drawer = $("#drawer"), reader = $("#reader"), stampsEl = $("#stamps"), countEl = $("#pageCount"), menuEl = $("#agentMenu");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// ?sandbox keeps a separate saved run, so testing never overwrites the learner's own progress (same browser, same site)
const KEY = new URLSearchParams(location.search).has("sandbox") ? "analysts-brief-sandbox" : "analysts-brief-prod-v1";
const DEV = new URLSearchParams(location.search).get("dev") === "1";

const fresh = () => ({
  version: 1, page: "P00", name: "", interest: false, tags: {}, doc: 0, filter: "all", selected: [], runs: [], year: 0,
  findings: [], why: "", choices: {}, lever: 0, hallRuns: [], rationale: "", brief: "", reflection: ["", "", ""],
  settings: { sound: true, voice: true, captions: true, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches },
  order: C.levers.map((l) => [...l.options].sort(() => Math.random() - 0.5).map((o) => o.id)), strands: [],
});
let state = fresh();
try {
  const loaded = JSON.parse(localStorage.getItem(KEY));
  if (loaded?.version === 1) state = { ...fresh(), ...loaded, page: "P00", resumePage: loaded.page === "P06" ? "P05" : loaded.page };
} catch { /* first run */ }

let busy = false, paused = false, recorder, stream, recordingURL = "", audioBlob;
let world = null, markers = null, trays = null, reel = null;
// The current task's pins only. A pin does what clicking its object does (see hotspot()).
function pinsFor(p) {
  const kal = (n, q) => ({ id: `institution:${n}`, label: n, kicker: "Institution", title: n, line: INSTITUTIONS[n],
    meta: "Symbolic. Looking never changes a test.", question: q, get: () => world?.node("kalinda", `KAL_${n}`) });
  if ((p === "P02" && state.interest) || p === "P03") return [{ id: "caseFile", label: "Case file", kicker: "KAL/RU/2026/014", title: "The case file",
    line: "Eighteen sources on Kalinda. Open it to read and tag them.",
    question: "What’s in the case file?", get: () => world?.node("casefile", "CASEFILE_Root") }];
  if (["P05", "P07", "P08"].includes(p)) return [kal("Government", "Who makes the rules here?"), kal("Barracks", "What does the Barracks stand for?"), kal("Radio"), kal("Market")];
  if (["P09", "P10", "P11"].includes(p)) return [{ id: "hallTable", label: "Planning table", kicker: "Tamarind Crossing", title: "The planning table",
    line: "Where the Dialogue agrees a response it can explain and carry out.", question: "What happens at this table?", get: () => world?.node("hall", "HALL_PlanningTable") }];
  if (["P12", "P13"].includes(p)) return [
    { id: "recorder", label: "Recorder", kicker: "The Chair’s desk", title: "Record your briefing", line: "About sixty seconds, in your own words. Nothing leaves this device.", question: "Shall I record it?", get: () => world?.node("chair", "CHAIR_Recorder") },
    { id: "notebook", label: "Notebook", kicker: "The Chair’s desk", title: "Type your briefing", line: "Write what the Chair should tell the Dialogue in the morning.", get: () => world?.node("chair", "CHAIR_Notebook") }];
  return [];
}
const orb = new AgentGlobe($("#agent"), $("#aiGlow"), $("#world"));

// ---------------------------------------------------------------- persistence + announcements
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { status("Saving is unavailable in this browser. Keep this tab open."); } }
function announce(t) { $("#live").textContent = t; }
let statusTimer;
const INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>';
function status(t, retry, title = "Note") {
  const s = $("#toast");
  s.innerHTML = `<i aria-hidden="true">${INFO}</i><div><b>${esc(title)}</b><span>${esc(t)}</span></div>` + (retry ? `<button type="button" data-action="${retry}">Retry</button>` : "");
  s.classList.remove("on"); void s.offsetWidth; s.classList.add("on");
  clearTimeout(statusTimer); if (!retry) statusTimer = setTimeout(() => s.classList.remove("on"), 4200);
}

// ---------------------------------------------------------------- small UI helpers
const b = (label, action, arg = "", cls = "") => `<button type="button" class="${cls}" data-action="${action}" data-arg="${esc(arg)}">${label}</button>`;
const row = (...items) => `<div class="row">${items.join("")}</div>`;
// v3.3 input bar (Claude/ChatGPT-style): globe on the left, the field, then voice and send on the right.
const ibar = (field, sendLabel, disabled = false, tools = "") => `<div class="ibar${tools ? " ibar--tools" : ""}"><span class="ibar-globe" aria-hidden="true"></span>${field}${tools}<button type="button" class="ibar-mic" data-action="voice" aria-label="Answer by voice">${icon("mic")}</button><button class="primary ibar-send" aria-label="${sendLabel}" ${disabled ? "disabled" : ""}>${icon("send")}</button></div>`;
// Cast portraits live in public/portraits (prompts: design/PORTRAIT_PROMPTS.md). Until a file exists the
// avatar shows the speaker's initials; on the chair scene Mwangi tries her evening portrait first.
const PORTRAITS = { "Dr Amina Diallo": "diallo", "Hon. Grace Mwangi": "mwangi", "Nana Efua": "efua" };
function portraitFail(img) { const alt = img.dataset.alt; if (alt) { img.dataset.alt = ""; img.src = alt; } else img.remove(); }
window.__portraitFail = portraitFail;
const speaker = (name, role) => {
  const file = PORTRAITS[name];
  if (!file) return `<p class="who">${name}<span> · ${role}</span></p>`;
  const base = `${import.meta.env.BASE_URL}portraits/`;
  const evening = file === "mwangi" && document.body.dataset.scene === "chair";
  const src = evening ? `${base}mwangi_evening.jpg` : `${base}${file}.jpg`;
  const alt = evening ? `${base}mwangi.jpg` : "";
  const initials = name.replace(/^(Dr|Hon\.)\s+/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
  return `<div class="who-row"><span class="avatar" aria-hidden="true"><b>${initials}</b><img src="${src}" data-alt="${alt}" alt="" onerror="__portraitFail(this)"></span><p class="who">${name}<span> · ${role}</span></p></div>`;
};
// Portrait intro: the first time a face appears it arrives large over the frame, holds, then flies into the
// composer's avatar slot; the composer (name, line, options) is held paused until it lands. Once per image.
const seenPortraits = new Set(); window.__portraitSeen = seenPortraits;   // dev: __portraitSeen.clear() replays intros
let introRun = null;
function portraitIntro() {
  const img = panel.querySelector(".avatar img");
  const src = img?.getAttribute("src");
  // The composer often re-renders while the face is up; same face → keep flying, just hold the new content too.
  if (introRun && introRun.src === src) { panel.classList.add("holding"); if (introRun.arriving) panel.classList.add("arriving"); return; }
  introRun?.cancel();
  if (!img || state.settings.reduced || seenPortraits.has(src)) return;
  const probe = new Image(); probe.src = src;
  panel.classList.add("holding");
  let dead = false, hero = null;
  const agentEl = $("#agent"); let globeAnim = null;
  const finish = () => { if (dead) return; dead = true; hero?.remove(); globeAnim?.cancel(); panel.classList.remove("holding"); introRun = null; };
  introRun = { src, cancel: finish };
  probe.decode().then(async () => {
    if (dead) return;
    seenPortraits.add(src);
    const f = $("#frame").getBoundingClientRect();
    const size = Math.min(f.height * 0.62, f.width * 0.5, 440);
    hero = document.createElement("div"); hero.className = "portrait-hero"; hero.setAttribute("aria-hidden", "true");
    hero.style.cssText = `left:${f.left + (f.width - size) / 2}px;top:${f.top + (f.height - size) / 2 - f.height * 0.04}px;width:${size}px;height:${size}px`;
    hero.append(probe); document.body.append(hero);
    // The globe glides up beside the face so the voice has a visible source; it rides back down as she docks.
    const ar = agentEl.getBoundingClientRect(), hx = f.left + (f.width - size) / 2, hy = f.top + (f.height - size) / 2 - f.height * 0.04;
    const gap = 22 + ar.width / 2, right = hx + size + gap, left = hx - gap;
    const tx = right + ar.width / 2 < f.right - 12 ? right : left, ty = hy + size - ar.height / 2 - 6;
    const gx = tx - (ar.left + ar.width / 2), gy = ty - (ar.top + ar.height / 2);
    globeAnim = agentEl.animate([{ translate: "-50% 0" }, { translate: `calc(-50% + ${gx}px) ${gy}px` }],
      { duration: 640, delay: 120, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    orb.speak(1700);
    await hero.animate([{ opacity: 0, transform: "scale(.9)", filter: "blur(14px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
      { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }).finished;
    await new Promise((r) => setTimeout(r, 950));
    if (dead) return;
    const slot = panel.querySelector(".avatar"); if (!slot) return finish();
    const h = hero.getBoundingClientRect(), t = slot.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (h.left + h.width / 2), dy = t.top + t.height / 2 - (h.top + h.height / 2), k = t.width / h.width;
    panel.classList.add("arriving"); introRun.arriving = true;
    globeAnim.cancel();
    globeAnim = agentEl.animate([{ translate: `calc(-50% + ${gx}px) ${gy}px` }, { translate: "-50% 0" }],
      { duration: 680, easing: "cubic-bezier(.65,0,.2,1)", fill: "forwards" });
    await hero.animate([{ transform: "none", borderRadius: "32px" }, { transform: `translate(${dx}px,${dy}px) scale(${k})`, borderRadius: `${h.width / 2}px` }],
      { duration: 680, easing: "cubic-bezier(.65,0,.2,1)", fill: "both" }).finished;
    panel.classList.remove("arriving");
    finish();
  }).catch(finish);
}
// Panel headings that name a cast member get the same round portrait (no fly-in: the composer owns that).
function personHead(name, sub) {
  const file = PORTRAITS[name.replace(/^Grace Mwangi$/, "Hon. Grace Mwangi")];
  const base = `${import.meta.env.BASE_URL}portraits/`;
  const initials = name.replace(/^(Dr|Hon\.)\s+/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
  const av = file ? `<span class="avatar" aria-hidden="true"><b>${initials}</b><img src="${base}${file}.jpg" alt="" onerror="this.remove()"></span>` : "";
  return `<div class="person-head">${av}<h2>${name} · ${sub}</h2></div>`;
}

// ---- globe in the input bar, and voice mode -------------------------------------------------------------
// When the composer holds an input bar, the globe sits in its left slot (followed every frame while it moves).
let dockRaf = 0;
function dockGlobe() {
  cancelAnimationFrame(dockRaf);
  const follow = () => {
    const slot = panel.querySelector(".ibar-globe");
    const on = !!slot && !panel.classList.contains("empty") && !panel.classList.contains("folded") && !document.body.classList.contains("voice-mode");
    document.body.classList.toggle("globe-inline", on);
    if (!on) return;
    const r = slot.getBoundingClientRect(), root = document.documentElement.style;
    root.setProperty("--ax", `${r.left + r.width / 2}px`); root.setProperty("--ay", `${r.top + r.height / 2}px`);
    dockRaf = requestAnimationFrame(follow);
  };
  follow();
}
let voiceRun = null;
function voiceUI() {
  let el = $("#voiceUI");
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", `<div id="voiceUI" role="dialog" aria-label="Voice answer" aria-live="polite"><p class="vq"></p><p class="vt"></p>
      <div class="vrow"><button type="button" class="vbtn" data-v="cancel" aria-label="Cancel voice answer">${icon("close")}</button><button type="button" class="vbtn primary" data-v="done" aria-label="Done speaking">${icon("check")}</button></div></div>`);
    el = $("#voiceUI");
    el.addEventListener("click", (e) => { const v = e.target.closest("[data-v]")?.dataset.v; if (v) voiceRun?.stop(v === "done"); });
  }
  return el;
}
function levelMeter(source, ctx) {   // feeds the globe from any audio node; returns a stop()
  const an = ctx.createAnalyser(); an.fftSize = 512; source.connect(an);
  const buf = new Uint8Array(an.fftSize); let v = 0, raf = 0;
  const tick = () => {
    an.getByteTimeDomainData(buf); let sum = 0; for (const x of buf) { const d = (x - 128) / 128; sum += d * d; }
    const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4.2), k = rms > v ? .45 : .12;   // quick attack, slow release
    v += (rms - v) * k; orb.level(state.settings.reduced ? Math.min(v, .35) : v); raf = requestAnimationFrame(tick);
  };
  tick();
  return () => { cancelAnimationFrame(raf); orb.level(0); try { source.disconnect(an); } catch {} };
}
let voiceCtx = null;

// ---------------------------------------------------------------- character voice lines (public/audio/<id>.mp3)
// A spoken line is matched by its on-screen text, so the composer copy stays the single source.
const linePlayer = { el: null, src: null, stopMeter: () => {}, token: 0 };
function stopLine(fade = 120) {
  const a = linePlayer.el; linePlayer.token++;
  linePlayer.stopMeter(); linePlayer.stopMeter = () => {}; orb.listen(false);
  if (!a || a.paused) return;
  const v0 = a.volume, t0 = performance.now();
  const src = a.src;
  const step = (n) => { if (a.src !== src) return; const k = Math.max(0, Math.min(1, (n - t0) / fade)); a.volume = Math.max(0, Math.min(1, v0 * (1 - k))); if (k < 1) requestAnimationFrame(step); else { a.pause(); a.volume = 1; } };
  requestAnimationFrame(step);
}
function playIds(ids, fallbackText, delay) {
  stopLine();
  if (!ids.length) return;
  const token = linePlayer.token;
  const fallback = () => { if (token === linePlayer.token) orb.speak(Math.min(6000, 200 + norm(fallbackText).split(" ").length * 320)); };
  if (state.settings.sound === false || state.settings.voice === false) return;
  setTimeout(() => {
    if (token !== linePlayer.token) return;
    let i = 0;
    const next = () => {
      if (token !== linePlayer.token) return;
      if (i >= ids.length) { linePlayer.stopMeter(); linePlayer.stopMeter = () => {}; orb.level(0); orb.listen(false); return; }
      let a = linePlayer.el;
      if (!a) { a = linePlayer.el = new Audio(); a.preload = "auto"; }
      a.volume = 1; a.src = `${import.meta.env.BASE_URL}audio/${ids[i++]}.mp3`;
      a.onended = next; a.onerror = () => { linePlayer.stopMeter(); fallback(); };
      try {
        const c = ctxNow();
        if (!linePlayer.src) { linePlayer.src = c.createMediaElementSource(a); linePlayer.src.connect(c.destination); }
        linePlayer.stopMeter(); linePlayer.stopMeter = levelMeter(linePlayer.src, c); orb.listen(true);
      } catch {}
      a.play().catch(() => { linePlayer.stopMeter(); fallback(); });
    };
    next();
  }, delay);
}
function voiceLine(root, delay = 620) {
  const p = [...root.querySelectorAll("p:not(.who):not(.muted)")].find((el) => voiceIds(el.textContent).length);
  if (!p) return;
  playIds(voiceIds(p.textContent), p.textContent, state.settings.reduced ? 0 : delay);
}
const ctxNow = () => { voiceCtx ??= new (window.AudioContext || window.webkitAudioContext)(); voiceCtx.resume?.(); return voiceCtx; };
// Reads the question: a generated clip (public/audio/<id>.mp3, made later in Lovable) or, until then, the browser's voice.
function speakQuestion(text, id) {
  return new Promise((done) => {
    if (state.settings.sound === false) return done();
    const a = new Audio(`${import.meta.env.BASE_URL}audio/${id}.mp3`); let stop = () => {};
    const end = () => { stop(); orb.listen(false); done(); };
    a.onended = end;
    a.onerror = () => {
      if (!("speechSynthesis" in window)) return done();
      const u = new SpeechSynthesisUtterance(text); u.rate = .96; u.lang = "en-GB";
      orb.speak(Math.max(1500, text.length * 62)); u.onend = () => done(); u.onerror = () => done();
      speechSynthesis.cancel(); speechSynthesis.speak(u); voiceRun && (voiceRun.cancelSpeech = () => speechSynthesis.cancel());
    };
    a.oncanplay = () => { const c = ctxNow(); const src = c.createMediaElementSource(a); src.connect(c.destination); stop = levelMeter(src, c); orb.listen(true); a.play().catch(end); };
    if (voiceRun) voiceRun.cancelSpeech = () => { a.pause(); end(); };
  });
}
function placeVoiceGlobe() {
  const f = $("#frame").getBoundingClientRect(), root = document.documentElement.style;
  root.setProperty("--ax", `${f.left + f.width / 2}px`); root.setProperty("--ay", `${f.bottom - Math.min(240, f.height * .3)}px`);
}
// ---- P01 welcome: the conversation bubble comes first. The globe asks for a name, a glass field rises under it,
// and on submit the field shrinks back into the bubble before the story moves on. The composer form underneath
// stays the fallback (and receives the name), so nothing depends on this layer.
let welcomeRun = null;
async function welcomeMode() {
  if (welcomeRun || voiceRun) return;
  const form = panel.querySelector('form[data-form="identity"]'); if (!form) return;
  const ui = voiceUI(), q = form.dataset.question || "Welcome. What should we call you?";
  let done = false, rec = null, silence = 0;
  const pill = document.createElement("form"); pill.className = "vin"; pill.setAttribute("aria-label", "Your name");
  pill.innerHTML = `<input name="welcomeName" maxlength="60" autocomplete="given-name" placeholder="Your name" aria-label="Your name" value="${esc(state.name)}"><button type="button" class="vin-voice" aria-label="Say your name">${icon("mic")}</button><button class="vin-send primary" aria-label="Continue">${icon("send")}</button><small class="vin-help" aria-live="polite"></small>`;
  const input = pill.querySelector("input"), help = pill.querySelector(".vin-help");
  const stop = (keep) => {
    if (done) return; done = true; clearTimeout(silence); try { rec?.stop(); } catch {}
    voiceRun?.cancelSpeech?.(); orb.listen(false);
    document.body.classList.remove("voice-mode", "welcome-mode", "voice-listening"); pill.remove(); welcomeRun = null;
    if (!keep) dockGlobe();
  };
  welcomeRun = { stop };
  ui.querySelector(".vq").textContent = q; ui.querySelector(".vt").textContent = "";
  cancelAnimationFrame(dockRaf); document.body.classList.remove("globe-inline");
  placeVoiceGlobe(); document.body.classList.add("voice-mode", "welcome-mode"); orb.place("prompt");
  await new Promise((r) => setTimeout(r, state.settings.reduced ? 0 : 480));
  if (done) return;
  await speakQuestion(q, form.dataset.voice);
  if (done) return;
  ui.append(pill); setTimeout(() => pill.classList.add("in"), 20);
  setTimeout(() => input.focus({ preventScroll: true }), state.settings.reduced ? 0 : 260);
  pill.querySelector(".vin-voice").onclick = () => {          // say it instead of typing
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { help.textContent = "Voice answers aren't available in this browser. Type your name instead."; return; }
    try { rec?.stop(); } catch {}
    rec = new SR(); rec.lang = "en-GB"; rec.interimResults = true; orb.listen(true); document.body.classList.add("voice-listening");
    rec.onresult = (e) => { input.value = [...e.results].map((r) => r[0].transcript).join(" ").trim(); clearTimeout(silence); silence = setTimeout(() => { try { rec.stop(); } catch {} }, 1600); };
    rec.onend = rec.onerror = () => { orb.listen(false); document.body.classList.remove("voice-listening"); input.focus({ preventScroll: true }); };
    try { rec.start(); } catch { orb.listen(false); }
  };
  pill.onsubmit = (e) => {
    e.preventDefault();
    const n = input.value.trim();
    if (!n) { help.textContent = "Enter a name of 1 to 60 characters."; input.focus(); return; }
    form.querySelector("#name").value = n.slice(0, 60);
    pill.classList.add("absorb"); orb.speak(500);                    // the field folds back into the bubble
    setTimeout(() => { stop(true); form.requestSubmit(); }, state.settings.reduced ? 0 : 460);
  };
}

async function voiceMode() {
  const form = panel.querySelector("form"), field = form?.querySelector("textarea, input[name]");
  if (!form || !field || voiceRun) return;
  snapshotDrafts();
  const ui = voiceUI(), q = form.dataset.question || "", base = field.value.trim();
  ui.querySelector(".vq").textContent = q; ui.querySelector(".vt").textContent = "";
  cancelAnimationFrame(dockRaf); document.body.classList.remove("globe-inline");
  placeVoiceGlobe(); document.body.classList.add("voice-mode"); orb.place("prompt");
  let rec = null, stream = null, stopMeter = () => {}, silence = 0, finished = false, heard = "";
  const exit = (keep) => {
    if (finished) return; finished = true;
    voiceRun?.cancelSpeech?.(); clearTimeout(silence); try { rec?.stop(); } catch {} stopMeter(); stream?.getTracks().forEach((t) => t.stop());
    orb.listen(false); document.body.classList.remove("voice-mode", "voice-listening"); voiceRun = null;
    if (keep && heard.trim()) { field.value = (base ? base + " " : "") + heard.trim(); field.dispatchEvent(new Event("input", { bubbles: true })); snapshotDrafts(); }
    else if (!keep) field.value = base;
    dockGlobe(); setTimeout(() => { field.focus({ preventScroll: true }); field.setSelectionRange?.(field.value.length, field.value.length); }, 420);
  };
  voiceRun = { stop: exit };
  ui.querySelector(".vt").textContent = "";
  await new Promise((r) => setTimeout(r, state.settings.reduced ? 0 : 480));   // let the globe arrive
  if (finished) return;
  await speakQuestion(q, form.dataset.voice);
  if (finished) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { ui.querySelector(".vt").textContent = "Voice answers aren't available in this browser. Type your answer instead."; setTimeout(() => exit(false), 2600); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const c = ctxNow(); stopMeter = levelMeter(c.createMediaStreamSource(stream), c); }
  catch { ui.querySelector(".vt").textContent = "Microphone blocked. Allow it in the browser, or type your answer."; setTimeout(() => exit(false), 2600); return; }
  if (finished) return;
  document.body.classList.add("voice-listening"); orb.listen(true);
  rec = new SR(); rec.lang = "en-GB"; rec.continuous = true; rec.interimResults = true;
  let finals = "";
  const quiet = () => { clearTimeout(silence); silence = setTimeout(() => exit(true), 3200); };   // stops after a pause
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finals += t + " "; else interim += t; }
    heard = finals + interim; ui.querySelector(".vt").textContent = heard;
    field.value = (base ? base + " " : "") + heard.trim(); quiet();
  };
  rec.onerror = () => exit(true); rec.onend = () => exit(true);
  rec.start(); quiet();
}
addEventListener("keydown", (e) => { if (e.key === "Escape" && voiceRun) { e.stopPropagation(); voiceRun.stop(false); } }, true);
addEventListener("resize", () => { if (voiceRun) placeVoiceGlobe(); });

// ---- action composer (v3.3c): one question as the heading, and a Claude-style bar underneath --------------
// abar(): [globe] [pickers/tools] … [mic] [send]; the top row is either a text field or a quiet hint line.
const tool = (label, action, arg = "") => `<button type="button" class="tool" data-action="${action}" data-arg="${esc(arg)}">${label}</button>`;
function abar({ field = "", hint = "", hints = "", tools = "", send, mic = !!field }) {
  const top = field || `<p class="ibar-hint" data-hint-line="${hints}">${esc(hint)}</p>`;
  const s = send.submit ? `<button class="primary ibar-send" aria-label="${esc(send.label)}" ${send.disabled ? "disabled" : ""}>${icon("send")}</button>`
    : `<button type="button" class="primary ibar-send" data-action="${send.action}" data-arg="${esc(send.arg ?? "")}" aria-label="${esc(send.label)}" title="${esc(send.label)}" ${send.disabled ? "disabled" : ""}>${icon("send")}</button>`;
  return `<div class="ibar ibar--tools"><span class="ibar-globe" aria-hidden="true"></span>${top}<div class="ibar-tools">${tools}</div>${mic ? `<button type="button" class="ibar-mic" data-action="voice" aria-label="Answer by voice">${icon("mic")}</button>` : `<span class="ibar-mic-gap"></span>`}${s}</div>`;
}
// Pickers share one mechanic: a pill with a caret opens a glass menu; choices update in place (no re-render).
const PICKERS = {
  findings: { multi: true, max: 3, head: "Choose up to three", empty: "Factors",
    items: () => C.factors.map((f) => ({ id: f.id, title: f.title, sub: f.base, on: state.findings.includes(f.id) })),
    toggle(id) { if (state.findings.includes(id)) state.findings = state.findings.filter((x) => x !== id); else if (state.findings.length < 3) state.findings.push(id); else announce("Choose up to three factors."); },
    chosen: () => state.findings, sendReady: () => state.findings.length > 0 },
  conditions: { multi: true, head: "Change a condition", empty: "Conditions",
    items: () => C.factors.map((f) => ({ id: f.id, title: f.title, sub: state.selected.includes(f.id) ? f.alternative : f.base, on: state.selected.includes(f.id) })),
    toggle(id) { state.selected = state.selected.includes(id) ? state.selected.filter((x) => x !== id) : [...state.selected, id]; },
    chosen: () => state.selected, sendReady: () => true },
  lever: { multi: false, head: "Choose one", empty: "Options",
    items: () => { const l = C.levers[state.lever]; return state.order[state.lever].map((id) => { const o = l.options.find((o) => o.id === id); return { id, title: o.text, on: state.choices[l.id] === id }; }); },
    toggle(id) { state.choices[C.levers[state.lever].id] = id; },
    chosen: () => { const v = state.choices[C.levers[state.lever].id]; return v ? [v] : []; }, sendReady: () => !!state.choices[C.levers[state.lever].id],
    label: () => "Option", },
};
function pickLabel(key) {
  const P = PICKERS[key], items = P.items(), on = items.filter((x) => x.on);
  if (!on.length) return P.empty;
  if (P.label) return `${P.label()} ${items.findIndex((x) => x.on) + 1}`;
  return `${esc(on[0].title)}${on.length > 1 ? ` <em>+${on.length - 1}</em>` : ""}`;
}
function menuPicker(key) {
  const P = PICKERS[key];
  const items = P.items().map((x) => `<button type="button" role="option" class="pick-item${x.sub ? "" : " long"}" aria-selected="${x.on}" data-action="pickItem" data-arg="${key}|${x.id}"><span><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span><i class="pick-check">${icon("check")}</i></button>`).join("");
  return `<div class="picker" data-picker="${key}"><button type="button" class="pick${P.chosen().length ? "" : " attn"}" data-action="pickerToggle" aria-haspopup="listbox" aria-expanded="false"><span class="pick-label">${pickLabel(key)}</span>${icon("caretDown")}</button>
    <div class="pick-menu" role="listbox" aria-multiselectable="${P.multi}" aria-label="${esc(P.head)}"><p class="pick-head">${esc(P.head)}</p>${items}</div></div>`;
}
const factorPicker = () => menuPicker("findings");
function updatePicker(key) {
  const p = panel.querySelector(`.picker[data-picker="${key}"]`); if (!p) return;
  const P = PICKERS[key];
  p.querySelector(".pick-label").innerHTML = pickLabel(key);
  p.querySelector(".pick").classList.toggle("attn", !P.chosen().length);
  const items = P.items();
  p.querySelectorAll(".pick-item").forEach((b, i) => { b.setAttribute("aria-selected", items[i].on); const sm = b.querySelector("small"); if (sm && items[i].sub) sm.textContent = items[i].sub; });
  const send = panel.querySelector(".ibar-send"); if (send && P.sendReady) send.disabled = !P.sendReady();
  refreshHintLine();
}
document.addEventListener("pointerdown", (e) => { const p = panel.querySelector(".picker.open"); if (p && !p.contains(e.target)) actions.pickerToggle(); });
addEventListener("keydown", (e) => { const p = panel.querySelector(".picker.open"); if (p && e.key === "Escape") { e.stopPropagation(); actions.pickerToggle(); p.querySelector(".pick").focus(); } }, true);
const HINTS = {
  model: () => state.selected.length
    ? [`${state.selected.length} condition${state.selected.length === 1 ? "" : "s"} changed. Run the test →`, "Open Conditions to change more"]
    : ["Open Conditions and change one, then run the test", "Each test replays Kalinda from year 2 to 10"],
  result: () => ["Compare it with what happened, or change conditions", "Ready? Write your findings →"],
  lever: () => { const l = C.levers[state.lever], v = state.choices[l.id]; const o = v && l.options.find((o) => o.id === v); return o ? [o.text] : ["Open Options and choose one"]; },
  rationale: () => ["Name a trade-off you accepted…", "What are you still unsure about?", "Or tap the waves and say it"],
  brief: () => ["What should the Chair say first?", "Keep it to about sixty seconds…", "Or tap the waves and say it"],
  identity: () => ["Your name", "Or tap the waves and say it"],
  file: () => [`${Object.keys(state.tags).length} of 18 sources tagged`, "Open the file to read and tag each source →"],
  findings: () => state.findings.length
    ? ["Now say why, using your tests…", "Which test showed it?", "Or tap the waves and say it"]
    : ["Choose up to three factors below ↓", "Then say why, using your tests…", "Or tap the waves and say it"],
};
const fieldHint = (k) => HINTS[k]?.()[0] || "";
let hintTimer = 0, hintIdx = 0;
function refreshHintLine() { const h = panel.querySelector(".ibar-hint[data-hint-line]"); if (h) { hintIdx = 0; h.textContent = HINTS[h.dataset.hintLine]?.()[0] || h.textContent; } }
setInterval(() => {   // the field's placeholder carries the instructions, one at a time
  if (document.body.classList.contains("voice-mode")) return;
  const line = panel.querySelector(".ibar-hint[data-hint-line]");
  const form = panel.querySelector("form[data-hints]"), f = form?.querySelector("textarea,input[name]");
  const key = line?.dataset.hintLine || (f && !f.value ? form.dataset.hints : "");
  const list = HINTS[key]?.() || []; if (list.length < 2) return;
  const el = line || f; el.classList.add("hint-out");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintIdx = (hintIdx + 1) % list.length; if (line) line.textContent = list[hintIdx]; else f.placeholder = list[hintIdx]; el.classList.remove("hint-out"); }, 220);
}, 3400);

// ---- layout guard (v3.3d) -----------------------------------------------------------------------------
// Option 1: pop-up cards (#railPanel) open centred in the frame, in the space above the composer.
// Option 2: if a card still collides with the composer, the composer slides aside (same GAP from the card);
// if even that leaves too little room, it folds into the globe until the card goes away.
const GAP = 20, MIN_COMPOSER = 380;
let autoFolded = false;
const rectOf = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
function placePanel() {
  const p = $("#railPanel"); if (p.hidden) return;
  const f = $("#frame").getBoundingClientRect(), root = document.documentElement.style;
  const comp = !panel.classList.contains("empty") && !autoFolded ? panel.getBoundingClientRect() : null;
  const top = f.top + GAP * 2, floor = (comp && comp.height ? comp.top : f.bottom) - GAP;
  const room = floor - top, h = Math.min(p.scrollHeight, Math.max(room, f.height * .5));
  root.setProperty("--pcx", `${f.left + f.width / 2}px`);
  root.setProperty("--ptop", `${top + Math.max(0, (room - h) / 2)}px`);
  root.setProperty("--pmaxh", `${Math.max(room, f.height * .5)}px`);
}
function guardLayout() {
  placePanel();
  const root = document.documentElement.style, body = document.body;
  if (panel.classList.contains("empty") || (panel.classList.contains("folded") && !autoFolded) || body.classList.contains("voice-mode")) { body.classList.remove("composer-aside"); return; }
  const f = $("#frame").getBoundingClientRect(), cur = panel.getBoundingClientRect();
  const W = Math.min(760, f.width - 48), cx = f.left + f.width / 2;
  const natural = { left: cx - W / 2, right: cx + W / 2, top: cur.top || f.bottom - 160, bottom: f.bottom };
  const obstacles = [rectOf($("#railPanel")), ...[...stage.querySelectorAll(".card")].map(rectOf)].filter((r) => hit(r, natural));
  let left = f.left + GAP, right = f.right - GAP;
  for (const o of obstacles) {
    const oc = (o.left + o.right) / 2;
    if (oc >= cx) right = Math.min(right, o.left - GAP); else left = Math.max(left, o.right + GAP);
    if (o.left < cx && o.right > cx) {   // a card straddling the centre: take the wider side
      if (o.left - f.left > f.right - o.right) { right = o.left - GAP; left = f.left + GAP; } else { left = o.right + GAP; right = f.right - GAP; }
    }
  }
  const avail = right - left;
  if (!obstacles.length) { body.classList.remove("composer-aside"); if (autoFolded) { autoFolded = false; panel.classList.remove("folded"); dockGlobe(); } return; }
  if (avail >= MIN_COMPOSER) {
    if (autoFolded) { autoFolded = false; panel.classList.remove("folded"); }
    const w = Math.min(W, avail);
    root.setProperty("--cw", `${w}px`); root.setProperty("--ccx", `${(left + right) / 2}px`); body.classList.add("composer-aside"); dockGlobe();
  } else if (!autoFolded) {
    autoFolded = true; body.classList.remove("composer-aside"); panel.classList.add("folded"); body.classList.remove("talking"); orb.place("rest");
  }
}
const guardSoon = (() => { let t = 0; return () => { cancelAnimationFrame(t); t = requestAnimationFrame(guardLayout); }; })();
new ResizeObserver(guardSoon).observe(document.documentElement);
addEventListener("load", () => { const ro = new ResizeObserver(guardSoon); ["#railPanel", "#stage", "#composer", "#rail"].forEach((q) => $(q) && ro.observe($(q))); });
const dot = (tag) => `<span class="status-dot ${tag || ""}">${tag === "foundations" ? "Foundations" : tag === "aside" ? "Set aside" : "Not reviewed"}</span>`;
// The conversation: subtitles beside the globe. New words rise in softly; options are plain text under the line.
let lastSub = "", focusedPage = null;
let textMode = false;
// A character's line stays long enough to read, then folds away so only its actions remain, and comes back after a
// pause in case the learner wants to read it again. It holds while the voice is playing or the pointer is on the card.
let sayTimer = 0;
function cycleSay() {
  clearTimeout(sayTimer); panel.classList.remove("rest");
  const p = panel.querySelector(":scope > p:not(.who):not(.muted)");
  if (!p || !panel.querySelector(".who, .who-row") || !panel.querySelector("button")) return;
  p.classList.add("say");
  const words = p.textContent.trim().split(/\s+/).length;
  const READ = Math.min(14000, Math.max(6000, 1200 + words * 330)), REST = 7000;
  const busyNow = () => panel.matches(":hover") || (linePlayer.el && !linePlayer.el.paused);
  const show = () => { p.style.maxHeight = p.scrollHeight + "px"; panel.classList.remove("rest"); sayTimer = setTimeout(hide, READ); };
  const hide = () => {
    if (busyNow()) { sayTimer = setTimeout(hide, 1000); return; }
    p.style.maxHeight = p.scrollHeight + "px"; void p.offsetHeight;        // from its measured height, so it animates
    panel.classList.add("rest"); sayTimer = setTimeout(show, REST);
  };
  p.style.maxHeight = "none"; sayTimer = setTimeout(hide, READ + 620);   // 620 ms: the words stream in first
}
function composer(html) {
  const changed = html !== lastSub; lastSub = html;
  if (changed) panel.innerHTML = html; panel.classList.toggle("empty", !html);
  if (changed) cycleSay();
  if (html && changed) panel.classList.remove("folded");
  document.body.classList.toggle("talking", !!html && !panel.classList.contains("folded"));
  orb.reduced = state.settings.reduced;
  requestAnimationFrame(() => requestAnimationFrame(reserveSpace)); syncGlobeLabel();   // after the globe has moved
  if (changed && html) streamWords();
  if (changed && html && !state.settings.reduced) {
    let k = 0;
    panel.querySelectorAll(".who, p:not(.who), .opts, form > *:not(.sr)").forEach((el) => { el.style.setProperty("--d", "0ms"); el.classList.add("rise"); });
  }
  if (changed && html) portraitIntro();
  if (changed) { if (html) voiceLine(panel); else stopLine(); }
  dockGlobe();
  const quiet = busy || state.page === "P00";      // the title screen and scene changes have no globe
  requestAnimationFrame(() => orb.place(html ? (panel.classList.contains("folded") ? "rest" : "prompt") : (quiet ? "hidden" : "rest"), { activate: changed }));
}
// Details open as a panel in the rail, under the chapter card (v3.1): never a pop-up in the middle of the screen.
const railPanel = $("#railPanel");
let panelReturn = null, panelTimer = 0;
function modal(html) {
  closeMenu(); snapshotDrafts(); clearTimeout(panelTimer);
  $("#drawerBody").innerHTML = html; voiceLine($("#drawerBody"), 300);
  if (railPanel.hidden || !railPanel.classList.contains("on")) {
    panelReturn = document.activeElement; railPanel.hidden = false;
    railPanel.classList.remove("on"); void railPanel.offsetWidth; railPanel.classList.add("on");
  }
  const head = railPanel.querySelector("h2,h3"); if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  requestAnimationFrame(reserveSpace);
}
function panelOpen() { return !railPanel.hidden && railPanel.classList.contains("on"); }
function close() {
  if (!panelOpen()) return;
  railPanel.classList.remove("on");
  panelTimer = setTimeout(() => { railPanel.hidden = true; reserveSpace(); }, state.settings.reduced ? 0 : 220);
  if (railPanel.contains(document.activeElement)) panelReturn?.focus?.({ preventScroll: true });
}
$("#closePanel").addEventListener("click", () => close());
addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen()) { e.stopPropagation(); close(); } }, true);
drawer.addEventListener("close", () => document.body.classList.remove("detail-open"));
$("#closeDrawer").onclick = close;
drawer.addEventListener("cancel", e=>{e.preventDefault();close();});
drawer.addEventListener("click", (e) => { if (e.target === drawer) close(); });

// ---- the globe's menu: everything that used to sit on screen lives here
function menuItems() {
  const items = [];
  if (state.page === "P03" && inspecting()) {
    items.push(["readText", "Read this page as text"], ["zoomPage", "Zoom onto the page"], ["putBack", "Put the file down"], ["reviewSources", "Review sources"]);
  }
  if (!panel.classList.contains("empty")) items.push(["toggleTalk", panel.classList.contains("folded") ? "Show the conversation" : "Hide the conversation"]);
  if (state.page !== "P00") items.push(["notebook", "Notebook"]);
  if (state.feedback) items.push(["feedback", "Latest feedback"]);
  if (!inspecting()) items.push(["viewReset", "Reset model view"], ["viewTop", "View from above"]);
  items.push(["settings", "Settings"]);
  return items;
}
function openMenu() {
  menuEl.innerHTML = menuItems().map(([a, t]) => `<button type="button" role="menuitem" data-action="${a}">${t}</button>`).join("");
  menuEl.hidden = false; requestAnimationFrame(() => menuEl.classList.add("on"));
  $("#agentButton").setAttribute("aria-expanded", "true");
  menuEl.querySelector("button")?.focus({ preventScroll: true });
}
function closeMenu() {
  if (menuEl.hidden) return;
  menuEl.classList.remove("on"); $("#agentButton").setAttribute("aria-expanded", "false");
  setTimeout(() => { if (!menuEl.classList.contains("on")) menuEl.hidden = true; }, 220);
}
// The globe opens and closes the conversation (v3). Tools that used to sit in its menu now live in the rail.
$("#agentButton").onclick = (e) => { e.stopPropagation(); if (busy || panel.classList.contains("empty")) return; actions.toggleTalk(); };
function syncGlobeLabel() {
  const open = !panel.classList.contains("empty") && !panel.classList.contains("folded");
  $("#agentButton").setAttribute("aria-label", open ? "Hide conversation" : "Show conversation");
  $("#agentButton").setAttribute("aria-expanded", String(open));
}
document.addEventListener("pointerdown", (e) => { if (!menuEl.hidden && !menuEl.contains(e.target) && !e.target.closest("#agent")) closeMenu(); });
menuEl.addEventListener("click", () => setTimeout(closeMenu, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, state.settings.reduced ? 0 : ms));

// ---------------------------------------------------------------- places, cameras, choreography
const SCENE = (p) => (["P05", "P06", "P07", "P08"].includes(p) ? "model" : ["P09", "P10", "P11"].includes(p) ? "hall" : ["P12", "P13", "P14"].includes(p) ? "chair" : "office");
const CAMERA = { P00: "CAM_OfficeEntry", P01: "CAM_Desk", P02: "CAM_Desk", P03: "CAM_Document", P04: "CAM_Document",
  P05: "CAM_Model", P06: "CAM_Model", P07: "CAM_Model", P08: "CAM_Model", P09: "CAM_Hall", P10: "CAM_Hall", P11: "CAM_Hall",
  P12: "CAM_ChairOffice", P13: "CAM_ChairOffice", P14: "CAM_ChairOffice" };
const PLACE = { office: "Commission · Research unit", model: "Commission · Research unit · Kalinda model",
  hall: "Tamarind Crossing · School hall", chair: "Commission · Chair’s office" };
let currentScene = "office";

async function fadeTo(kicker, title, work) {
  const f = $("#fade"); $("#fadeKicker").textContent = kicker || ""; $("#fadeTitle").textContent = title || ""; $("#fadeSub").textContent = "";
  f.classList.add("on"); await wait(title ? 650 : 250);
  await work(); f.classList.remove("on"); await wait(250);
}

// The Orizon stage (design v3 §9): thin arcs draw around "Kalinda" on a deep indigo field. "enter" plays once when
// the learner steps into the teaching model; "run" plays while a test runs (arcs turn, years light in sequence).
// The engine result never waits on it; the beat is capped (1.5s enter, 1.3s run).
const oz = $("#orizon");
async function orizonIn(mode) {
  oz.dataset.mode = mode; oz.hidden = false;
  if (state.settings.reduced) { oz.classList.add("on", "static"); return; }
  oz.classList.remove("static"); void oz.offsetWidth; oz.classList.add("on");
  await wait(mode === "run" ? 3300 : 1500);
}
async function orizonOut() {
  oz.classList.remove("on");
  await wait(state.settings.reduced ? 0 : 620); oz.hidden = true;
}

const loading = {};                                // one load per model; later callers await the same promise
function ensureAsset(name) {
  if (!world) return Promise.resolve(null);
  if (world.assets[name]) return Promise.resolve(world.assets[name]);
  return (loading[name] ||= loadAsset(name).finally(() => { if (!world.assets[name]) delete loading[name]; }));
}
async function loadAsset(name) {
  const urls = { office: "office.glb", casefile: "casefile.glb", kalinda: "kalinda.glb", hall: "office_room.glb", chair: "chair_office_props.glb" };
  const place = name === "casefile" ? world.cv(layout.office.folder_position) : name === "kalinda" ? world.cv(layout.office.map_position) : null;
  const a = await world.load(name, "/models/" + urls[name], place);
  if (!a) { status(`Part of the scene could not load (${name}). Text controls still work.`, "retryAssets"); return null; }
  if (name === "casefile") {     // sheet titles are drawn in Afacad on a canvas, so the font must be ready first
    try { await document.fonts.load('600 74px "Afacad Variable"'); } catch {}
    paintCase();
  }
  if (name === "kalinda") world.prepareKalinda();
  if (name === "chair") world.prepareChairProps();
  world.setMood(currentScene);
  if (!world.inspector.active) world.pose(CAMERA[state.page], 0); // a late-loading model must obey the current place's visibility
  if (name === "office" && state.page === "P00") world.titleSwing(true);   // fit the turning office now that it can be measured
  return a;
}

async function enterScene(page) {
  const next = SCENE(page);
  if (!world) { currentScene = next; return; }
  const cam = CAMERA[page];
  if (next === currentScene) { await world.pose(cam, 800); return; }
  if (next === "hall" || (currentScene === "hall" && next !== "hall") || next === "chair") {
    const [kicker, title] = next === "hall" ? ["Thursday", "Tamarind Crossing"] : next === "chair" ? ["Thursday evening", "The Chair’s office"] : ["Friday", "The Commission"];
    await fadeTo(kicker, title, async () => {
      if (next === "hall") await ensureAsset("hall");
      if (next === "chair") await ensureAsset("chair");
      world.setMood(next); await world.pose(cam, 0);
    });
  } else if (next === "model") {
    await closeCaseFile();
    await orizonIn("enter");
    await ensureAsset("kalinda");
    world.setMood("model"); document.body.dataset.scene = "model"; await world.pose(cam, 0);
    currentScene = next; orizonOut();                 // the stage dissolves away while the map is revealed
    return;
  } else { world.setMood(next); await world.pose(cam, 800); }
  currentScene = next;
}

// ---- the case file: click it and it comes to the screen and opens; click the paper and it slides aside.
// While it is held the only marks on screen are two stamps against the page's edge and a quiet page count.
const noteFor = (e, tag) => (e.claim && tag ? (tag === "aside" ? e.asideNote : e.flag) : "");
function pageInfo(i) { const e = C.evidence[i]; if (!e) return null; const tag = state.tags[e.id] || null; return { e, tag, note: noteFor(e, tag) }; }
function readerHTML(i) {
  const { e, tag, note } = pageInfo(i);
  return `<div class="reader"><span class="kicker">Source ${i + 1} of ${C.evidence.length}${tag ? " · " + (tag === "aside" ? "Set aside" : "Foundations") : ""}</span><h2>${esc(e.title)}</h2><span class="source">${esc(e.source)}</span><p class="body">${esc(e.text)}</p>${note ? `<p class="flag">${esc(note)}</p>` : ""}</div>`;
}
function paintCase() {
  world?.paintPages(pageInfo, C.evidence.length, state.doc);
  reader.innerHTML = readerHTML(state.doc);
}
const inspecting = () => textMode || (!!world?.inspector.active && !["out","returning"].includes(world.inspector.state));
const TOUCH = matchMedia("(hover: none)").matches;
let hudRAF = 0, hoverFile = false, introUntil = 0;
// ---- a marked sheet goes into its folder: a thin stroke traces its edge in the folder's colour, the sheet folds in
// half, then shrinks into the folder like a window minimising to the Dock. A DOM stand-in drawn from the sheet's own
// texture does the flight while the 3D sheet hides; the next source comes up as it lands. Returns false if it cannot.
function flyToTray(kind) {
  const W = world, a = W?.caseAnchor(), pg = W?.inspector.pages?.[W.inspector.pageIdx]?.o, img = pg?.material?.map?.image;
  if (!trays || !a || !img || state.settings.reduced) { trays?.bump(kind); return false; }
  const x0 = a.left.x, y0 = a.top.y, w = a.top.x - a.left.x, h = a.bottom.y - a.top.y;
  if (!(w > 30 && h > 30)) { trays.bump(kind); return false; }
  const color = kind === "aside" ? "#e0483a" : "#2f6bd8", T = trays.rect(kind);
  const g = document.createElement("div"); g.className = "fly"; g.setAttribute("aria-hidden", "true");
  g.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;--c:${color}`;
  g.innerHTML = `<div class="fly-top"><canvas></canvas></div><div class="fly-bot"><canvas></canvas><i></i></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><rect x=".6" y=".6" width="${w - 1.2}" height="${h - 1.2}" rx="1.5" pathLength="100"/></svg>`;
  const dpr = Math.min(devicePixelRatio, 2);
  g.querySelectorAll("canvas").forEach((c, i) => {
    c.width = Math.round(w * dpr); c.height = Math.round(h / 2 * dpr);
    const x = c.getContext("2d"), sh = img.height / 2;
    x.drawImage(img, 0, i * sh, img.width, sh, 0, 0, c.width, c.height);
  });
  document.body.append(g); pg.visible = false;
  const ease = "cubic-bezier(.32,.72,0,1)";
  g.querySelector("rect").animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
  g.querySelector(".fly-bot").animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-180deg)" }], { duration: 320, delay: 470, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
  g.querySelector("svg").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 470, fill: "forwards" });
  const cx = x0 + w / 2, cy = y0 + h / 4, dx = T.x + T.w / 2 - cx, dy = T.y + T.h / 2 - cy, s = Math.max(.04, T.w / w);
  // the genie: width collapses ahead of height, then it drops into the folder
  const fly = g.animate([
    { transform: "translate(0,0) scale(1,1)", opacity: 1 },
    { transform: `translate(${dx * .3}px,${dy * .18}px) scale(${Math.max(s, .55)},.92)`, opacity: 1, offset: .35 },
    { transform: `translate(${dx}px,${dy}px) scale(${s},${s * .9})`, opacity: .15 },
  ], { duration: 540, delay: 820, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
  fly.onfinish = () => {
    trays.bump(kind); g.remove();
    const ip = W.inspector; if (ip.pages?.[ip.pageIdx]?.o === pg) pg.visible = true;   // the last sheet stays to be read
  };
  return true;
}
function caseHUD() {
  const on = state.page === "P03" && inspecting() && !textMode && world?.inspector.state === "held";
  $("#documentNav").hidden = state.page !== "P03" || !inspecting();
  $("#documentNav [data-arg=\"-1\"]").disabled = state.doc === 0;
  $("#documentNav [data-arg=\"1\"]").disabled = state.doc === C.evidence.length-1;
  stampsEl.hidden = !on; countEl.hidden = !on; trays?.show(on);
  cancelAnimationFrame(hudRAF);
  if (!on) return;
  const tag = state.tags[C.evidence[state.doc].id];
  stampsEl.querySelectorAll(".stamp").forEach((s) => { const v = s.dataset.arg === tag; s.classList.toggle("on", v); s.setAttribute("aria-pressed", v); });
  countEl.textContent = `${state.doc + 1} / ${C.evidence.length}`;
  $("#documentNav [data-action=reviewSources]")?.classList.toggle("ready", C.evidence.every((_, i) => decided(i)));
  const step = () => {
    const a = world?.caseAnchor();
    if (a) {
      const narrow = innerWidth < 700;
      // stamps sit against the page's right edge; on a phone (or if they'd leave the screen) they sit under it
      const right = a.top.x + 14, fits = !narrow && right + 170 < innerWidth;
      stampsEl.classList.toggle("under", !fits);
      if (fits) stampsEl.style.transform = `translate(${right}px, ${Math.max(70, a.top.y + 8)}px)`;
      // the globe sits at the bottom centre: keep the stamps and the count above it
      else stampsEl.style.transform = `translate(${Math.max(12, Math.min(innerWidth - 300, a.bottom.x - 140))}px, ${Math.min(innerHeight - 178, a.bottom.y + 14)}px)`;
      countEl.style.transform = `translate(${a.bottom.x}px, ${Math.min(innerHeight - (fits ? 104 : 128), a.bottom.y + (fits ? 16 : 58))}px) translateX(-50%)`;
    }
    const show = true;
    stampsEl.classList.toggle("show", show);
    hudRAF = requestAnimationFrame(step);
  };
  step();
}
async function openCaseFile() {
  await ensureAsset("casefile");
  if (!world?.assets.casefile) { textMode=true; render(); return; }
  textMode=false;
  await world.pose("CAM_Desk", 600);
  paintCase();
  orb.place("hidden");
  world.inspectCase(state.doc);
  // once the sheet is out: explain the marks the first time, or say where things stand if every source is decided
  setTimeout(() => {
    if (state.page !== "P03" || !inspecting()) return;
    if (C.evidence.every((_, i) => decided(i))) evidenceCheck();
    else if (!Object.keys(state.tags).length && !state.hintSeen)
      composer(`${speaker("Dr Amina Diallo", "Research Director")}<p>Read each source. Mark it with a blue O to keep it in Foundations, or a red X to set it aside. The next one comes up by itself.</p>${row(b("Got it", "hideHint", "", "primary"))}`);
  }, state.settings.reduced ? 300 : 1900);
}
function untilIdle() {
  return new Promise((res) => { const t = () => (!world || world.inspector.state === "idle" ? res() : requestAnimationFrame(t)); t(); });
}
async function closeCaseFile() {
  textMode=false;
  if (!world?.inspector.active) return;
  world.inspector.exit();
  await untilIdle();
}
function onInspect(ev) {
  if (ev.hover !== undefined) { hoverFile = ev.hover; return; }
  if (ev.click !== undefined) {
    if (ev.click === 0) { actions.putBack(); return; }      // clicked beside the file: put it down
    actions.doc(String(ev.click));
    return;
  }
  if (ev.state === "held") introUntil = performance.now() + 3500;   // show the stamps once, then on hover
  caseHUD();
  if (ev.state === "idle" && state.page === "P03" && !busy) render();
}

// ---------------------------------------------------------------- navigation
async function go(page) {
  if (busy) return;
  stopLine();
  if (paused) { paused=false; orb.paused=false; world?.setPaused(false); }
  const from = state.page;
  busy = true; document.body.classList.add("busy");
  try {
    state.page = page; save();
    if (from === "P03" && page !== "P03") await closeCaseFile();
    composer(""); orb.place("hidden");                // the conversation steps away while the scene moves
    if (from === "P00") await fadeTo("Monday morning", "The Commission · Research unit", async () => { world?.setBlur(0); await enterScene(page); });
    else await enterScene(page);
    if (page === "P03") await openCaseFile();
  } finally { busy = false; document.body.classList.remove("busy"); }
  render();
  window.dispatchEvent(new CustomEvent("analyst:state", { detail: { page, state: structuredClone(state) } }));
}

// ---------------------------------------------------------------- render (composer + stage text for the page)
let heroStrands = null, recStrands = null, meterRAF = 0, audioCtx = null;
let lastPeekKey = "";
function render() {
  renderPage();
  if (state.page === "P00") requestAnimationFrame(() => world?.titleSwing(true)); else { world?.titleSwing(false); hoverOff(true); }
  reel?.show(state.page === "P00");
  panel.querySelectorAll('.stack[role=radiogroup] button').forEach((b) => { b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(b.classList.contains("selected"))); });
  // info cards (not tasks) announce, then shrink to their heading; hovering or focusing reopens them
  const peek = ["P05", "P07", "P13"].includes(state.page) && stage.dataset.layout === "side";
  stage.querySelectorAll(".card").forEach((c) => {
    c.classList.toggle("peek", peek);
    // Minimised peek cards shrink to a small tab with the chapter's icon; hover opens them again.
    if (peek && !c.querySelector(":scope > .peek-icon")) {
      const ch = CHAPTERS.find((x) => x.pages.includes(state.page));
      c.insertAdjacentHTML("afterbegin", `<span class="peek-icon" aria-hidden="true">${icon(ch?.icon || "notebook")}</span>`);
    }
  });
  const key = peek ? state.page + "|" + (stage.querySelector(".card .headline,.card h2")?.textContent || "") : "";
  if (peek && key !== lastPeekKey) announceRail();
  lastPeekKey = key;
  // the map shows the simulated state of the run being read (2 s of clip per year), or stays untouched
  if (world && SCENE(state.page) === "model" && !busy) {
    const run = state.runs[state.runView ?? state.runs.length - 1];
    if (["P07", "P08"].includes(state.page) && run) world.simShow(run.outcome, 2 + 2 * state.year, 700);
    else if (state.page === "P05") world.simShow(null);
  }
  requestAnimationFrame(reserveSpace);
}
function renderPage() {
  const p = state.page, scene = SCENE(p);
  heroStrands?.destroy(); heroStrands = null;
  document.body.dataset.scene = scene; document.body.classList.toggle("reduced", state.settings.reduced);
  stage.innerHTML = "";
  stage.dataset.layout = p === "P00" ? "hero" : ["P04", "P14"].includes(p) ? "center" : "side";
  world?.setBlur(0);
  document.body.dataset.page = p;
  const dn = $("#devNav"); if (dn) dn.value = p;
  markers?.set(pinsFor(p));
  railTools(); chapterCard();
  requestAnimationFrame(syncFrame);
  if (p === "P00") {
    stage.innerHTML = `<div class="hero"><small>IRS 103 · Introduction to African Politics</small><h1>The Analyst’s <em>Brief</em></h1>${row(b("Start", "start", "", "primary"), state.resumePage && state.resumePage !== "P00" ? b("Continue saved run", "resume") : "")}</div>`;

    composer(""); orb.place("hidden");
  }
  if (p !== "P01") welcomeRun?.stop(false);
  if (p === "P01") setTimeout(() => { if (state.page === "P01" && !busy) welcomeMode(); }, 0);
  if (p === "P01") composer(`<h2 class="ask">Welcome. What should we call you?</h2><form data-form="identity" data-voice="q_identity" data-question="Welcome. What should we call you?" data-hints="identity">${abar({ field: `<input id="name" name="name" maxlength="60" value="${esc(state.name)}" required autocomplete="given-name" aria-label="Your name" placeholder="Your name">`, send: { submit: true, label: "Continue" } })}<small id="nameHelp"></small></form>`);
  if (p === "P02") {
    composer(!state.interest
      ? `${speaker("Your file", "Junior analyst")}<p>You grew up near Tamarind Crossing. Analysts declare their connections.</p>${row(b("Declare this connection", "declare", "", "primary"))}`
      : `${speaker("Dr Amina Diallo", "Research Director")}<p>Kalinda faces a disputed election, clashes at the Crossing, rumours of an army mutiny and a corruption scandal. Check the evidence, test the causes, then recommend a response.</p>${row(b("Open the case file", "go", "P03", "primary"), b("Full transcript", "transcript"))}`);
  }
  if (p === "P03") {
    if (inspecting()) {
      composer("");
      if (textMode) stage.innerHTML=`<article class="card wide">${readerHTML(state.doc)}${row(b("Foundations","tag","foundations"),b("Set aside","tag","aside"))}</article>`;
    }
    else composer(`<h2 class="ask">The case file is on your desk.</h2>${abar({ hint: fieldHint("file"), hints: "file", tools: tool("Review sources", "go", "P04"), send: { action: "openFile", label: "Open the case file" } })}`);
    caseHUD();
  }
  if (p === "P04") {
    const f = (k, label) => `<button type="button" data-action="filter" data-arg="${k}" aria-pressed="${state.filter === k}">${label}</button>`;
    const shown = C.evidence.map((e, i) => [e, i]).filter(([e]) => state.filter === "all" || state.tags[e.id] === state.filter);
    const tagged = Object.keys(state.tags).length, found = Object.values(state.tags).filter((v) => v === "foundations").length;
    stage.innerHTML = `<div class="card wide"><span class="kicker">Case file · KAL/RU/2026/014</span><div class="card-head"><h2>Your sources</h2><div class="seg" role="group" aria-label="Show documents">${f("all", "All")}${f("foundations", "Foundations")}${f("aside", "Set aside")}</div></div>
      <div class="meter" aria-hidden="true"><i style="width:${(tagged / 18) * 100}%"></i></div><small>${tagged} of 18 reviewed · ${found} in Foundations</small>
      <div class="list">${shown.map(([e, i]) => `<button type="button" data-action="reviewDoc" data-arg="${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="title">${esc(e.title)}</span>${dot(state.tags[e.id])}</button>`).join("") || "<small>No sources with this tag yet.</small>"}</div></div>`;
    composer(`${speaker("Dr Amina Diallo", "Research Director")}<p>${E.evidenceReady(state.tags) ? "Good. Build the background on these." : "Not yet. I need at least fourteen sourced pieces in Foundations, and a decision on both claims."}</p>${row(E.evidenceReady(state.tags) ? b("Open case notes", "commitEvidence", "", "primary") : "", b("Back to the file", "go", "P03"))}`);
  }
  if (p === "P05") {
    stage.innerHTML = `<div class="card"><span class="kicker">Kalinda as it happened · Year ${2 + state.year * 2}</span><p class="headline">${C.headlines.Coup[state.year]}</p><div class="meter" aria-hidden="true"><i style="width:${(state.year + 1) * 20}%"></i></div>${row(state.year > 0 ? b("Earlier", "year", "-1") : "", state.year < 4 ? b("Later", "year", "1") : "", b("Case notes", "caseNotes"))}</div>`;
    composer(`<h2 class="ask">What would you like to change?</h2>${abar({ hint: fieldHint("model"), hints: "model", tools: menuPicker("conditions") + tool("Write findings", "go", "P08"), send: { action: "runModel", label: "Run test" } })}`);
  }
  if (p === "P06") { composer(""); stage.innerHTML = `<p class="sr">Running the model</p>`; }
  if (p === "P07") {
    const run = state.runs[state.runView ?? state.runs.length - 1] || E.trajectory([]);
    stage.innerHTML = `<article class="card"><span class="kicker">Your test · ${esc(run.outcome)} · Year ${2 + state.year * 2}</span><p class="headline">${run.headlines[state.year]}</p><div class="meter" aria-hidden="true"><i style="width:${(state.year + 1) * 20}%"></i></div>${row(state.year > 0 ? b("Earlier", "year", "-1") : "", state.year < 4 ? b("Later", "year", "1") : "")}</article>`;
    composer(`<h2 class="ask">This test ended in ${esc(run.outcome.toLowerCase())}.</h2>${abar({ hint: fieldHint("result"), hints: "result", tools: tool("Change conditions", "go", "P05") + tool("Compare", "compare"), send: { action: "go", arg: "P08", label: "Write findings" } })}`);
  }
  if (p === "P08") {
    composer(`<h2 class="ask">Which factors best explain what happened?</h2><form data-form="findings" data-voice="q_findings" data-question="Which factors best explain what happened? Choose up to three, then say why, using your tests." data-hints="findings">${abar({ field: `<textarea id="why" name="why" rows="1" aria-label="Why these factors?" placeholder="${esc(fieldHint("findings"))}" required maxlength="800">${esc(state.why)}</textarea>`, tools: factorPicker(), send: { submit: true, label: "Send findings", disabled: !state.findings.length } })}</form>`);
  }
  if (p === "P09") composer(`${speaker("Hon. Grace Mwangi", "Commission Chair")}<p>Two district boundaries have changed. Residents fear weaker representation; officials cite new population figures. Test a response we can explain and carry out.</p>${row(b("Situation details", "hallDetails"), b("Plan response", "go", "P10", "primary"))}`);
  if (p === "P10") {
    const l = C.levers[state.lever];
    composer(`<h2 class="ask">${esc(l.title)}</h2>${abar({ hint: fieldHint("lever"), hints: "lever", tools: menuPicker("lever") + (state.lever > 0 ? tool("Previous", "lever", "-1") : ""), send: { action: "lever", arg: "1", label: state.lever === 4 ? "Review package" : "Next", disabled: !state.choices[l.id] } })}`);
  }
  if (p === "P11") {
    const ready = C.levers.every((l) => state.choices[l.id]);
    const result = ready ? E.response(state.choices, state.weather) : null;
    const tested = result && state.hallRuns.some((r) => JSON.stringify(r.choices) === JSON.stringify(state.choices));
    const lvl = (n, v) => (n === "Tension" ? (/eas|low|calm/i.test(v) ? "ok" : /steady/i.test(v) ? "warn" : "bad") : /high/i.test(v) ? "ok" : /medium/i.test(v) ? "warn" : "bad");
    const n2 = (k) => String(k + 1).padStart(2, "0");
    const rows = tested
      ? E.indicatorNames.map((n, i) => `<li><span class="num">${n2(i)}</span><div><span class="lever">${esc(n)}</span><strong>${esc(E.situation(result)[i])}</strong></div><em class="badge ${lvl(n, result.levels[i])}">${esc(result.levels[i])}</em></li>`).join("")
      : C.levers.map((l, i) => { const o = l.options.find((o) => o.id === state.choices[l.id]);
          return `<li><span class="num">${n2(i)}</span><div><span class="lever">${esc(l.title)}</span><strong class="${o ? "" : "unset"}">${esc(o?.text || "Not set yet")}</strong></div><button type="button" class="ib edit" data-action="editLever" data-arg="${i}" aria-label="Change ${esc(l.title)}">${icon("pencil")}</button></li>`; }).join("");
    const pct = result ? Math.min(100, (result.cost / result.budget) * 100) : 0;
    stage.innerHTML = `<div class="card pkg"><span class="kicker">${tested ? "After your test" : "Before you test"}</span><h2>${tested ? "Situation update" : "Your response package"}</h2>
      <ol class="pkg-list ${tested ? "result" : ""}">${rows}</ol>
      ${result ? `<div class="pkg-foot ${result.over ? "over" : ""}"><span class="pkg-time">${icon("clock")}<b>${result.cost}</b> of ${result.budget} units of time</span><div class="meter" aria-hidden="true"><i style="width:${pct}%"></i></div>${result.over ? `<small>Overstretched: this package promises too much.</small>` : ""}</div>` : ""}</div>`;
    composer(`<h2 class="ask">What trade-offs and uncertainties remain?</h2><form data-form="rationale" data-voice="q_rationale" data-question="What trade-offs and uncertainties remain?" data-hints="rationale">${abar({ field: `<textarea id="rationale" name="rationale" rows="1" maxlength="1000" required aria-label="Trade-offs and uncertainties" placeholder="${esc(fieldHint("rationale"))}">${esc(state.rationale)}</textarea>`, tools: tool("Test response", "runHall") + tool("Revise", "editLever", "0"), send: { submit: true, label: "Submit to the Dialogue" } })}</form>`);
  }
  if (p === "P12") composer(`${speaker("Hon. Grace Mwangi", "Commission Chair")}<p>Sixty seconds. What do I tell the Dialogue in the morning?</p>${row(b("Type briefing", "go", "P13", "primary"), b("Record briefing", "recordConsent"))}`);
  if (p === "P13") {
    if (state.showTopicCheck) stage.innerHTML = `<article class="card"><span class="kicker">Topic check · unscored</span><h2>Your briefing</h2><div class="lines">${Object.entries(E.briefingCheck(state.brief)).map(([k, v]) => `<div><b>${k}</b><em class="${v ? "ok" : ""}">${v ? "Detected" : "Not yet"}</em></div>`).join("")}</div><small>A check for topics, not a judgement of your reasoning.</small></article>`;
    composer(`<h2 class="ask">What should the Chair tell the Dialogue?</h2><form data-form="brief" data-voice="q_brief" data-question="Sixty seconds. What do you recommend the Chair tells the Dialogue in the morning?" data-hints="brief">${abar({ field: `<textarea id="brief" name="brief" rows="1" required maxlength="6000" aria-label="Briefing" placeholder="${esc(fieldHint("brief"))}">${esc(state.brief)}</textarea>`, tools: tool("Check topics", "checkBrief"), send: { submit: true, label: "Send to the Chair" } })}</form>`);
  }
  if (p === "P14") {
    const f = E.forward(state.strands);
    stage.innerHTML = `<article class="card wide"><span class="kicker">Thursday night · Debrief</span><h2>Your analyst’s brief</h2><p>${C.forward[f]}</p><ol class="pkg-list result debrief">${["Sourcing evidence", "Explaining causes", "Responding today"].map((t, i) => { const v = state.strands[i] || "Not submitted"; const c = /strong/i.test(v) ? "ok" : /mixed/i.test(v) ? "warn" : /fragile|weak/i.test(v) ? "bad" : ""; return `<li><span class="num">0${i + 1}</span><div><span class="lever">${t}</span></div><em class="badge ${c}">${esc(v)}</em></li>`; }).join("")}</ol><p>${C.chair[f]}</p>${row(b("Why it happened", "whyResults"), b("Reflect", "reflect"), b("Your record", "download"))}</article>`;
    composer(`${speaker("Dr Amina Diallo", "Research Director")}<p>No analysis can promise a safe future. Good analysis can show what is known, what is not, and what to do next.</p>${b("Restart simulation", "restart")}`);
  }
  if (p !== "P03") $("#documentNav").hidden=true;
  announce(p === "P06" ? "Running the model" : ((p === "P00" ? "" : PLACE[scene] + ". ") + (stage.textContent || panel.textContent)).slice(0, 220));
  requestAnimationFrame(() => {
    const focus = panel.querySelector("input,textarea,select,button.primary,button") || stage.querySelector("button");
    if (focus && p !== "P03" && focusedPage !== p) focus.focus({ preventScroll: true, focusVisible: false });   // ring only once the keyboard is used
    focusedPage = p;
  });
}

function snapshotDrafts() { for (const id of ["why", "rationale", "brief"]) { const el = $("#" + id); if (el) state[id] = el.value; } save(); }

async function ritual(ms, work, after, look) { // a short beat; the result is computed locally, never "thinking"
  busy = true; document.body.classList.add("busy"); composer("");
  orb.place("working");
  if (look === "orizon") {                 // the simulation runs on the map itself: it energises while the camera arcs
    world?.simulate("run"); world?.orbit(32, 3300);
    if (simOutcome) { world?.simShow(simOutcome, 0); world?.simShow(simOutcome, 10, 3300); }   // the Blender clip: ten years in 3.3 s
    await orizonIn("run");
  } else await wait(Math.min(ms, 350));
  try { work(); } finally {
    busy = false; document.body.classList.remove("busy"); save();
    if (look === "orizon") { orizonOut(); world?.simulate("calm"); }
    await enterScene(state.page); render();
    after?.();
  }
}

// ---------------------------------------------------------------- case-file guidance (v3.3)
let advanceTimer = 0;
const decided = (i) => !!state.tags[C.evidence[i].id];
function nextUndecided(from) {
  for (let k = 1; k <= C.evidence.length; k++) { const i = (from + k) % C.evidence.length; if (!decided(i)) return i; }
  return -1;
}
function nextSourcedAside(from) {
  for (let k = 1; k <= 16; k++) { const i = (from + k) % 16; if (state.tags[C.evidence[i].id] !== "foundations") return i; }
  return -1;
}
function goToDoc(i) {
  if (!inspecting() || i === state.doc) return;
  state.doc = i; save();
  world?.inspector.turnTo(i); paintCase(); caseHUD(); if (textMode) render();
  announce(`${C.evidence[i].title}. ${i + 1} of 18.`);
}
function evidenceCheck() {
  if (C.evidence.some((_, i) => !decided(i))) return;
  const who = speaker("Dr Amina Diallo", "Research Director");
  if (E.evidenceReady(state.tags)) {
    composer(`${who}<p>That’s every source, and your foundations hold. Ready to build the background?</p>${row(b("Build the background", "commitEvidence", "", "primary"), b("Review sources", "reviewSources"))}`);
    return;
  }
  const kept = C.evidence.slice(0, 16).filter((e) => state.tags[e.id] === "foundations").length;
  const firstAside = C.evidence.slice(0, 16).findIndex((e) => state.tags[e.id] !== "foundations");
  composer(`${who}<p>You’ve decided on every source, but the background is too thin. Most of these are sourced: keep at least fourteen in Foundations. You have ${kept}. Look again at the ones you set aside.</p>${row(b("Show me", "showDoc", firstAside, "primary"), b("Review sources", "reviewSources"))}`);
}

// ---------------------------------------------------------------- actions
const actions = {
  voice() { voiceMode(); },
  replayIntro() { close(); playOpener(true); },
  start() { if (state.resumePage && state.resumePage !== "P00") modal(`<h2>Start a new run?</h2><p>This replaces the saved run.</p>${b("Start new run", "newRun", "", "primary")}`); else go("P01"); },
  newRun() { close(); state = fresh(); go("P01"); },
  resume() { go(state.resumePage); },
  declare() { state.interest = true; save(); render(); announce("Connection declared in your file."); },
  transcript() { modal(`${personHead("Dr Amina Diallo", "voice note")}<p>Good morning. The Dialogue opens on Friday, and everyone has a theory about how we got here. I need three things from you this week: a background section I can trust, a test of the explanations people are offering, and a response we can defend. Start with the sources. Use what is reliable and tell me what you set aside. And please note in your file that you grew up near the Crossing. It is an interest, not a disqualification.</p>`); },
  go,
  tag(value) {
    if (busy) return;
    const e = C.evidence[state.doc]; const wasUndecided = !state.tags[e.id];
    const flew = !textMode && flyToTray(value);          // stroke, fold, then into the blue or red folder
    state.tags[e.id] = value; save();
    paintCase(); caseHUD();
    if (textMode) render();
    window.dispatchEvent(new CustomEvent("analyst:tag", { detail: { id: e.id, value } }));
    announce(`Tagged ${value === "aside" ? "Set aside" : "Foundations"}.`);
    // v3.3: what next is never a question. The next undecided sheet slides in; once all are decided, Diallo says
    // whether the foundations hold and, if not, exactly what to revisit.
    clearTimeout(advanceTimer);
    const at = state.doc;
    advanceTimer = setTimeout(() => {
      if (state.page !== "P03" || !inspecting() || state.doc !== at) return;
      const next = nextUndecided(at);
      if (next >= 0) { goToDoc(next); return; }
      if (E.evidenceReady(state.tags)) { evidenceCheck(); return; }
      // everything decided but the foundations are thin: bring up the next sourced piece that was set aside
      // the last open decision gets Diallo's word; after that, each re-mark brings up the next sourced piece set aside
      const n = nextSourcedAside(at);
      if (wasUndecided || n < 0 || n === at) evidenceCheck(); else goToDoc(n);
    }, state.settings.reduced ? 0 : flew ? 1400 : 650);
  },
  /** A folder was clicked: list what is in it, so a source can be taken back out and marked again. */
  openTray(kind) {
    const items = C.evidence.map((e, i) => [e, i]).filter(([e]) => state.tags[e.id] === kind);
    const name = kind === "aside" ? "Set aside" : "Foundations";
    modal(`<span class="kicker">${kind === "aside" ? "Red folder" : "Blue folder"}</span><h2>${name}</h2>${items.length ? `<p class="muted">Take a source back out to read it and mark it again.</p><div class="tray-list">${items.map(([e, i]) => `<button type="button" data-action="pullOut" data-arg="${i}"><b>${String(i + 1).padStart(2, "0")}</b> ${esc(e.title)}</button>`).join("")}</div>` : `<p class="muted">Nothing in this folder yet.</p>`}`);
  },
  pullOut(i) {
    i = Number(i); const e = C.evidence[i]; if (!e) return;
    close(); delete state.tags[e.id]; save();             // out of the folder: unmarked until it is marked again
    if (state.doc === i) { world?.inspector.turnTo(i); paintCase(); caseHUD(); } else goToDoc(i);
    announce(`${e.title} taken out of the folder. Mark it again.`);
  },
  doc(dir) {
    if (busy || !inspecting()) return;
    clearTimeout(advanceTimer); if (!panel.classList.contains("empty")) composer("");
    const nextDoc = Math.max(0, Math.min(C.evidence.length - 1, state.doc + Number(dir)));
    if (nextDoc === state.doc) return;
    state.doc = nextDoc; save();
    world?.inspector.turnTo(nextDoc); paintCase(); caseHUD(); if (textMode) render();
    announce(`${C.evidence[state.doc].title}. ${state.doc + 1} of 18.`);
  },
  filter(f) { state.filter = f; save(); render(); },
  openFile() { if (!busy && state.page === "P03") { composer(""); openCaseFile(); } },
  putBack() { if(textMode){textMode=false;render();return;} if (world?.inspector.active) { world.inspector.exit(); } },
  zoom(d) { world?.inspector.zoomBy(Number(d) > 0 ? 1.35 : 1 / 1.35); },
  zoomPage() { world?.inspector.focusPage(); },
  reviewSources() { state.readyNoted = true; go("P04"); },
  toggleTalk() { autoFolded = false; requestAnimationFrame(reserveSpace); panel.classList.toggle("folded"); syncGlobeLabel(); document.body.classList.toggle("talking", !panel.classList.contains("folded")); orb.place(panel.classList.contains("folded") ? "rest" : "prompt", { activate: false }); },
  notebook() { modal(`<h2>Analyst’s notebook</h2><p>${esc(state.name) || "Name not set"} · ${state.interest ? "Connection to Tamarind Crossing declared" : "Declaration pending"}</p><p>${Object.keys(state.tags).length} sources tagged · ${state.runs.length} model tests · ${state.hallRuns.length} response tests</p><h3>Your findings</h3><p>${esc(state.why) || "Not submitted yet."}</p><h3>Response rationale</h3><p>${esc(state.rationale) || "Not submitted yet."}</p>${b("Download record", "download")}`); },
  viewReset() { world?.view("iso"); },
  viewTop() { world?.view("top"); },
  viewIn() { world?.view("in"); },
  viewFront() { world?.view("front"); },
  viewOut() { world?.view("out"); },
  feedback() { if (state.feedback) { state.feedbackSeen = true; save(); railTools(); modal(state.feedback); } },
  settings() { modal(`<h2>Settings</h2><label class="settings-row">Reduced motion<input type="checkbox" data-setting="reduced" ${state.settings.reduced ? "checked" : ""}></label><label class="settings-row">Sound<input type="checkbox" data-setting="sound" ${state.settings.sound ? "checked" : ""}></label><label class="settings-row">Voice<input type="checkbox" data-setting="voice" ${state.settings.voice !== false ? "checked" : ""}></label><label class="settings-row">Captions<input type="checkbox" data-setting="captions" ${state.settings.captions ? "checked" : ""}></label><div class="row">${b(paused ? "Resume" : "Pause", "pause")}${b("Replay intro", "replayIntro")}</div><p class="muted">Characters speak their lines aloud; the words stay on screen.</p>`); },
  readText() { modal(readerHTML(state.doc) + row(b("Add to Foundations", "tagClose", "foundations", "primary"), b("Set aside", "tagClose", "aside"))); },
  tagClose(v) { close(); actions.tag(v); },
  reviewDoc(i) { state.doc = +i; go("P03"); },
  showDoc(i) { composer(""); goToDoc(+i); },
  hideHint() { state.hintSeen = true; save(); composer(""); },
  commitEvidence() { if (!E.evidenceReady(state.tags)) return; state.strands[0] = E.sourcing(state.tags); go("P05"); },
  year(d) { state.year = Math.max(0, Math.min(4, state.year + Number(d))); render(); },
  caseNotes() { modal(`<h2>Case notes</h2>${C.notes.map((n) => `<details><summary>${esc(n.title)}</summary><p>${esc(n.text)}</p></details>`).join("")}`); },
  condition() { const f = C.factors.find((f) => f.id === $("#factor").value); modal(`<h2>${esc(f.title)}</h2><p><strong>As it happened:</strong> ${esc(f.base)}</p><p><strong>Alternative:</strong> ${esc(f.alternative)}</p>${row(b("Keep base condition", "factorBase", f.id), b("Use alternative", "factorAlt", f.id, "primary"))}`); },
  factorBase(id) { state.selected = state.selected.filter((x) => x !== id); close(); save(); render(); },
  factorAlt(id) { state.selected = [...new Set([...state.selected, id])]; close(); save(); render(); },
  changes() { modal(`<h2>Conditions for the next test</h2>${C.factors.map((f) => `<p><strong>${esc(f.title)}</strong><br>${esc(state.selected.includes(f.id) ? f.alternative : f.base)}</p>`).join("")}`); },
  runModel() {
    if (busy) return;
    const snapshot = [...state.selected];                       // snapshot selection; compute once
    const outcome = E.trajectory(snapshot);                     // pure and synchronous: the run animates this result
    simOutcome = outcome.outcome;
    state.page = "P06"; render();
    ritual(1100, () => { state.runs.push({ ...outcome, at: new Date().toISOString() }); state.runView = state.runs.length - 1; state.year = 0; state.page = "P07"; },
      () => setTimeout(() => spotlight(`institution:${OUTCOME_PLACE[state.runs.at(-1)?.outcome] || "Government"}`, 2800), 700), "orizon");
  },
  compare() { modal(`<h2>Compare at Year ${2 + state.year * 2}</h2><p><strong>Base case · Coup</strong><br>${C.headlines.Coup[state.year]}</p>${state.runs.map((r, i) => `<p><strong>Test ${i + 1} · ${r.outcome}</strong><br>${esc(r.headlines[state.year])}<br><small>Changed: ${r.selected.join(", ") || "None"}</small></p>`).join("")}`); },
  finding(id) { snapshotDrafts(); if (state.findings.includes(id)) state.findings = state.findings.filter((x) => x !== id); else if (state.findings.length < 3) state.findings.push(id); else announce("Choose up to three factors."); save(); if (panel.querySelector(".picker")) updatePicker("findings"); else render(); },
  pickItem(arg) { const [key, id] = arg.split("|"), P = PICKERS[key]; snapshotDrafts(); P.toggle(id); save(); updatePicker(key); if (!P.multi) actions.pickerToggle(); },
  pickerToggle() { const p = panel.querySelector(".picker"); if (!p) return; const open = !p.classList.contains("open"); p.classList.toggle("open", open); p.querySelector(".pick").setAttribute("aria-expanded", open); if (open) p.querySelector(".pick-item")?.focus({ preventScroll: true }); },
  hallDetails() { modal(`<h2>Thursday · Tamarind Crossing</h2><p>The Electoral Commission has revised the boundaries of two districts. A journalist wants the Dialogue’s findings; a rally is planned; a corruption allegation concerns a Commission contractor; and there are rumours at the barracks.</p><p><strong>Press reaction</strong><br>${C.press[state.weather] || C.press.Calm}</p>`); },
  choice(id) { state.choices[C.levers[state.lever].id] = id; save(); render(); },
  lever(d) { const next = state.lever + Number(d); if (next > 4) { go("P11"); return; } state.lever = Math.max(0, next); save(); render(); },
  editLever(i) { state.lever = +i; go("P10"); },
  runHall() { snapshotDrafts(); try { const r = E.response(state.choices, state.weather); ritual(900, () => { state.hallRuns.push(r); state.page = "P11"; }); } catch (e) { announce(e.message); composer(`${speaker("Response plan", "Before you test")}<p>${esc(e.message)}</p>${row(b("Back to the plan", "editLever", "0", "primary"))}`); } },
  closeAndPlan() { close(); go("P10"); },
  checkBrief() { snapshotDrafts(); state.showTopicCheck=true; render(); },
  recordConsent() { snapshotDrafts(); modal(`<h2>Record your briefing</h2><p>Your microphone records only after you choose Allow and start. Audio stays in this tab unless you download it, and you can delete it. Automatic transcription is not connected, so the topic check will show as unavailable for audio.</p>${row(b("Allow and start", "recordStart", "", "primary"), b("Type instead", "typeInstead"))}`); },
  typeInstead() { stopMedia(); close(); go("P13"); },
  async recordStart() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = []; recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        world?.setRecording(false); stopMeter();
        audioBlob = new Blob(chunks, { type: recorder.mimeType });
        if (recordingURL) URL.revokeObjectURL(recordingURL);
        recordingURL = URL.createObjectURL(audioBlob); stream.getTracks().forEach((t) => t.stop());
        $("#drawerBody").innerHTML = `<h2>Review recording</h2><audio controls src="${recordingURL}"></audio><p>You can send the recording without a transcript. Topic check unavailable until a transcript is added.</p>${row(b("Send recording", "sendAudio", "", "primary"), b("Delete and retry", "deleteAudio"), b("Type transcript", "typeInstead"), b("Download audio", "downloadAudio"))}`;
      };
      recorder.start(); world?.setRecording(true);
      $("#drawerBody").innerHTML = `<div class="rec-globe" aria-hidden="true"></div><h2 style="text-align:center"><span aria-hidden="true" style="color:var(--danger)">●</span> Recording</h2><p style="text-align:center">Aim for about sixty seconds. There is no countdown.</p><div class="row" style="justify-content:center">${b("Stop recording", "recordStop", "", "primary")}</div>`;
      startMeter(stream, $("#drawerBody .rec-globe"));
    } catch { stopMedia(); $("#drawerBody").innerHTML = `<p>Microphone unavailable. You can type the same briefing.</p>${b("Type briefing", "typeInstead", "", "primary")}`; }
  },
  recordStop() { if (recorder?.state !== "inactive") recorder.stop(); },
  sendAudio() { state.recorded = true; close(); go("P14"); },
  deleteAudio() { stopMedia(); audioBlob = null; if (recordingURL) URL.revokeObjectURL(recordingURL); recordingURL = ""; actions.recordConsent(); },
  downloadAudio() { if (recordingURL) download(recordingURL, "analyst-briefing.webm"); },
  whyResults() { modal(`<h2>Why it happened</h2><p>Weak source claims can distort the background. The model makes F7 (diversity) neutral. The army and the rules on power work together; no single factor is a universal explanation.</p><p>The response balances evidence, participation, confidence and tension. Over-budget packages lose confidence and tension-easing points. The briefing itself is unscored.</p><p>These are teaching rules, not predictions of real politics.</p>`); },
  reflect() { modal(`<h2>Reflection · optional</h2>${C.reflections.map((q, i) => `<label>${esc(q)}<textarea data-reflection="${i}">${esc(state.reflection[i])}</textarea></label>`).join("")}`); },
  download() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob); download(url, "analyst-record.json"); setTimeout(() => URL.revokeObjectURL(url), 1000); },
  restart() { modal(`<h2>Restart simulation?</h2><p>Your saved choices and briefing text will be cleared.</p>${b("Restart", "newRun", "", "primary")}`); },
  pause() { paused = !paused; orb.paused = paused; world?.setPaused(paused); document.getAnimations().forEach((a) => (paused ? a.pause() : a.play())); document.querySelectorAll("audio,video").forEach((a) => { if (paused) a.pause(); }); close(); railTools(); },
  institution(name) {
    if (markers) { markers.openCard(`institution:${name}`); return; }
    modal(`<h2>${esc(name)}</h2><p>${esc(INSTITUTIONS[name])}</p><small>A symbolic part of the teaching model. Looking at it never changes a test.</small>`);
  },
  async retryAssets() { $("#toast").classList.remove("on"); for (const n of ["office", "casefile"]) await ensureAsset(n); },
};
const INSTITUTIONS = {
  Government: "Where the rules on power are made and contested: who holds office, for how long, and under what checks.",
  Barracks: "The army: its loyalty, its recruitment and who controls it.",
  Radio: "Communication: how news, rumour and official statements reach people across Kalinda.",
  Market: "The economy people live from: trade, prices and livelihoods.",
};

function download(url, name) { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
// the Strands globe follows the microphone level while recording (<Strands level={micLevel} />)
function startMeter(src, el) {
  try {
    audioCtx = new AudioContext(); const an = audioCtx.createAnalyser(); an.fftSize = 512;
    audioCtx.createMediaStreamSource(src).connect(an);
    const buf = new Float32Array(an.fftSize);
    recStrands = new Strands(el, { level: 0, glassSize: 1.05 }); orb.hold(true, "listening");
    let lv = 0;
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += v * v;
      lv += (Math.min(1, Math.sqrt(sum / buf.length) * 5) - lv) * 0.35;
      recStrands?.set({ level: lv }); meterRAF = requestAnimationFrame(tick);
    };
    tick();
  } catch { recStrands?.set({ level: undefined, listening: true }); }
}
function stopMeter() { orb.hold(false, "listening"); cancelAnimationFrame(meterRAF); recStrands?.destroy(); recStrands = null; audioCtx?.close(); audioCtx = null; }
function stopMedia() { stopMeter(); if (recorder?.state === "recording") recorder.stop(); stream?.getTracks().forEach((t) => t.stop()); world?.setRecording(false); }

// ---------------------------------------------------------------- events
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]"); if (!el) return;
  if (busy && el.dataset.action !== "pause") return;
  e.preventDefault(); actions[el.dataset.action]?.(el.dataset.arg);
});
document.addEventListener("input", (e) => {
  if (["why", "rationale", "brief"].includes(e.target.id)) { state[e.target.id] = e.target.value; save(); }
  if (e.target.dataset.reflection !== undefined) { state.reflection[+e.target.dataset.reflection] = e.target.value; save(); }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.setting) {
    state.settings[e.target.dataset.setting] = e.target.checked; if (!state.settings.voice || !state.settings.sound) stopLine();
    orb.reduced = state.settings.reduced; world?.setReduced(state.settings.reduced); if (trays) trays.reduced = state.settings.reduced; if (reel) reel.reduced = state.settings.reduced;
    document.body.classList.toggle("reduced", state.settings.reduced); save();
  }
});
document.addEventListener("submit", (e) => {
  const kind = e.target.dataset.form; if (!kind) return;
  e.preventDefault(); if (busy) return;
  const values = new FormData(e.target);
  if (kind === "identity") {
    const n = String(values.get("name")).trim();
    if (!n) { $("#nameHelp").textContent = "Enter a name of 1 to 60 characters."; return; }
    state.name = n.slice(0, 60); go("P02");
  }
  if (kind === "findings") {
    snapshotDrafts();
    if (!state.findings.length || !state.why.trim()) { formError(e.target, "Choose at least one factor and write a sentence."); return; }
    // a decision that moves the story on is asked by the agent, where the learner is looking (not in the rail)
    if (!state.runs.length && !state.noRunAck) { state.noRunAck = true; composer(`${speaker("Dr Amina Diallo", "Research Director")}<p>You haven’t tested your explanation on the model yet. Run a test first, or send your findings as they are?</p>${row(b("Run a test", "closeToModel", "", "primary"), b("Send anyway", "submitFindings"))}`); return; }
    submitFindings();
  }
  if (kind === "rationale") {
    snapshotDrafts(); if (!state.rationale.trim()) { formError(e.target, "Write a sentence or two about the trade-offs first."); return; }
    let r; try { r = E.response(state.choices, state.weather); } catch { actions.runHall(); return; }
    ritual(4000, () => { state.strands[2] = r.strand; state.finalResponse = r; state.page = "P12"; }, () => queueFeedback(`${personHead("Grace Mwangi", "Dialogue response")}<p>${esc(E.dialogue(r))}</p>`));
  }
  if (kind === "brief") { snapshotDrafts(); if (state.brief.trim()) { state.briefCheck = E.briefingCheck(state.brief); go("P14"); } else formError(e.target, "Write your briefing for the Chair first."); }
});
function queueFeedback(html) { state.feedback = html; state.feedbackSeen = false; save(); announce("New feedback is in the tools menu."); railTools(); }
function formError(form, text) {
  form.querySelector(".err")?.remove();
  form.insertAdjacentHTML("beforeend", `<small class="err" role="alert">${esc(text)}</small>`);
}
function submitFindings() {
  close();
  ritual(3000, () => { state.strands[1] = E.findings(state.findings); state.weather = E.climate(state.strands[0], state.strands[1]); state.page = "P09"; },
    () => queueFeedback(`<h2>Dr Amina Diallo</h2><p>${C.diallo[state.strands[1]]}</p>`));
}
actions.submitFindings = submitFindings;
actions.closeToModel = () => { close(); go("P05"); };
addEventListener("keydown", (e) => {
  if (drawer.open || !inspecting() || state.page !== "P03") return;
  if (e.key === "Escape" && menuEl.hidden) { actions.putBack(); return; }
  if (e.target.closest?.("input,textarea,select")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown") { actions.doc("1"); e.preventDefault(); }
  if (e.key === "ArrowLeft" || e.key === "PageUp") { actions.doc("-1"); e.preventDefault(); }
  if (!menuEl.hidden) return;
  if (e.key === "+" || e.key === "=") actions.zoom(1);
  if (e.key === "-") actions.zoom(-1);
  if (e.key === "f" || e.key === "F") actions.tag("foundations");
  if (e.key === "s" || e.key === "S") actions.tag("aside");
});
addEventListener("keydown", (e) => { if (e.key === "Escape" && !menuEl.hidden) { closeMenu(); $("#agentButton").focus(); } });
addEventListener("beforeunload", () => { stream?.getTracks().forEach((t) => t.stop()); save(); });

/** The agent "speaks": its main line arrives word by word while the globe pulses with it. Inputs and buttons are
 *  never delayed. Screen readers get the whole line at once (the spans are presentational). */
function streamWords() {
  const line = panel.querySelector(":scope > p:not(.who), :scope form > label");
  if (!line || state.settings.reduced || line.dataset.streamed) return;
  line.dataset.streamed = "1";
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT); const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let k = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const part of n.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = document.createElement("span"); w.className = "w"; w.style.setProperty("--w", k++); w.textContent = part; frag.append(w);
    }
    n.replaceWith(frag);
  }
  line.setAttribute("aria-label", line.textContent);
  // think, then speak: the globe changes form for a beat, then pulses while the words arrive
  const words = k;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (busy) return;
    orb.place("working");
    setTimeout(() => { if (orb.phase === "working" && !busy) orb.place("prompt"); if (!(voiceIds(line.textContent).length && state.settings.sound !== false && state.settings.voice !== false)) orb.speak(Math.min(2600, 200 + words * 34)); }, 560);
  }));
}

// ---------------------------------------------------------------- the director (v3.1): camera moves that keep the model alive
// Acting moves the camera to what the action is about (choosing a factor glides to its institution and points it
// out); after a quiet spell the camera tours the current points of interest. Any input stops the tour and returns.
const OUTCOME_PLACE = { Coup: "Barracks", "Personalised rule": "Government", Consolidation: "Radio" };
const FACTOR_PLACE = { F1: "Government", F2: "Barracks", F3: "Government", F4: "Market", F5: "Radio", F6: "Government", F7: "Market" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let directing = 0, touring = false, lastInput = performance.now(), simOutcome = null;
const calm = () => world && !busy && !paused && !inspecting() && !panelOpen() && !state.settings.reduced && !panel.querySelector("form, textarea");   // never while the learner has something to write
async function spotlight(id, hold = 2600) {
  const it = pinsFor(state.page).find((p) => p.id === id), obj = it?.get();
  if (!obj || !calm()) return;
  const run = ++directing;
  await world.focusOn(obj, { closer: .55, duration: 950 });
  if (run !== directing) return;
  markers?.openCard(id);
  await sleep(hold);
  if (run !== directing) return;
  markers?.closeCard(); await world.home(950);
}
document.addEventListener("change", (e) => { if (e.target.id === "factor" && FACTOR_PLACE[e.target.value]) spotlight(`institution:${FACTOR_PLACE[e.target.value]}`); });
function noteInput() { lastInput = performance.now(); if (touring) { touring = false; directing++; markers?.closeCard(); world?.home(700); } }
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, noteInput, true);
addEventListener("pointermove", (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) noteInput(); }, true);
// In the office room (the hall) the quiet-spell tour drifts between its rooms: conference table, meeting room, work area.
async function hallTour() {
  touring = true; const run = ++directing;
  for (const name of ["HALL_PlanningTable", "HALL_Room_Meeting", "HALL_Room_Work"]) {
    if (!touring || run !== directing) return;
    const obj = world.node("hall", name); if (!obj) continue;
    await world.focusOn(obj, { closer: .5, duration: 1700 });
    if (!touring || run !== directing) return;
    await sleep(3400);
  }
  if (touring && run === directing) { await world.home(1400); touring = false; lastInput = performance.now(); }
}
async function tour() {
  if (SCENE(state.page) === "hall") return hallTour();
  const list = pinsFor(state.page); if (!list.length) return;
  touring = true; const run = ++directing;
  for (const it of list) {
    if (!touring || run !== directing) return;
    const obj = it.get(); if (!obj) continue;
    await world.focusOn(obj, { closer: .6, duration: 1200 });
    if (!touring || run !== directing) return;
    markers?.openCard(it.id); await sleep(2800);
    if (!touring || run !== directing) return;
    markers?.closeCard(); await sleep(250);
  }
  if (touring && run === directing) { await world.home(1100); touring = false; lastInput = performance.now(); }
}
setInterval(() => {
  const typing = document.activeElement?.matches?.("input,textarea,select");
  if (!touring && !typing && calm() && state.page !== "P00" && performance.now() - lastInput > 18000) tour();
}, 1000);

// ---------------------------------------------------------------- v3 layout: the preview frame, rail tools, icons
const ib = (action, name, label, arg = "") =>
  `<button type="button" class="ib" data-action="${action}" data-arg="${esc(arg)}" aria-label="${esc(label)}">${icon(name)}<span class="tip" aria-hidden="true">${esc(label)}</span></button>`;
// The learner's place in the brief: six chapters, icon-first; the current one is named, the rest reveal on hover.
const CHAPTERS = [
  { pages: ["P01", "P02"], icon: "badge", title: "Arrival", line: "Introduce yourself and declare any connection." },
  { pages: ["P03", "P04"], icon: "files", title: "The evidence", line: "Read each source. Keep it in Foundations or set it aside." },
  { pages: ["P05", "P06", "P07", "P08"], icon: "map", title: "The model", line: "Change a condition in Kalinda and test what follows." },
  { pages: ["P09", "P10", "P11"], icon: "people", title: "The hall", line: "Design a response people can trust." },
  { pages: ["P12", "P13"], icon: "podium", title: "The briefing", line: "Brief the Chair in your own words." },
  { pages: ["P14"], icon: "seal", title: "Debrief", line: "See how your choices held together." },
];
let lastChapter = -1;
function chapterCard() {
  const el = $("#chapter"), i = CHAPTERS.findIndex((c) => c.pages.includes(state.page));
  if (i < 0) { el.hidden = true; lastChapter = -1; return; }
  el.hidden = false;
  const c = CHAPTERS[i], n = (k) => String(k).padStart(2, "0");
  const meta = ["P03", "P04"].includes(state.page) ? `${Object.keys(state.tags).length} of 18 sources reviewed`
    : c.icon === "map" ? `${state.runs.length} test${state.runs.length === 1 ? "" : "s"} run`
    : c.icon === "people" ? `${state.hallRuns.length} response test${state.hallRuns.length === 1 ? "" : "s"}` : "";
  const steps = CHAPTERS.map((s, k) => `<li class="step ${k < i ? "done" : k === i ? "now" : ""}" tabindex="0" aria-label="Chapter ${k + 1}, ${esc(s.title)}${k < i ? ", done" : k === i ? ", current" : ""}">${icon(s.icon)}<span class="tip" aria-hidden="true">${esc(s.title)}</span></li>`).join("");
  // v3.2: no chapter numbers or progress counts; the learner sees where they are, not a tally
  void n; void meta;
  el.innerHTML = `<div class="ch-head" tabindex="0" role="button" aria-expanded="false"><span class="ch-icon">${icon(c.icon)}</span><span class="ch-text"><h2>${esc(c.title)}</h2></span></div>
    <div class="ch-more"><div><p>${esc(c.line)}</p><ol class="steps">${steps}</ol></div></div>`;
  const head = el.querySelector(".ch-head");
  head.onclick = () => { el.classList.toggle("open"); head.setAttribute("aria-expanded", el.classList.contains("open")); };
  head.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); head.click(); } };
  if (i !== lastChapter) { if (lastChapter !== -1 && !state.settings.reduced) { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); } announceRail(); }
  lastChapter = i;
}
/** The rail speaks up when something new arrives, then steps back to small tags so the preview is the focus. */
let announceTimer = 0;
function announceRail(ms = 5200) {
  document.body.classList.add("rail-announce"); clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { document.body.classList.remove("rail-announce"); reserveSpace(); }, state.settings.reduced ? ms : ms);
  requestAnimationFrame(reserveSpace);
}
function railReserved() {
  return document.body.classList.contains("rail-announce") || panelOpen() || !!stage.querySelector('.card:not(.peek)') && stage.dataset.layout !== "hero";
}
function railTools() {
  // v3.2: one quiet button; hovering (or focusing) it unfolds the tools beside it
  const t = [ib("notebook", "notebook", "Notebook")];
  if (state.feedback) t.push(ib("feedback", "feedback", "Latest feedback"));
  t.push(ib("settings", "settings", "Settings"), ib("pause", paused ? "play" : "pause", paused ? "Resume" : "Pause"));
  const news = state.feedback && !state.feedbackSeen;   // unread feedback: a small orange dot on the tools button
  $("#railTools").innerHTML = `<div class="tools-more">${t.join("")}</div><button type="button" class="ib tools-key ${news ? "news" : ""}" aria-label="${news ? "Tools, new feedback" : "Tools"}" aria-haspopup="true">${icon("grid")}</button>`;
}
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
  el.insertAdjacentHTML("beforeend", `<span class="tip" aria-hidden="true">${esc(el.getAttribute("aria-label"))}</span>`);
});
/** Tell the 3D view where the preview frame is, and expose its centre for the agent and document controls. */
function syncFrame() {
  const el = $("#frame"), r = el.getBoundingClientRect(), root = document.documentElement.style;
  root.setProperty("--fcx", `${r.left + r.width / 2}px`); root.setProperty("--fw", `${r.width}px`);
  world?.setFrame({ x: r.left, y: r.top, w: r.width, h: r.height, r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 });
  reserveSpace();
}
new ResizeObserver(() => syncFrame()).observe($("#frame"));
/** What the page occupies inside the frame, so the model reframes into the free space instead of sitting under it. */
function reserveSpace() {
  if (!world) return;
  const f = $("#frame").getBoundingClientRect(), narrow = innerWidth < 700;
  let bottom = 0, left = 0;
  const open = !panel.classList.contains("empty") && !panel.classList.contains("folded");
  if (open) bottom = Math.max(0, f.bottom - panel.getBoundingClientRect().top + 28);
  else if ($("#agent").dataset.phase !== "hidden" && !inspecting()) bottom = 96;   // keep the folded globe off the floor
  // P00: the title has its own white panel beside the frame, so the office needs no reserve
  let right = 0;
  if (!narrow && state.page !== "P00" && railReserved()) right = Math.max(0, f.right - $("#rail").getBoundingClientRect().left + 16);
  world.setReserve({ bottom, left, right });
  guardSoon();
}
new ResizeObserver(() => reserveSpace()).observe(panel);

// ---------------------------------------------------------------- the title screen's reel and hover previews
// The reel shows things from the whole story, in story order; hovering a piece of the office shows it there instead.
async function fillReel() {
  if (!reel) return;
  await ensureAsset("casefile");
  const file = world?.node("casefile", "CASEFILE_Root");
  if (file) reel.setDefault(file, "The case file");          // the default piece; hovering the office swaps it
}
const OFFICE_NAMES = { FURN_Desk_EvidenceReview: "The desk", FURN_Chair_Officer: "Your chair", FURN_Chair_Visitor: "Visitor’s chair",
  FURN_Table_Records: "Records table", FURN_WasteBin: "Waste bin", PROP_DeskLamp_Office: "Desk lamp", PROP_FileBoxes_Records: "File boxes",
  PROP_Mug_Coffee: "Coffee mug", PROP_Notepad: "Notepad", PROP_PencilStand: "Pencils", PROP_PowerStrip_Records: "Power strip",
  PROP_Records_Workstation: "Records computer", STORAGE_Bookcase_CaseFiles: "Case-file bookcase", STORAGE_Cabinet_Low: "Low cabinet",
  STORAGE_Cabinet_Wall: "Wall cabinet", STORAGE_MetalShelf_CaseFiles: "Archive shelves", STORAGE_Sideboard_South: "Sideboard",
  DECOR_Plant_Cactus: "Cactus", DECOR_Book_Loose_01: "Books", DECOR_Book_Loose_02: "Books", CASEFILE_Root: "The case file" };
// node names end ".001" in the file; three.js drops the dot, so strip an optional dot and three digits
const officeLabel = (o) => { const k = o.name.replace(/\.?\d{3}$/, ""); return OFFICE_NAMES[k] || k.replace(/^[A-Z]+_/, "").replace(/_/g, " "); };
let hovered = null, hoverTimer = 0, hoverRaf = 0;
function hoverOff(now) {
  clearTimeout(hoverTimer); if (!hovered) return;
  const done = () => { hovered = null; world?.highlight(null); reel?.preview(null); $("#world").style.cursor = ""; };
  if (now) done(); else hoverTimer = setTimeout(done, 450);
}
addEventListener("pointermove", (e) => {
  if (state.page !== "P00" || busy || !world || !reel || hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    const f = $("#frame").getBoundingClientRect(), inside = e.clientX > f.left && e.clientX < f.right && e.clientY > f.top && e.clientY < f.bottom;
    const o = inside && !e.target.closest?.("#stage, button") ? world.pickAt(e.clientX, e.clientY) : null;
    if (!o) { hoverOff(); return; }
    clearTimeout(hoverTimer);
    if (o === hovered) return;
    hovered = o; reel.preview(o, officeLabel(o)); world.highlight(o); $("#world").style.cursor = "default";   // copy before the glow is applied
  });
});

// ---------------------------------------------------------------- boot
// ---- the opener film. Plays once per saved run on this device (the sandbox keeps its own flag), never under reduced
// motion; ?opener=1 forces it, ?opener=0 turns it off. Settings → Replay intro plays it again. It never blocks the app:
// the title screen and the 3D world load underneath, and a missing or failed file simply closes it.
const OPENER_KEY = KEY + "-opener-seen";
// Opener music bed (public/audio/opener_music.mp3): plays with the muted film; follows the Sound setting.
let openerMusic = null;
function musicFade(a, ms = 500) {
  if (!a || a.paused) return;
  const v0 = a.volume, t0 = performance.now();
  const step = (n) => { const k = Math.max(0, Math.min(1, (n - t0) / ms)); a.volume = Math.max(0, v0 * (1 - k)); if (k < 1) requestAnimationFrame(step); else a.pause(); };
  requestAnimationFrame(step);
}
function playOpener(force = false) {
  const el = $("#opener"), video = $("#openerVideo"), skip = $("#openerSkip"), q = new URLSearchParams(location.search).get("opener");
  let seen = false; try { seen = localStorage.getItem(OPENER_KEY) === "1"; } catch {}
  if (!el || q === "0" || (!force && q !== "1" && (seen || state.settings.reduced))) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      try { localStorage.setItem(OPENER_KEY, "1"); } catch {}
      removeEventListener("keydown", onKey); musicFade(openerMusic); $("#openerSound")?.remove();
      el.classList.add("out");
      setTimeout(() => { el.hidden = true; el.classList.remove("out", "ending"); video.pause(); video.removeAttribute("src"); video.load(); resolve(); }, 440);
      $("#stage")?.querySelector("button")?.focus({ preventScroll: true });
    };
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } };
    el.hidden = false; el.classList.remove("out", "ending");
    video.src = "/opener/opener.mp4"; video.currentTime = 0;
    video.onended = finish; video.onerror = finish;
    video.ontimeupdate = () => { if (video.duration && video.currentTime > video.duration - 4) el.classList.add("ending"); };
    skip.onclick = finish; addEventListener("keydown", onKey);
    video.play().catch(finish);
    if (state.settings.sound !== false) {
      openerMusic ??= new Audio(`${import.meta.env.BASE_URL}audio/opener_music.mp3`);
      const m = openerMusic; m.currentTime = 0; m.volume = .8;
      m.play().catch(() => {                          // sound blocked until a click: offer a button
        if ($("#openerSound")) return;
        skip.insertAdjacentHTML("beforebegin", `<button id="openerSound" type="button">Sound on</button>`);
        $("#openerSound").onclick = (e) => { e.currentTarget.remove(); m.currentTime = video.currentTime; m.play().catch(() => {}); skip.focus({ preventScroll: true }); };
      });
    }                       // muted autoplay is allowed; if a browser still refuses, go straight to the title
    skip.focus({ preventScroll: true });
  });
}

async function boot() {
  playOpener();
  try {
    world = createWorld({ canvas: $("#world"), layout, onHotspot: hotspot, onInspect, onError: ({ name }) => console.warn("asset failed", name) });
    world.setReduced(state.settings.reduced);
    reel = createReel({ canvas: $("#reelCanvas"), panel: $("#titlePanel") }); reel.reduced = state.settings.reduced;
    trays = createTrays({ url: "/models/folders.glb", onPick: (k) => actions.openTray(k) }); trays.reduced = state.settings.reduced;
    markers = createMarkers({ world, layer: $("#pins"), onPick: (id) => hotspot(id),
      shouldShow: () => !busy && !paused && !inspecting() && !drawer.open && state.page !== "P00",
      frame: () => {           // the empty part of the preview: above the conversation when it is open
        const r = $("#frame").getBoundingClientRect(), open = !panel.classList.contains("empty") && !panel.classList.contains("folded");
        const rr = railReserved() && innerWidth >= 700 ? $("#rail").getBoundingClientRect().left - 12 : r.right - 230;   // keep clear of the rail tags
        return { l: r.left, t: r.top, r: Math.min(r.right, rr), b: open ? Math.min(r.bottom, panel.getBoundingClientRect().top - 8) : r.bottom - 80 };
      } });
  } catch (err) {
    console.warn("WebGL unavailable; continuing with text controls", err); world = null;
    document.body.classList.add("no-webgl"); status("3D view unavailable on this device. Everything works with the text controls.");
  }
  render();
  if (world) {
    await ensureAsset("office");
    await ensureAsset("casefile");
    ensureAsset("kalinda");                    // initial set (kit budget), finishes in the background
    fillReel();
  }
  if (DEV) devNav();
}
function hotspot(id) {
  if (busy) return;
  if (id === "caseFile" && state.page === "P02" && state.interest) go("P03");
  else if (id === "caseFile" && state.page === "P03" && !inspecting()) actions.openFile();
  if (id.startsWith("institution:") && SCENE(state.page) === "model") actions.institution(id.split(":")[1]);
  if (id === "recorder" && state.page === "P12") actions.recordConsent();
  if (id === "notebook" && state.page === "P12") go("P13");
}
// Explicit development-only navigation. Never enabled in a learner release.
function devNav() {
  const select = document.createElement("select");
  select.id = "devNav";
  select.setAttribute("aria-label", "Developer state navigation");
  select.style.cssText = "position:fixed;bottom:8px;right:8px;width:100px;z-index:10";
  // Hidden by default; Cmd/Ctrl+Shift+H shows or hides it (remembered on this device).
  let shown = false; try { shown = localStorage.getItem("ab-devnav") === "1"; } catch {}
  select.hidden = !shown;
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
      e.preventDefault(); select.hidden = !select.hidden;
      try { localStorage.setItem("ab-devnav", select.hidden ? "0" : "1"); } catch {}
    }
  });
  select.innerHTML = Array.from({ length: 15 }, (_, i) => `<option>P${String(i).padStart(2, "0")}</option>`).join("");
  select.onchange = () => { state.name ||= "Preview analyst"; state.interest = true; state.weather ||= "Calm"; go(select.value); };
  document.body.append(select);
  window.__ab = { get state() { return state; }, world: () => world, reel: () => reel, go, actions };
}
boot();
