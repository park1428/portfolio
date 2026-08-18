/* =========================================================
   logo-webgl.js
   A mark built from a small number of LARGE translucent discs
   threaded along parametric paths. Each disc is a flat screen-
   print style ellipse with an internal vertical gradient, so
   overlapping discs read as distinct stacked shapes.

   The canvas composites with mix-blend-mode:difference, so the
   colours here are the *inverse* of what appears on screen:
   a violet->pink ramp over a blue backdrop reads as maroon->red.
   ========================================================= */
import * as THREE from '../../vendor/three.module.js';

// This shader writes gl_FragColor directly, with no linear->sRGB step on output.
// Leaving colour management on would convert the hex stops sRGB->linear on the way
// in and never convert back, crushing midtones (green worst). Keep the stops raw.
THREE.ColorManagement.enabled = false;

const VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3  uColors[6];
uniform float uAlpha;
uniform float uTint;
uniform float uContrast;
uniform float uBrightness;
uniform float uSaturation;
varying vec2  vUv;

vec3 adjustTint(vec3 c, float t){ return mix(c, vec3(c.r*1.05, c.g*0.98, c.b*1.05), t); }
vec3 adjustContrast(vec3 c, float v){ return clamp((c - 0.5) * v + 0.5, 0.0, 1.0); }
vec3 adjustBrightness(vec3 c, float v){ return clamp(c + v, 0.0, 1.0); }
vec3 adjustSaturation(vec3 c, float v){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(vec3(l), c, v), 0.0, 1.0);
}

