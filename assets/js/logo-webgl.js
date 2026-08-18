/* =========================================================
   logo-webgl.js
   A ring-logo built from many overlapping translucent discs.
   Each disc is shaded by a 6-stop vertical gradient plus a
   tint / contrast / brightness / saturation grade, so the
   overlaps build up depth instead of flat colour.
   ========================================================= */
import * as THREE from '../../vendor/three.module.js';

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

vec3 adjustTint(vec3 c, float t){
  return mix(c, vec3(c.r*1.06, c.g*0.98, c.b*1.04), t);
}
vec3 adjustContrast(vec3 c, float v){
  return clamp((c - 0.5) * v + 0.5, 0.0, 1.0);
}
vec3 adjustBrightness(vec3 c, float v){
  return clamp(c + v, 0.0, 1.0);
}
vec3 adjustSaturation(vec3 c, float v){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(vec3(l), c, v), 0.0, 1.0);
}

void main(){
  // discard outside the unit circle -> disc geometry from a quad
  vec2 p = vUv * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;

  vec3 color = mix(uColors[0], uColors[1], smoothstep(-1.0, 0.05, vUv.y));
  color = mix(color, uColors[3], smoothstep(0.05, 0.48, vUv.y));
  color = mix(color, uColors[5], smoothstep(0.56, 1.0, vUv.y));

  color = adjustTint(color, uTint);
  color = adjustContrast(color, uContrast);
  color = adjustBrightness(color, uBrightness);
  color = adjustSaturation(color, uSaturation);

  // soften the rim so discs melt into each other
  float edge = smoothstep(1.0, 0.90, d);
  gl_FragColor = vec4(color, uAlpha * edge);
}`;

const hex = (h) => new THREE.Color(h);

/* ---- parametric paths the discs are threaded along ---- */
function ringPath(count, cx, cy, rx, ry, from = 0, to = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = from + (to - from) * (i / count);
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}

function twoPath(count, cx, cy, s) {
  // a "2"-like glyph traced as an arc + diagonal + base bar
  const pts = [];
  const arcN = Math.round(count * 0.5);
  for (let i = 0; i < arcN; i++) {
    const t = Math.PI * 0.95 - (Math.PI * 1.15) * (i / (arcN - 1));
    pts.push([cx + Math.cos(t) * s * 0.72, cy + s * 0.42 + Math.sin(t) * s * 0.5]);
  }
  const diagN = Math.round(count * 0.3);
  for (let i = 0; i < diagN; i++) {
    const k = i / (diagN - 1);
    pts.push([cx + s * 0.52 - s * 1.16 * k, cy + s * 0.06 - s * 0.72 * k]);
  }
  const barN = count - pts.length;
  for (let i = 0; i < barN; i++) {
    const k = i / Math.max(1, barN - 1);
    pts.push([cx - s * 0.64 + s * 1.34 * k, cy - s * 0.72]);
  }
  return pts;
}

export default class LogoWebGL {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({
      shape: 'mark',          // 'mark' = ring + 2 ; 'ring' = single ring
      discs: 44,
      radius: 0.30,           // disc radius in world units
      alpha: 0.86,
      colors: ['#4a0d0d', '#b3231d', '#e8372a', '#ff3d3d', '#ff6a2d', '#ffa24d'],
      tint: 0.35, contrast: 1.04, brightness: 0.0, saturation: 1.12,
      spread: 1.0,
      spin: 0.0
    }, opts);

    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.progress = 0;
    this._raf = null;
    this.init();
  }

  init() {
    const { canvas } = this;
    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.frustum = 2.4;
    this.camera = new THREE.OrthographicCamera(
      -this.frustum * aspect, this.frustum * aspect,
      this.frustum, -this.frustum, 0.1, 100
    );
    this.camera.position.z = 10;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const geo = new THREE.PlaneGeometry(1, 1);
    const c = this.opts.colors.map(hex);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uColors: { value: c },
        uAlpha: { value: this.opts.alpha },
        uTint: { value: this.opts.tint },
        uContrast: { value: this.opts.contrast },
        uBrightness: { value: this.opts.brightness },
        uSaturation: { value: this.opts.saturation }
      }
    });

    this.discs = [];
    const pts = this.buildPoints();
    const r = this.opts.radius;
    pts.forEach((p, i) => {
      const m = new THREE.Mesh(geo, this.material);
      m.scale.setScalar(r * 2);
      m.position.set(p[0], p[1], i * 0.0001);
      m.userData.base = { x: p[0], y: p[1], i };
      this.group.add(m);
      this.discs.push(m);
    });

    this.resize();
    window.addEventListener('resize', this.resize.bind(this), { passive: true });
    this.start();
  }

  buildPoints() {
    const n = this.opts.discs;
    if (this.opts.shape === 'ring') return ringPath(n, 0, 0, 1.15, 1.15);
    // 'mark': a ring on the left, a 2-glyph on the right
    const a = ringPath(Math.round(n * 0.52), -1.15, 0, 1.02, 1.02);
    const b = twoPath(n - Math.round(n * 0.52), 1.22, 0, 1.15);
    return a.concat(b);
  }

  resize() {
    const { canvas } = this;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -this.frustum * aspect;
    this.camera.right = this.frustum * aspect;
    this.camera.top = this.frustum;
    this.camera.bottom = -this.frustum;
    this.camera.updateProjectionMatrix();
    // keep the mark comfortably inside narrow viewports
    const fit = Math.min(1, aspect / 1.35);
    this.group.scale.setScalar(fit * this.opts.spread);
  }

  /** progress 0..1 — driven by scroll */
  setProgress(p) { this.progress = p; }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.time += this.reduced ? 0 : 0.016;
      this.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  update() {
    const t = this.time;
    const p = this.progress;
    this.group.rotation.z = (this.opts.spin * p) + (this.reduced ? 0 : Math.sin(t * 0.12) * 0.03);
    this.discs.forEach((m, i) => {
      const b = m.userData.base;
      // gentle organic drift so the overlaps keep breathing
      const wob = this.reduced ? 0 : Math.sin(t * 0.6 + i * 0.55) * 0.045;
      const wob2 = this.reduced ? 0 : Math.cos(t * 0.45 + i * 0.31) * 0.045;
      m.position.x = b.x + wob;
      m.position.y = b.y + wob2;
      const s = this.opts.radius * 2 * (1 + (this.reduced ? 0 : Math.sin(t * 0.5 + i) * 0.05));
      m.scale.setScalar(s);
    });
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.renderer.dispose();
  }
}
