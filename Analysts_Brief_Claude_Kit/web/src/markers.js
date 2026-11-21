// Points of interest that never cover the model (design v3 §5).
// In the scene each point is a small glass dot. Hover or focus it and a short motion-graphics sequence plays:
//   highlight the object → corner brackets lock onto it → a dotted leader draws out to the nearest empty margin →
//   a glass callout (kicker / serif title / one line) settles at its end.
// Leaving reverses at about twice the speed. Clicking a dot does what clicking its object does.
// A Bino-style question capsule may float up once per scene after the learner has been idle for a while.
import * as THREE from "three";

const IN_MS = 560, OUT_MS = 260, CARD_W = 248, CARD_H = 132, PAD = 22;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const back = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // spring-like overshoot
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export function createMarkers({ world, layer, onPick, shouldShow, frame }) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "callout-svg"); svg.setAttribute("aria-hidden", "true");
  const brackets = document.createElementNS(NS, "path"); brackets.setAttribute("class", "brackets");
  const lead = document.createElementNS(NS, "line"); lead.setAttribute("class", "lead");
  const tipDot = document.createElementNS(NS, "circle"); tipDot.setAttribute("class", "lead-end"); tipDot.setAttribute("r", "3");
  svg.append(brackets, lead, tipDot); layer.append(svg);
  const card = document.createElement("section"); card.className = "callout"; card.setAttribute("role", "tooltip"); card.id = "callout";
  layer.parentElement.append(card);

  let items = [], key = "", raf = 0, active = null, last = performance.now(), idleSince = performance.now(), asked = new Set();
  const box = new THREE.Box3(), v = new THREE.Vector3(), corners = Array.from({ length: 8 }, () => new THREE.Vector3());

  function dot(it, i) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "poi"; b.style.setProperty("--i", i);
    b.setAttribute("aria-label", it.label); b.setAttribute("aria-describedby", "callout");
    b.innerHTML = `<span class="poi-ring" aria-hidden="true"></span><span class="poi-core" aria-hidden="true"></span>`;
    const enter = () => show(it, false), leave = () => { if (!active?.sticky) hide(it); };
    b.addEventListener("pointerenter", enter); b.addEventListener("pointerleave", leave);
    b.addEventListener("focus", enter); b.addEventListener("blur", leave);
    b.addEventListener("click", (e) => { e.stopPropagation(); world.highlight(null); onPick(it.id); });
    return b;
  }

  /** list: [{ id, label, kicker, title, line, get: () => Object3D|null }] */
  function set(list) {
    const k = list.map((m) => m.id).join("|");
    if (k === key) return;
    key = k; hide(null, true); idleSince = performance.now();
    for (const it of items) { it.b.classList.remove("on"); const b = it.b; setTimeout(() => b.remove(), 160); }
    items = list.map((m, i) => { const it = { ...m, seen: false }; it.b = dot(it, i); layer.append(it.b); return it; });
  }

  function show(it, sticky) {
    idleSince = performance.now(); quiet();
    if (active?.it === it) { active.dir = 1; active.sticky ||= sticky; return; }
    if (active) hide(null, true);
    active = { it, p: 0, dir: 1, sticky };
    card.innerHTML = `<span class="kicker">${it.kicker || ""}</span><h3>${it.title || it.label}</h3>${it.line ? `<p>${it.line}</p>` : ""}${it.meta ? `<small>${it.meta}</small>` : ""}`;
    world.highlight(it.get());
  }
  function hide(it, instant) {
    if (!active || (it && active.it !== it)) return;
    if (instant) { active = null; world.highlight(null); render(null); return; }
    active.dir = -1; active.sticky = false;
  }
  /** Keep a callout open (keyboard or click on an institution). */
  function openCard(id) { const it = items.find((i) => i.id === id); if (!it) return; if (active?.it === it && active.sticky) { hide(it); return; } show(it, true); }

  // ---- projection helpers
  function screenBox(obj) {
    box.setFromObject(obj); if (box.isEmpty()) return null;
    const { min, max } = box; let i = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners[i++].set(x, y, z);
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const c of corners) { v.copy(c).project(world.camera); const sx = (v.x + 1) * innerWidth / 2, sy = (1 - v.y) * innerHeight / 2; l = Math.min(l, sx); r = Math.max(r, sx); t = Math.min(t, sy); b = Math.max(b, sy); }
    return { l, t, r, b };
  }
  function anchorOf(obj) {
    box.setFromObject(obj); if (box.isEmpty()) return null;
    box.getCenter(v); v.y = box.max.y; v.project(world.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2, ok: v.z > -1 && v.z < 1 };
  }
  const rootOf = (o) => { while (o.parent && !/^ASSET_/.test(o.name)) o = o.parent; return o; };

  /** The callout goes into the widest empty margin of the frame around the model: right, left, then above. */
  function place(a, model) {
    const f = frame(), free = { top: f.t + PAD, bottom: f.b - PAD, left: f.l + 84, right: f.r - PAD };
    const cy = Math.min(Math.max(a.y - CARD_H / 2, free.top), free.bottom - CARD_H);
    if (free.right - model.r >= CARD_W + 36) return { x: free.right - CARD_W, y: cy, side: "right" };
    if (model.l - free.left >= CARD_W + 36) return { x: free.left, y: cy, side: "left" };
    if (model.t - free.top >= CARD_H + 28) return { x: Math.min(Math.max(a.x - CARD_W / 2, free.left), free.right - CARD_W), y: free.top, side: "top" };
    return { x: free.right - CARD_W, y: free.top, side: "corner" };
  }

  function render(state) {
    if (!state) { svg.classList.remove("on"); card.classList.remove("on"); card.style.opacity = ""; return; }
    const { a, ob, pos, p } = state;
    svg.classList.add("on");
    // 1. brackets lock on: start 10px out, close in, fade up (0–35%)
    const bp = ease(seg(p, 0, .35)), o = (1 - bp) * 10, L = Math.max(8, Math.min(16, (ob.r - ob.l) / 4, (ob.b - ob.t) / 4));
    const l = ob.l - 8 - o, t = ob.t - 8 - o, r = ob.r + 8 + o, b = ob.b + 8 + o;
    brackets.setAttribute("d", `M${l} ${t + L}V${t}H${l + L}M${r - L} ${t}H${r}V${t + L}M${r} ${b - L}V${b}H${r - L}M${l + L} ${b}H${l}V${b - L}`);
    brackets.style.opacity = bp;
    // 2. the dotted leader draws from the object to the callout (22–70%)
    const lp = ease(seg(p, .22, .7));
    const ex = pos.side === "right" ? pos.x : pos.side === "left" ? pos.x + CARD_W : Math.min(Math.max(a.x, pos.x + 24), pos.x + CARD_W - 24);
    const ey = pos.side === "top" || pos.side === "corner" ? pos.y + CARD_H : Math.min(Math.max(a.y, pos.y + 24), pos.y + CARD_H - 24);
    const x2 = a.x + (ex - a.x) * lp, y2 = a.y + (ey - a.y) * lp;
    lead.setAttribute("x1", a.x); lead.setAttribute("y1", a.y); lead.setAttribute("x2", x2); lead.setAttribute("y2", y2);
    lead.style.opacity = lp > 0 ? 1 : 0;
    tipDot.setAttribute("cx", x2); tipDot.setAttribute("cy", y2); tipDot.style.opacity = lp > .05 ? 1 : 0;
    // 3. the callout settles at the end of the line (58–100%)
    // 3. the callout springs out of the end of the line (grows from that point, overshoots, settles)
    const cr = seg(p, .58, 1), cp = ease(cr), sp = active?.dir < 0 ? cp : back(cr);
    const ox = ex - pos.x, oy = ey - pos.y;
    card.style.transformOrigin = `${ox}px ${oy}px`;
    card.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${.6 + sp * .4})`;
    card.style.opacity = Math.min(1, cr * 2.2); card.classList.toggle("on", cp > .5);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(64, now - last); last = now;
    const visible = shouldShow();
    layer.classList.toggle("on", visible);
    document.body.classList.toggle("scene-open", visible);
    for (const it of items) {
      const obj = visible ? it.get() : null, a = obj && anchorOf(obj);
      const f = frame(), vis = !!(a && a.ok && a.x > f.l + 8 && a.x < f.r - 8 && a.y > f.t + 8 && a.y < f.b - 8);
      if (vis) { it.b.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`; it.a = a; }
      if (vis !== it.seen) { it.seen = vis; it.b.classList.toggle("on", vis); it.b.tabIndex = vis ? 0 : -1; }
    }
    if (active) {
      const it = active.it, obj = visible && it.seen ? it.get() : null;
      if (!obj) { hide(null, true); }
      else {
        const reduced = document.body.classList.contains("reduced");
        active.p = reduced ? (active.dir > 0 ? 1 : 0) : Math.min(1, Math.max(0, active.p + active.dir * dt / (active.dir > 0 ? IN_MS : OUT_MS)));
        if (active.p <= 0 && active.dir < 0) hide(null, true);
        else {
          const ob = screenBox(obj), model = screenBox(rootOf(obj)) || ob;
          render({ a: it.a, ob, pos: place(it.a, model), p: active.p });
        }
      }
    }
    // the question capsule: once per scene, after 9s idle, never while something is open
    if (visible && !active && items.length && now - idleSince > 9000 && !asked.has(key)) ask(items[0]);
    if (!visible) quiet();
  }

  // ---- Bino-style question capsule
  const cap = document.createElement("button");
  cap.type = "button"; cap.className = "ask-capsule"; layer.parentElement.append(cap);
  let capTimer = 0, capItem = null;
  function ask(it) {
    if (!it.question || !it.a) { asked.add(key); return; }
    asked.add(key); capItem = it;
    cap.innerHTML = `<span class="spark" aria-hidden="true"></span><span>${it.question}</span>`;
    const f = frame();
    cap.style.left = `${Math.min(Math.max(it.a.x, f.l + 180), f.r - 180)}px`; cap.style.top = `${Math.max(f.t + 70, it.a.y - 92)}px`;
    cap.classList.add("on");
    clearTimeout(capTimer); capTimer = setTimeout(quiet, 6000);
  }
  function quiet() { cap.classList.remove("on"); clearTimeout(capTimer); }
  cap.addEventListener("click", () => { quiet(); if (capItem) { show(capItem, true); capItem.b.focus({ preventScroll: true }); } });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && active?.sticky) { e.stopPropagation(); hide(active.it); } }, true);
  document.addEventListener("pointerdown", (e) => { idleSince = performance.now(); if (active?.sticky && !e.target.closest(".poi") && !card.contains(e.target)) hide(active.it); });
  addEventListener("keydown", () => { idleSince = performance.now(); });

  raf = requestAnimationFrame(tick);
  return { set, openCard, closeCard: () => hide(null), dispose: () => cancelAnimationFrame(raf) };
}