void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  // crisp edge, antialiased only — these are flat printed circles
  float aa = fwidth(d) * 1.2;
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  if (mask <= 0.001) discard;

  vec3 color = mix(uColors[0], uColors[1], smoothstep(-1.0, 0.05, vUv.y));
  color = mix(color, uColors[3], smoothstep(0.05, 0.48, vUv.y));
  color = mix(color, uColors[5], smoothstep(0.56, 1.0, vUv.y));

  color = adjustTint(color, uTint);
  color = adjustContrast(color, uContrast);
  color = adjustBrightness(color, uBrightness);
  color = adjustSaturation(color, uSaturation);

  gl_FragColor = vec4(color, uAlpha * mask);
}`;

/* ---- parametric paths ---- */
function ringPath(count, cx, cy, r, from = 0, to = Math.PI * 2, closed = true) {
  const pts = [];
  const n = closed ? count : count - 1;
  for (let i = 0; i < count; i++) {
    const t = from + (to - from) * (i / n);
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return pts;
}

/** a "2"-like glyph: top arc -> diagonal -> base bar */
function twoPath(count, cx, cy, s) {
  const pts = [];
  const arcN = Math.round(count * 0.46);
  for (let i = 0; i < arcN; i++) {
    const t = Math.PI * 1.06 - Math.PI * 1.28 * (i / (arcN - 1));
    pts.push([cx + Math.cos(t) * s * 0.78, cy + s * 0.46 + Math.sin(t) * s * 0.54]);
  }
  const diagN = Math.round(count * 0.30);
  for (let i = 1; i <= diagN; i++) {
    const k = i / diagN;
    pts.push([cx + s * 0.60 - s * 1.30 * k, cy + s * 0.10 - s * 0.80 * k]);
  }
  const barN = count - pts.length;
  for (let i = 0; i < barN; i++) {
    const k = barN === 1 ? 0 : i / (barN - 1);
    pts.push([cx - s * 0.70 + s * 1.44 * k, cy - s * 0.72]);
  }
  return pts;
}

export default class LogoWebGL {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.o = Object.assign({
      shape: 'mark',
      ringDiscs: 17,       // large discs -> each circle stays readable
      glyphDiscs: 16,
      ringRadius: 1.42,
      discRadius: 0.53,    // ~50% overlap against the ring spacing
      ellipse: 1.07,       // slightly taller than wide
      alpha: 0.85,
      // inverse palette: reads as maroon -> red-orange through `difference`
      // solved from out = |backdrop - canvas| against the blue backdrop:
      // periwinkle -> light pink reads as dark maroon -> bright red-orange
      // Sampled from the reference: each disc is a near-FLAT bright magenta.
      // Depth comes from translucent discs ACCUMULATING, not from internal shading:
      // 1 layer -> dark maroon, 3 layers -> bright red, through the difference blend.
      colors: ['#ff82fc', '#ff82fc', '#ff78fb', '#ff70fa', '#fa6bf5', '#f567f0'],
      tint: 0.0, contrast: 1.0, brightness: 0.0, saturation: 1.0,
      spread: 1.0,
      zoomFrom: 1.95,      // scroll-driven zoom: hero -> full mark
      zoomTo: 1.0,
      panFrom: -1.15,
      panTo: 0.0,
      autoFit: true
    }, opts);

    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0; this.p = 0; this._raf = null;
    this.init();
  }

  init() {
    const { canvas } = this;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true,
      powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearAlpha(0);
    this.scene = new THREE.Scene();

    this.frustum = 2.4;
    this.camera = new THREE.OrthographicCamera(-4, 4, this.frustum, -this.frustum, 0.1, 100);
    this.camera.position.z = 10;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const geo = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: {
        uColors: { value: this.o.colors.map((h) => new THREE.Color(h)) },
        uAlpha: { value: this.o.alpha },
        uTint: { value: this.o.tint },
        uContrast: { value: this.o.contrast },
        uBrightness: { value: this.o.brightness },
        uSaturation: { value: this.o.saturation }
      }
    });

    this.discs = [];
    this.buildPoints().forEach((pt, i) => {
      const m = new THREE.Mesh(geo, this.material);
      m.position.set(pt[0], pt[1], i * 0.0001);
      m.userData.base = { x: pt[0], y: pt[1], i };
      this.group.add(m);
      this.discs.push(m);
    });

    this.resize();
    addEventListener('resize', this.resize.bind(this), { passive: true });
    this.start();
  }

  buildPoints() {
    const o = this.o;
    if (o.shape === 'ring') return ringPath(o.ringDiscs, 0, 0, o.ringRadius);
    // mark: ring on the left, glyph on the right
    return ringPath(o.ringDiscs, -1.6, 0, o.ringRadius)
      .concat(twoPath(o.glyphDiscs, 1.68, 0, 1.36));
  }

  resize() {
    const { canvas } = this;
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -this.frustum * aspect;
    this.camera.right = this.frustum * aspect;
    this.camera.top = this.frustum;
    this.camera.bottom = -this.frustum;
    this.camera.updateProjectionMatrix();
    this._fit = this.o.autoFit ? Math.min(1, aspect / 1.55) : 1;
  }

  /** 0..1 — page scroll progress across the mark's chapter */
  setProgress(p) { this.p = Math.max(0, Math.min(1, p)); }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (!this.reduced) this.t += 0.016;
      this.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  update() {
    const o = this.o, t = this.t, p = this.p;
    const ease = 1 - Math.pow(1 - p, 2);
    const zoom = o.zoomFrom + (o.zoomTo - o.zoomFrom) * ease;
    const pan  = o.panFrom  + (o.panTo  - o.panFrom)  * ease;

    this.group.scale.setScalar(zoom * (this._fit || 1) * o.spread);
    this.group.position.y = pan;
    this.group.rotation.z = this.reduced ? 0 : Math.sin(t * 0.1) * 0.02;

    const r = o.discRadius * 2;
    this.discs.forEach((m, i) => {
      const b = m.userData.base;
      const wob = this.reduced ? 0 : Math.sin(t * 0.5 + i * 0.6) * 0.03;
      const wob2 = this.reduced ? 0 : Math.cos(t * 0.4 + i * 0.35) * 0.03;
      m.position.x = b.x + wob;
      m.position.y = b.y + wob2;
      const s = this.reduced ? 1 : 1 + Math.sin(t * 0.45 + i * 0.8) * 0.03;
      m.scale.set(r * s, r * s * o.ellipse, 1);
    });
  }

  destroy() { cancelAnimationFrame(this._raf); this.renderer.dispose(); }
}
