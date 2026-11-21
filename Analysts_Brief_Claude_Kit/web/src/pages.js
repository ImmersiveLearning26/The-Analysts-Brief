// Paints the kit's evidence onto the case-file sheets (CF_Page_01..18) as canvas textures.
// The same text is always available as HTML (the reader dialog and the live region), so the 3D page is never the
// only way to read a source.
import * as THREE from "three";

const W = 1024, H = Math.round(W * 1.4142);               // A4
const INK = "#1d1b18", MUTED = "#6d675c", RULE = "#b9752e";

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function paper(ctx) {
  ctx.fillStyle = "#fbf9f4"; ctx.fillRect(0, 0, W, H);   // near-white so body text keeps strong contrast
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(120,96,60,0.05)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** One sheet: title, source line, body, tag sticker, claim note, page count. */
export function drawEvidence(canvas, e, i, total, tag, note) {
  const ctx = canvas.getContext("2d");
  paper(ctx);
  // Sized for reading at laptop scale: the sheet shows ~380px wide at 1366x768, so 58px body type lands near 15px
  // on screen. The longest source is ~190 characters, so the larger type still fits with room for the claim note.
  const M = 80;
  ctx.fillStyle = MUTED; ctx.font = "600 26px Manrope, system-ui, sans-serif";
  ctx.fillText("THE COMMISSION · RESEARCH UNIT", M, 96);
  ctx.textAlign = "right"; ctx.fillText(`KAL/RU/2026/014 · ${String(i + 1).padStart(2, "0")}`, W - M, 96); ctx.textAlign = "left";
  ctx.fillStyle = INK; ctx.font = "600 74px 'Afacad Variable', Manrope, system-ui, sans-serif";   // title: Afacad
  let y = 200;
  for (const l of wrap(ctx, e.title, W - 2 * M - (tag ? 230 : 0))) { ctx.fillText(l, M, y); y += 80; }
  ctx.fillStyle = MUTED; ctx.font = "500 34px Manrope, system-ui, sans-serif";
  y += 4; ctx.fillText(e.source, M, y); y += 34;
  ctx.fillStyle = RULE; ctx.fillRect(M, y, W - 2 * M, 4); y += 84;
  ctx.fillStyle = INK; ctx.font = "66px Georgia, 'Iowan Old Style', 'Times New Roman', serif";   // ~15px on screen inside the v3 frame
  for (const l of wrap(ctx, e.text, W - 2 * M)) { ctx.fillText(l, M, y); y += 94; }
  if (note) {
    y += 34; ctx.font = "500 38px Manrope, system-ui, sans-serif";
    const lines = wrap(ctx, note, W - 2 * M - 48), h = lines.length * 52 + 40;
    ctx.fillStyle = "#f8edd6"; ctx.fillRect(M, y, W - 2 * M, h);
    ctx.fillStyle = RULE; ctx.fillRect(M, y, 8, h);
    ctx.fillStyle = INK; lines.forEach((l, k) => ctx.fillText(l, M + 34, y + 60 + k * 52));
  }
  if (tag) {                     // v3.2: a pen mark in the top-right corner: blue O = Foundations, red X = Set aside
    ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = 9;
    const cx = W - 118, cy = 190;
    if (tag === "aside") {
      ctx.strokeStyle = "#e0352b";
      ctx.beginPath(); ctx.moveTo(cx - 42, cy - 40); ctx.lineTo(cx + 40, cy + 42); ctx.moveTo(cx + 42, cy - 42); ctx.lineTo(cx - 40, cy + 40); ctx.stroke();
    } else {
      ctx.strokeStyle = "#2f6bff";
      ctx.beginPath(); ctx.ellipse(cx, cy, 50, 46, -0.2, 0.15, Math.PI * 2 + 0.35); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = MUTED; ctx.font = "500 28px Manrope, system-ui, sans-serif"; ctx.textAlign = "right";
  ctx.fillText(`${i + 1} of ${total}`, W - M, H - 70); ctx.textAlign = "left";
}

/** A page seen from a distance: lines of type, no words (used until a page is near the top of the pile). */
function drawBlank(canvas) {
  const ctx = canvas.getContext("2d");
  paper(ctx);
  ctx.fillStyle = "rgba(29,27,24,.75)"; ctx.fillRect(92, 160, 560, 40);
  ctx.fillStyle = "rgba(109,103,92,.6)"; ctx.fillRect(92, 228, 380, 18);
  ctx.fillStyle = RULE; ctx.fillRect(92, 270, W - 184, 3);
  ctx.fillStyle = "rgba(29,27,24,.28)";
  for (let y = 340; y < 900; y += 54) ctx.fillRect(92, y, W - 184 - ((y * 37) % 220), 16);
}

export class PageTextures {
  constructor(renderer) {
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    const c = document.createElement("canvas"); c.width = W / 2; c.height = H / 2;
    const ctx = c.getContext("2d"); ctx.scale(0.5, 0.5); drawBlank(c);
    this.blank = this._tex(c);
    this.cache = new Map();                               // index -> { tex, key }
  }
  _tex(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.flipY = false;                                     // glTF UV convention (v down)
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, this.maxAniso);
    return t;
  }
  /** Texture for page i; only pages near `focus` get their real text (keeps GPU memory small). */
  get(i, e, total, tag, note, focus) {
    if (Math.abs(i - focus) > 2) {
      const old = this.cache.get(i); if (old) { old.tex.dispose(); this.cache.delete(i); }
      return this.blank;
    }
    const key = `${tag || ""}|${note || ""}`;
    let c = this.cache.get(i);
    if (!c) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; c = { tex: this._tex(cv), key: null }; this.cache.set(i, c); }
    if (c.key !== key) { drawEvidence(c.tex.image, e, i, total, tag, note); c.tex.needsUpdate = true; c.key = key; }
    return c.tex;
  }
}
