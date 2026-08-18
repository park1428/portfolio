/* =========================================================
   main.js — motion orchestration
   Lenis (smooth scroll) -> GSAP ticker -> ScrollTrigger.
   Every scroll-linked behaviour reads from that one loop.
   ========================================================= */
import LogoWebGL from './logo-webgl.js';

const { gsap } = window;
gsap.registerPlugin(window.ScrollTrigger);
const ST = window.ScrollTrigger;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------------
   0. viewport unit that survives mobile browser chrome
   --------------------------------------------------------- */
function setVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setVH();
window.addEventListener('resize', setVH, { passive: true });

/* ---------------------------------------------------------
   1. smooth scroll  (Lenis driving GSAP's ticker)
   --------------------------------------------------------- */
let lenis = null;
function initScroll() {
  if (REDUCED || typeof window.Lenis === 'undefined') { ST.refresh(); return; }
  lenis = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.6
  });
  lenis.on('scroll', ST.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------------------------------------------------------
   2. split background — colour shifts across the page
   --------------------------------------------------------- */
const PALETTES = [
  ['linear-gradient(135deg,#eb7d2e 0%,#fa5ca6 45%,#ed6339 100%)',
   'linear-gradient(135deg,#3788ff 0%,#4a19d2 60%,#982ced 100%)'],
  ['linear-gradient(135deg,#ff2d52 0%,#ff47cc 50%,#982ced 100%)',
   'linear-gradient(135deg,#4a19d2 0%,#3788ff 55%,#43f24b 130%)'],
  ['linear-gradient(135deg,#ffa24d 0%,#ff3d3d 55%,#fa5ca6 100%)',
   'linear-gradient(135deg,#982ced 0%,#3788ff 60%,#4a19d2 100%)']
];
function initBackground() {
  const peach = qs('.background__wrapper--peach .background__inner');
  const blue  = qs('.background__wrapper--blue .background__inner');
  if (!peach || !blue) return;

  // parallax drift on the two halves
  if (!REDUCED) {
    gsap.to('.background__inner', {
      yPercent: -8, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true }
    });
  }
  // swap palettes at section boundaries
  const marks = ['.words-carousel', '.home-carousel'];
  marks.forEach((sel, i) => {
    const el = qs(sel);
    if (!el) return;
    ST.create({
      trigger: el, start: 'top 60%', end: 'bottom 40%',
      onEnter:     () => applyPalette(i + 1),
      onEnterBack: () => applyPalette(i + 1),
      onLeaveBack: () => applyPalette(i)
    });
  });
  function applyPalette(i) {
    const p = PALETTES[clamp(i, 0, PALETTES.length - 1)];
    gsap.to(peach, { background: p[0], duration: 1.1, ease: 'power2.out' });
    gsap.to(blue,  { background: p[1], duration: 1.1, ease: 'power2.out' });
  }
}

/* ---------------------------------------------------------
   3. WebGL marks
   --------------------------------------------------------- */
function initWebGL() {
  const host = qs('.logo-webgl');
  const canvas = qs('.logo-webgl__canvas');
  if (!canvas) return;
  let mark;
  try {
    mark = new LogoWebGL(canvas, { shape: 'mark', discs: 46, radius: 0.34, alpha: 0.84, spin: 0.5 });
  } catch (e) { console.warn('WebGL unavailable', e); return; }
  requestAnimationFrame(() => host.classList.add('is-ready'));

  // the mark only lives behind the word-carousel chapter
  const stage = qs('.words-carousel');
  if (stage) {
    gsap.set(host, { autoAlpha: 0 });
    ST.create({
      trigger: stage, start: 'top 80%', end: 'bottom 20%',
      onToggle: (s) => gsap.to(host, { autoAlpha: s.isActive ? 1 : 0, duration: .6 }),
      onUpdate: (s) => mark.setProgress(s.progress)
    });
  }

  // small footer mark, brighter palette on black
  const fc = qs('.footer__logo-canvas');
  if (fc) {
    try {
      new LogoWebGL(fc, {
        shape: 'mark', discs: 40, radius: 0.36, alpha: 0.95, spread: 1.15,
        colors: ['#7a1b5e', '#c22a8f', '#fa5ca6', '#ff47cc', '#ff6a9d', '#ffa24d'],
        saturation: 1.25, contrast: 1.02
      });
    } catch (e) { /* non-critical */ }
  }
}

/* ---------------------------------------------------------
   4. line-mask reveals + generic reveal
   --------------------------------------------------------- */
