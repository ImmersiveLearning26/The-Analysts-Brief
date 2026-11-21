// Apple Intelligence-style edge glow. A WebGL overlay draws a soft, flowing band of colour that hugs the screen's
// rounded edges: a bright thin rim plus a wide soft bloom, with colour that drifts along the perimeter.
//   activate(): the glow ripples in from the edges (a thick wave that settles thin) and the scene gives a small bounce
//   hold(on):   keep it alive (breathing) while the agent works or listens
//   release():  thin out and fade
// It only renders while visible. Reduced motion: a plain fade, no wave, no bounce.
const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uAmp, uWave, uDpr, uRadius;
out vec4 o;
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 pal(float t){
  // orange -> pink -> violet -> blue -> cyan -> orange (Apple Intelligence colours)
  vec3 c[6] = vec3[6](vec3(1.0,0.62,0.26), vec3(1.0,0.31,0.60), vec3(0.69,0.42,1.0), vec3(0.30,0.49,1.0), vec3(0.22,0.85,1.0), vec3(1.0,0.62,0.26));
  t = fract(t) * 5.0; int i = int(floor(t)); float f = smoothstep(0.0, 1.0, fract(t));
  return mix(c[i], c[i + 1], f);
}
void main(){
  vec2 px = gl_FragCoord.xy - 0.5 * uRes;
  float d = max(-sdBox(px, 0.5 * uRes, uRadius * uDpr), 0.0) / uDpr;      // CSS px inside the edge
  float a = atan(px.y / uRes.y, px.x / uRes.x);                          // position along the perimeter
  float t = uTime;
  float flow = a / 6.2831853 + 0.07 * sin(a * 3.0 + t * 1.1) + 0.05 * sin(a * 5.0 - t * 1.7) + t * 0.05;
  vec3 col = pal(flow);
  float wobble = 0.5 + 0.5 * sin(a * 4.0 - t * 2.2) * sin(a * 2.0 + t * 0.9);
  float w = 14.0 + 10.0 * wobble + 120.0 * uWave;                         // soft band width (CSS px)
  float rim = exp(-d / (1.6 + 5.0 * uWave));                              // bright line on the very edge
  float soft = exp(-d / w);
  float i = (rim * 0.95 + soft * (0.55 + 0.3 * wobble)) * uAmp;
  col = mix(col, vec3(1.0), rim * 0.45);
  o = vec4(col * i, clamp(i, 0.0, 1.0));                                  // premultiplied
}`;

export class EdgeGlow {
  constructor(canvas, bounceEl) {
    this.c = canvas; this.bounceEl = bounceEl; this.reduced = false;
    this.amp = 0; this.ampT = 0; this.wave = 0; this.t = 0; this.held = new Set(); this.raf = 0; this.last = 0; this.timer = 0;
    const gl = (this.gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false }));
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(pr, 0, "p"); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); this.gl = null; return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(["uRes", "uTime", "uAmp", "uWave", "uDpr", "uRadius"].map((n) => [n, gl.getUniformLocation(pr, n)]));
    gl.clearColor(0, 0, 0, 0);
    this.frame = this.frame.bind(this);
  }
  activate(holdMs = 1600) {
    if (!this.gl) return;
    this.ampT = 1; if (!this.reduced) this.wave = 1;
    if (!this.reduced && this.bounceEl) {
      this.bounceEl.animate([{ transform: "scale(1)" }, { transform: "scale(.982)", offset: 0.35 }, { transform: "scale(1)" }],
        { duration: 820, easing: "cubic-bezier(.3,1.4,.4,1)" });
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (!this.held.size) this.ampT = 0; }, holdMs);
    this.start();
  }
  hold(on, why = "x") {
    if (on) { const was = this.held.size; this.held.add(why); if (!was) this.activate(); this.ampT = 0.85; }
    else { this.held.delete(why); if (!this.held.size) { clearTimeout(this.timer); this.timer = setTimeout(() => (this.ampT = 0), 300); this.start(); } }
  }
  release() { this.held.clear(); this.ampT = 0; this.start(); }
  start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }
  frame(now) {
    this.raf = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0; this.last = now;
    const gl = this.gl, dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    const breathe = this.held.size && !this.reduced ? 0.12 * Math.sin(now / 520) : 0;
    const k = this.ampT > this.amp ? 1 - Math.exp(-dt / 0.16) : 1 - Math.exp(-dt / 0.38);
    this.amp += (this.ampT + (this.ampT ? breathe : 0) - this.amp) * k;
    this.wave += (0 - this.wave) * (1 - Math.exp(-dt / 0.42));
    if (!this.reduced) this.t += dt;
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.uRes, w, h); gl.uniform1f(this.u.uTime, this.t); gl.uniform1f(this.u.uAmp, Math.max(0, this.amp));
    gl.uniform1f(this.u.uWave, this.wave); gl.uniform1f(this.u.uDpr, dpr); gl.uniform1f(this.u.uRadius, innerWidth < 700 ? 44 : 18);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.c.style.opacity = this.amp > 0.003 ? "1" : "0";
    if (this.amp > 0.002 || this.ampT > 0) this.raf = requestAnimationFrame(this.frame);
  }
}
