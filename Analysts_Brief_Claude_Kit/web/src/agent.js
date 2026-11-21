// The agent globe (design v3 §6). Hidden until the agent has something to say; it changes form while it works.
// Rest: still strands. Thinking: the strands tighten and quicken, the glow rises, the hue drifts, and two thin
// Orizon-style arcs orbit the globe. Shape changes are tweened (600ms ease-in-out), never snapped.
import { Strands } from "./strands.js";
const ENERGY = { rest: .18, prompt: .35, working: .8, hidden: 0 };
const FORMS = {
  rest:     { amplitude: 1,   waviness: 1,   spread: 1,   glow: 1,   thickness: 1,   hueShift: 0 },
  thinking: { amplitude: 1.7, waviness: 2.6, spread: .42, glow: 1.75, thickness: .7, hueShift: .4 },
};
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class AgentGlobe {
  constructor(el) {
    this.el = el; this.phase = "hidden"; this._reduced = false; this._paused = false; this.listening = false;
    this.form = { ...FORMS.rest }; this._raf = 0;
    try { this.strands = new Strands(el.querySelector(".globe"), { energy: .18, glassSize: 1.1, maxDevicePixelRatio: 1.5, speed: 0 }); }
    catch { this.strands = { set() {} }; el.classList.add("globe-fallback"); }
    el.insertAdjacentHTML("afterbegin", `<div class="globe-shape" aria-hidden="true"></div>`);   // the shell that changes form
    el.insertAdjacentHTML("beforeend", `<svg class="globe-arcs" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="a1" cx="50" cy="50" r="46" pathLength="100"/><circle class="a2" cx="50" cy="50" r="40" pathLength="100"/></svg>`);
  }
  sync() {
    const working = this.phase === "working";
    this.strands.set({ energy: ENERGY[this.phase], speed: this._paused || this._reduced ? 0 : (working ? 1.5 : this.listening ? .7 : 0) });
    this.morph(working ? "thinking" : "rest");
  }
  /** Tween the strands' shape to a named form. */
  morph(name) {
    const to = FORMS[name], from = { ...this.form };
    cancelAnimationFrame(this._raf);
    if (this._reduced) { this.form = { ...to }; this.strands.set(this.form); return; }
    const t0 = performance.now(), D = 600;
    const step = (now) => {
      const k = ease(Math.min(1, (now - t0) / D));
      for (const p in to) this.form[p] = from[p] + (to[p] - from[p]) * k;
      this.strands.set(this.form);
      if (k < 1) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }
  set reduced(v) { this._reduced = v; this.sync(); } get reduced() { return this._reduced; }
  place(phase) { this.phase = phase; this.el.dataset.phase = phase; this.el.querySelector(".hit").tabIndex = phase === "hidden" ? -1 : 0; this.sync(); }
  listen(on) { this.listening = !!on; this.strands.set({ listening: !!on }); this.sync(); }
  hold(on) { this.listen(on); }
  /** "Speaking": the strands follow a speech-like envelope while words arrive. */
  speak(ms) {
    clearTimeout(this._speakT); this.el.classList.add("speaking"); this.listen(true);
    this._speakT = setTimeout(() => { this.el.classList.remove("speaking"); this.listen(false); }, ms);
  }
  level(v) { this.strands.set({ level: v }); }
  set paused(v) { this._paused = v; this.sync(); }
}