function initReveals() {
  qsa('.line__inner').forEach((el) => {
    gsap.fromTo(el, { yPercent: 108 }, {
      yPercent: 0, duration: 1.15, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });
  qsa('[data-reveal]').forEach((el, i) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1, ease: 'expo.out', delay: (i % 3) * 0.09,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  // parallax assets
  qsa('[data-speed]').forEach((el) => {
    const sp = parseFloat(el.dataset.speed) || 0.1;
    gsap.to(el, {
      yPercent: -sp * 100, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
}

/* ---------------------------------------------------------
   5. words carousel — scroll-driven wipe reveal
   --------------------------------------------------------- */
function initWords() {
  const wrap = qs('[data-words]');
  if (!wrap) return;
  const words = qsa('.masked-title__word', wrap);
  if (REDUCED) return;
  const n = words.length;

  ST.create({
    trigger: '.words-carousel', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => {
      const p = self.progress * n;
      words.forEach((w, i) => {
        const local = p - i;                       // this word's own 0..1 slot
        if (local <= -0.02 || local >= 1.02) { w.style.opacity = 0; return; }
        const inP  = clamp(local / 0.34);          // wipe in  from the left
        const outP = clamp((local - 0.70) / 0.30); // wipe out to the right
        w.style.opacity = 1;
        w.style.clipPath = `inset(0 ${(1 - inP) * 100}% 0 ${outP * 100}%)`;
      });
    }
  });
}

/* ---------------------------------------------------------
   6. work grid — generated cards, staggered columns
   --------------------------------------------------------- */
const WORK = [
  { name: 'Northwind', role: 'Brand site & scroll system', span: 2, tall: true,  g: 'linear-gradient(150deg,#ff3d3d,#982ced)' },
  { name: 'Cadence',   role: 'Audio-reactive WebGL',       span: 2, tall: false, g: 'linear-gradient(150deg,#3788ff,#43f24b)' },
  { name: 'Atlas OS',  role: 'Design system, 240 tokens',  span: 2, tall: true,  g: 'linear-gradient(150deg,#ffa24d,#fa5ca6)' },
  { name: 'Halcyon',   role: 'Editorial motion study',     span: 3, tall: false, g: 'linear-gradient(150deg,#4a19d2,#ff47cc)' },
  { name: 'Field',     role: 'Realtime data canvas',       span: 3, tall: true,  g: 'linear-gradient(150deg,#eb7d2e,#ff2d52)' }
];
const ARROW = '<svg class="work-card__arrow" viewBox="0 0 21 22" fill="none" aria-hidden="true"><path d="M.63 1h19.373v20"/><path d="M0-.5h27.844" transform="matrix(-.69574 .71829 -.69574 -.71829 19.373 1)"/></svg>';

function initWork() {
  const grid = qs('[data-work-grid]');
  if (!grid) return;
  grid.innerHTML = WORK.map((w) => `
    <a class="work-card" href="#work" data-cursor="next" style="grid-column:span ${w.span}">
      <span class="work-card__media" style="aspect-ratio:${w.tall ? '3/4' : '4/3'}">
        <span class="work-card__fill" style="background:${w.g}"></span>
      </span>
      <span class="work-card__meta">
        <span>
          <span class="work-card__name">${w.name}</span>
          <span class="work-card__role">${w.role}</span>
        </span>${ARROW}
      </span>
    </a>`).join('');

  if (REDUCED) return;
  qsa('.work-card', grid).forEach((card, i) => {
    gsap.fromTo(card, { y: 90, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 90%', once: true }
    });
    // alternating column drift
    gsap.to(card, {
      yPercent: i % 2 ? -6 : -14, ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
}

/* ---------------------------------------------------------
   7. masked copy — words light up as they cross the viewport
   --------------------------------------------------------- */
function initMaskedCopy() {
  const el = qs('[data-mask-copy]');
  if (!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="word"><i>${w}</i></span>`).join(' ');
  const items = qsa('.word i', el);
  if (REDUCED) { items.forEach((i) => i.classList.add('lit')); return; }
  ST.create({
    trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: true,
    onUpdate: (self) => {
      const lit = Math.round(self.progress * items.length);
      items.forEach((it, i) => it.classList.toggle('lit', i < lit));
    }
  });
}

/* ---------------------------------------------------------
   8. discipline carousel — titles / figures / copy in sync
   --------------------------------------------------------- */
const FIGS = [
  { g: 'linear-gradient(150deg,#3788ff,#4a19d2)', x: '8%',  y: '18%', r: -6 },
  { g: 'linear-gradient(150deg,#ff3d3d,#ffa24d)', x: '58%', y: '30%', r:  5 },
  { g: 'linear-gradient(150deg,#982ced,#ff47cc)', x: '14%', y: '38%', r:  4 },
  { g: 'linear-gradient(150deg,#43f24b,#3788ff)', x: '56%', y: '16%', r: -5 }
];
function initCarousel() {
  const root = qs('[data-carousel]');
  if (!root) return;
  const titles = qsa('.home-carousel-title', root);
  const copies = qsa('.home-carousel-copy', root);
  const holder = qs('[data-carousel-images]', root);
  if (holder) {
    holder.innerHTML = FIGS.map((f, i) => `
      <span class="carousel-figure${i === 0 ? ' is-active' : ''}"
            style="left:${f.x};top:${f.y};background:${f.g};transform:rotate(${f.r}deg)"></span>`).join('');
  }
  const figs = qsa('.carousel-figure', root);
  const n = titles.length;
  let current = -1;

  const setIndex = (i) => {
    if (i === current) return;
    current = i;
    titles.forEach((t, k) => t.classList.toggle('is-active', k === i));
    copies.forEach((c, k) => c.classList.toggle('is-active', k === i));
    figs.forEach((f, k) => f.classList.toggle('is-active', k === i));
  };
  setIndex(0);

  ST.create({
    trigger: root, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => setIndex(clamp(Math.floor(self.progress * n), 0, n - 1))
  });

  if (!REDUCED) {
    figs.forEach((f, i) => gsap.to(f, {
      yPercent: i % 2 ? -18 : -30, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true }
    }));
  }
}

/* ---------------------------------------------------------
   9. highlights slider — drag + wheel, inertial
   --------------------------------------------------------- */
const HIGHLIGHTS = [
  { t: 'Scroll choreography', c: 'Sticky chapters with scrubbed timelines.', g: 'linear-gradient(150deg,#ff2d52,#982ced)' },
  { t: 'Shader gradients',    c: 'Six-stop vertical ramps, graded in GLSL.', g: 'linear-gradient(150deg,#3788ff,#43f24b)' },
  { t: 'Type systems',        c: 'Fluid scales that hold at every width.',   g: 'linear-gradient(150deg,#ffa24d,#ff3d3d)' },
  { t: 'Reduced motion',      c: 'A calm path through the same content.',    g: 'linear-gradient(150deg,#4a19d2,#ff47cc)' },
  { t: 'Performance budget',  c: 'Compositor-only transforms, always.',      g: 'linear-gradient(150deg,#fa5ca6,#eb7d2e)' }
];
function initSlider() {
  const root = qs('[data-slider]');
  const track = qs('[data-slider-track]');
  if (!root || !track) return;
  track.innerHTML = HIGHLIGHTS.map((h) => `
    <article class="highlight-item">
      <span class="highlight-item__media"><span class="highlight-item__fill" style="background:${h.g}"></span></span>
      <h3 class="highlight-item__title">${h.t}</h3>
      <p class="highlight-item__copy">${h.c}</p>
    </article>`).join('');

  let x = 0, target = 0, max = 0, down = false, startX = 0, startTarget = 0;
  const measure = () => { max = Math.max(0, track.scrollWidth - root.clientWidth); };
  measure();
  window.addEventListener('resize', measure, { passive: true });

  root.addEventListener('pointerdown', (e) => {
    down = true; startX = e.clientX; startTarget = target;
    root.classList.add('is-dragging'); root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!down) return;
    target = clamp(startTarget - (e.clientX - startX), 0, max);
  });
  const up = (e) => {
    down = false; root.classList.remove('is-dragging');
    if (e.pointerId != null && root.hasPointerCapture?.(e.pointerId)) root.releasePointerCapture(e.pointerId);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);

  gsap.ticker.add(() => {
    x += (target - x) * (REDUCED ? 1 : 0.09);
    track.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`;
  });
}

/* ---------------------------------------------------------
   10. marquee — seamless loop
   --------------------------------------------------------- */
function initMarquee() {
  const root = qs('[data-marquee]');
  if (!root) return;
  const track = qs('.marquee__track', root);
  track.innerHTML += track.innerHTML;   // duplicate for the wrap
  if (REDUCED) return;
  const w = track.scrollWidth / 2;
  gsap.to(track, { x: -w, duration: 26, ease: 'none', repeat: -1 });
}

/* ---------------------------------------------------------
   11. countdown
   --------------------------------------------------------- */
function initCountdown() {
  const root = qs('[data-countdown]');
  if (!root) return;
  const target = new Date();
  target.setMonth(target.getMonth() + 2, 1);
  target.setHours(9, 0, 0, 0);
  const out = {
    days: qs('[data-cd="days"]', root), hours: qs('[data-cd="hours"]', root),
    minutes: qs('[data-cd="minutes"]', root), seconds: qs('[data-cd="seconds"]', root)
  };
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
  const tick = () => {
    let d = Math.max(0, target - new Date()) / 1000;
    out.days.textContent    = pad(Math.floor(d / 86400));
    out.hours.textContent   = pad(Math.floor(d / 3600) % 24);
    out.minutes.textContent = pad(Math.floor(d / 60) % 60);
    out.seconds.textContent = pad(Math.floor(d) % 60);
  };
  tick(); setInterval(tick, 1000);
}

/* ---------------------------------------------------------
   12. halftone canvas — dot-matrix mark
   --------------------------------------------------------- */
function initHalftone() {
  const cv = qs('.halftone__canvas');
  if (!cv) return;
  const draw = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const step = Math.max(6, w / 62);
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const nx = x / w, ny = y / h;
        // two soft lobes -> reads as a rounded mark
        const d1 = Math.hypot(nx - 0.32, ny - 0.5) / 0.30;
        const d2 = Math.hypot(nx - 0.68, ny - 0.5) / 0.30;
        const ring = Math.min(Math.abs(d1 - 0.78), Math.abs(d2 - 0.78));
        const a = clamp(1 - ring * 3.4);
        if (a <= 0.02) continue;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`;
        ctx.beginPath();
        ctx.arc(x, y, step * 0.34 * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  draw();
  window.addEventListener('resize', draw, { passive: true });
}

/* ---------------------------------------------------------
   13. nav overlay + contact rail toggle
   --------------------------------------------------------- */
function initNav() {
  const nav = qs('.nav');
  const toggle = qs('.nav-toggle');
  const contact = qs('.tickets-toggle');
  if (!nav || !toggle) return;
  let open = false;

  const items = qsa('.nav__wrapper--main .nav-item', nav);
  const setOpen = (v) => {
    open = v;
    document.body.classList.toggle('nav-open', v);
    toggle.setAttribute('aria-expanded', String(v));
    if (v) {
      nav.hidden = false;
      lenis?.stop();
      gsap.to(nav, { clipPath: 'inset(0 0 0% 0)', duration: .9, ease: 'expo.out' });
      gsap.fromTo(items, { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: .9, stagger: .07, ease: 'expo.out', delay: .12 });
    } else {
      lenis?.start();
      gsap.to(nav, {
        clipPath: 'inset(0 0 100% 0)', duration: .7, ease: 'expo.inOut',
        onComplete: () => { nav.hidden = true; }
      });
    }
  };
  toggle.addEventListener('click', () => setOpen(!open));
  qsa('a', nav).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

  contact?.addEventListener('click', () => {
    const m = qs('[data-modal]');
    if (!m) return;
    m.classList.remove('is-dismissed');
    const now = !m.classList.contains('is-open');
    m.classList.toggle('is-open', now);
    document.body.classList.toggle('contact-open', now);
  });
}

/* ---------------------------------------------------------
   14. corner modal
   --------------------------------------------------------- */
function initModal() {
  const m = qs('[data-modal]');
  if (!m) return;
  setTimeout(() => m.classList.add('is-open'), 2600);
  qs('.modal__close', m)?.addEventListener('click', () => {
    m.classList.remove('is-open');
    document.body.classList.remove('contact-open');
    setTimeout(() => m.classList.add('is-dismissed'), 900);
  });
  qs('[data-modal-form]', m)?.addEventListener('submit', (e) => {
    e.preventDefault();
    m.querySelector('.modal__body').innerHTML =
      '<p class="modal__title">Thanks — noted.</p><p class="modal__copy p">This demo form does not send anything.</p>';
  });
}

/* ---------------------------------------------------------
   15. custom cursor
   --------------------------------------------------------- */
function initCursor() {
  const cur = qs('[data-cursor-el]');
  if (!cur || REDUCED || window.matchMedia('(hover:none)').matches) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  gsap.ticker.add(() => {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    cur.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%) scale(${cur.classList.contains('is-active') ? 1 : 0})`;
  });
  qsa('[data-cursor="next"]').forEach((el) => {
    el.addEventListener('pointerenter', () => cur.classList.add('is-active'));
    el.addEventListener('pointerleave', () => cur.classList.remove('is-active'));
  });
  // delegate for cards injected later
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest?.('[data-cursor="next"]')) cur.classList.add('is-active');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest?.('[data-cursor="next"]') && !e.relatedTarget?.closest?.('[data-cursor="next"]'))
      cur.classList.remove('is-active');
  });
}

/* ---------------------------------------------------------
   boot
   --------------------------------------------------------- */
function boot() {
  initScroll();
  initBackground();
  initWebGL();
  initWork();
  initReveals();
  initWords();
  initMaskedCopy();
  initCarousel();
  initSlider();
  initMarquee();
  initCountdown();
  initHalftone();
  initNav();
  initModal();
  initCursor();
  ST.refresh();
  document.body.classList.add('is-ready');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
