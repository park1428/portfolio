/* =========================================================
   main.js — motion system
   Entrances are CSS transitions toggled by an `.is-visible`
   class; only continuous/scrubbed motion runs through GSAP.
   ========================================================= */
import LogoWebGL from './logo-webgl.js';

const { gsap } = window;
gsap.registerPlugin(window.ScrollTrigger);
const ST = window.ScrollTrigger;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- viewport unit ---------- */
const setVH = () => document.documentElement.style.setProperty('--vh', `${innerHeight * 0.01}px`);
setVH(); addEventListener('resize', setVH, { passive: true });

/* ---------------------------------------------------------
   smooth scroll
   --------------------------------------------------------- */
let lenis = null;
function initScroll() {
  if (REDUCED || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.6
  });
  lenis.on('scroll', ST.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------------------------------------------------------
   text splitting  -> .anim-char / .anim-line
   --------------------------------------------------------- */
function splitChars(el) {
  const text = el.textContent;
  const sup = el.querySelector('sup');
  const supHTML = sup ? sup.outerHTML : '';
  const base = sup ? text.replace(sup.textContent, '') : text;
  el.innerHTML = [...base].map((ch, i) =>
    ch === ' '
      ? '<span class="anim-char" style="width:.28em">&nbsp;</span>'
      : `<span class="anim-char" style="transition-delay:${(i * 0.03).toFixed(3)}s">${ch}</span>`
  ).join('') + (supHTML ? `<span class="anim-char" style="transition-delay:${(base.length*0.03).toFixed(3)}s">${supHTML}</span>` : '');
  el.classList.add('text-splitter--splitted');
}

function splitLines(el) {
  // wrap each wrapped visual line in its own .anim-line
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="ln-w">${w}</span>`).join(' ');
  const spans = qsa('.ln-w', el);
  const lines = [];
  let top = null, cur = [];
  spans.forEach((s) => {
    const t = Math.round(s.offsetTop);
    if (top === null) top = t;
    if (t !== top) { lines.push(cur); cur = []; top = t; }
    cur.push(s.textContent);
  });
  if (cur.length) lines.push(cur);
  el.innerHTML = lines.map((ln, i) =>
    `<span class="anim-line" style="transition-delay:${(i * 0.1).toFixed(2)}s">${ln.join(' ')}</span>`
  ).join('');
  el.classList.add('text-splitter--splitted');
}

function initSplitting() {
  qsa('[data-split]').forEach(splitChars);
  qsa('[data-split-lines]').forEach(splitLines);
}

/* ---------------------------------------------------------
   reveal — add .is-visible, CSS does the rest
   --------------------------------------------------------- */
function initReveals() {
  const targets = new Set();
  qsa('[data-anim]').forEach((e) => targets.add(e));
  qsa('.anim-fade,.anim-text,.anim-square').forEach((e) => {
    const host = e.closest('[data-anim]') || e.parentElement;
    targets.add(host);
  });
  targets.forEach((el) => {
    if (!el) return;
    if (REDUCED) { el.classList.add('is-visible'); return; }
    ST.create({ trigger: el, start: 'top 92%', once: true,
      onEnter: () => el.classList.add('is-visible') });
  });
}

/* ---------------------------------------------------------
   intro — rail + webgl layer slide in
   --------------------------------------------------------- */
function initIntro() {
  requestAnimationFrame(() => {
    setTimeout(() => {
      qs('.header')?.classList.add('is-in');
      qs('.logo-webgl')?.classList.add('is-in');
      qs('.home-hero__title')?.classList.add('is-visible');
    }, 120);
  });
}

/* ---------------------------------------------------------
   background palettes
   --------------------------------------------------------- */
// stage 0 hero: warm left / blue right.  stage 1 carousel: cool on BOTH halves,
// so the difference-blended mark reads uniformly red.  stage 2: warm again.
const PALETTES = [
  ['linear-gradient(135deg,#ed6339,#fa5ca6 45%,#eb7d2e)', 'linear-gradient(135deg,#3788ff,#2f6fe8 60%,#1a4fd0)'],
  ['linear-gradient(135deg,#4a19d2,#295ae3 55%,#1871e6)', 'linear-gradient(135deg,#1871e6,#2168e0 60%,#1a58d8)'],
  ['linear-gradient(135deg,#ffa24d,#ff3d3d 55%,#fa5ca6)', 'linear-gradient(135deg,#982ced,#3788ff 60%,#4a19d2)']
];
function initBackground() {
  const peach = qs('.background__wrapper--peach .background__inner');
  const blue  = qs('.background__wrapper--blue .background__inner');
  if (!peach || !blue) return;
  if (!REDUCED) gsap.to('.background__inner', { yPercent: -6, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } });
  const apply = (i) => {
    const p = PALETTES[clamp(i, 0, PALETTES.length - 1)];
    gsap.to(peach, { background: p[0], duration: 1.1, ease: 'power2.out' });
    gsap.to(blue,  { background: p[1], duration: 1.1, ease: 'power2.out' });
  };
  [['.words-carousel', 1, 'top 92%'], ['.home-stats', 2, 'top 60%']].forEach(([sel, i, start]) => {
    const el = qs(sel); if (!el) return;
    ST.create({ trigger: el, start, end: 'bottom 40%',
      onEnter: () => apply(i), onEnterBack: () => apply(i), onLeaveBack: () => apply(i - 1) });
  });
}

/* ---------------------------------------------------------
   WebGL marks
   --------------------------------------------------------- */
function initWebGL() {
  const canvas = qs('.logo-webgl__canvas');
  if (canvas) {
    try {
      const mark = new LogoWebGL(canvas, { shape: 'mark' });
      // zoom out from the hero crop to the full mark by the carousel
      const hero = qs('.home-hero'), words = qs('.words-carousel');
      if (hero && words) {
        ST.create({
          trigger: hero, start: 'top top',
          endTrigger: words, end: 'top top', scrub: true,
          onUpdate: (s) => mark.setProgress(s.progress)
        });
      }
    } catch (e) { console.warn('webgl mark unavailable', e); }
  }
  const fc = qs('.footer__logo-canvas');
  if (fc) { try { new LogoWebGL(fc, { shape:'mark', alpha:0.95, zoomFrom:1, zoomTo:1, panFrom:0, panTo:0,
      colors:['#7a1b5e','#a8228a','#c22a8f','#e63b9e','#fa5ca6','#ff8ac4'], saturation:1.2 }); } catch(e){} }
  const cc = qs('.footer__webgl-canvas');
  if (cc) { try { new LogoWebGL(cc, { shape:'ring', ringDiscs:20, ringRadius:1.5, discRadius:0.55,
      alpha:0.95, zoomFrom:1, zoomTo:1, panFrom:0, panTo:0, autoFit:false, spread:1.2,
      colors:['#3a0f5e','#7a1b8e','#c22a5f','#ff3d3d','#ff8a2d','#ffd24d'], saturation:1.2 }); } catch(e){} }
}

/* ---------------------------------------------------------
   words carousel — 3D cylinder
   --------------------------------------------------------- */
function initWords() {
  const list = qs('[data-words]');
  if (!list) return;
  const items = qsa('.words-carousel__item', list);
  const n = items.length;
  const step = 360 / n;
  const layout = () => {
    const r = Math.round(list.getBoundingClientRect().height / 2);
    items.forEach((el, i) => {
      el.style.transform = `translate(-50%,-50%) rotateX(${i * step}deg) translateZ(${r}px)`;
    });
    list.dataset.r = r;
  };
  layout();
  addEventListener('resize', layout, { passive: true });
  list.style.transformStyle = 'preserve-3d';

  if (REDUCED) { list.style.transform = 'none'; return; }
  ST.create({
    trigger: '.words-carousel', start: 'top top', end: 'bottom bottom', scrub: 1,
    onUpdate: (s) => {
      const rot = -s.progress * 360;
      list.style.transform = `rotateX(${rot.toFixed(2)}deg)`;
      // fade off-axis words so one reads as dominant, the neighbours as ghosts
      items.forEach((el, i) => {
        const a = ((i * step + rot) % 360 + 540) % 360 - 180;   // -180..180
        const f = Math.cos(a * Math.PI / 180);
        el.style.opacity = f <= 0 ? 0 : Math.pow(f, 3).toFixed(3);
      });
    }
  });
}

/* ---------------------------------------------------------
   generated content
   --------------------------------------------------------- */
const G = (a, b, c) => `linear-gradient(150deg,${a},${b}${c ? ',' + c : ''})`;
const ARROW = '<svg class="speaker__arrow" viewBox="0 0 21 22" fill="none" aria-hidden="true"><path d="M.63 1h19.373v20"/><path d="M0-.5h27.844" transform="matrix(-.69574 .71829 -.69574 -.71829 19.373 1)"/></svg>';

const WORK = [
  ['Northwind', 'Brand site, scroll system', G('#ff3d3d','#982ced')],
  ['Cadence', 'Audio-reactive WebGL', G('#3788ff','#0f0')],
  ['Atlas OS', 'Design system, 240 tokens', G('#ffa24d','#fa5ca6')],
  ['Halcyon', 'Editorial motion study', G('#4a19d2','#ff47cc')],
  ['Field', 'Realtime data canvas', G('#eb7d2e','#ff2d52')],
  ['Meridian', 'Commerce front-end', G('#982ced','#3788ff')],
  ['Slate', 'Docs platform rebuild', G('#ff2d52','#ffa24d')],
  ['Volta', 'Dashboard system', G('#0f0','#3788ff')]
];
const STATS = [
  ['12 years', 'shipping', 'From jQuery-era agency work to shader pipelines. The fundamentals did not change; the tooling did.'],
  ['60 fps', 'or it ships broken', 'Compositor-only transforms and a strict shader budget. Motion that drops frames is worse than no motion.'],
  ['40+ sites', 'in production', 'Marketing sites, product UI, design systems and a few things that mostly exist to be looked at.'],
  ['1 loop', 'to rule them', 'Scroll, ticker and render share a single rAF. Nothing else is allowed to schedule frames.']
];
const FEATURED = [
  ['Writing about motion', 'Notes on easing, choreography and why most scroll animation feels wrong.', G('#ff3d3d','#982ced')],
  ['Experiments', 'Shader sketches and interaction toys, updated when something works.', G('#3788ff','#0f0')]
];
const PARTNERS = ['TypeScript','GSAP','Three.js','WebGL','Vue','React','Nuxt','GLSL','Lenis','Vite','Node','Figma'];
const HIGHLIGHTS = [
  ['Scroll choreography','Sticky chapters with scrubbed timelines.',G('#ff2d52','#982ced')],
  ['Shader gradients','Six-stop vertical ramps, graded in GLSL.',G('#3788ff','#0f0')],
  ['Type systems','Fluid scales that hold at every width.',G('#ffa24d','#ff3d3d')],
  ['Reduced motion','A calm path through the same content.',G('#4a19d2','#ff47cc')],
  ['Performance budget','Compositor-only transforms, always.',G('#fa5ca6','#eb7d2e')]
];
const FIGS = [G('#3788ff','#4a19d2'), G('#ff3d3d','#ffa24d'), G('#982ced','#ff47cc'), G('#0f0','#3788ff')];

function build() {
  const wl = qs('[data-work-list]');
  if (wl) wl.innerHTML = WORK.map(([n, r, g]) => `
    <li class="speaker"><a href="#work" data-cursor="next">
      <span class="speaker__media"><span class="speaker__fill" style="background:${g}"></span></span>
      <span class="speaker__meta"><span><span class="speaker__name">${n}</span>
      <span class="speaker__role">${r}</span></span>${ARROW}</span></a></li>`).join('');

  const st = qs('[data-stats]');
  if (st) st.innerHTML = STATS.map(([a, b, c]) => `
    <li class="home-stats-item" data-anim>
      <div class="home-stats-item__title h1">
        <p class="home-stats-item__line anim-text"><span class="text-splitter" data-split>${a}</span></p>
        <p class="home-stats-item__line anim-text"><span class="text-splitter" data-split>${b}</span></p>
      </div>
      <div class="home-stats-item__copy p anim-fade"><p>${c}</p></div>
    </li>`).join('');

  const fc = qs('[data-featured]');
  if (fc) fc.innerHTML = FEATURED.map(([t, c, g]) => `
    <li class="featured-content__item" data-anim>
      <span class="featured-content__media"><span class="featured-content__fill" style="background:${g}"></span></span>
      <h3 class="featured-content__title h3 anim-fade">${t}</h3>
      <p class="featured-content__copy p anim-fade">${c}</p>
      <a href="#" class="btn p btn--dark"><span class="btn__label btn__label--main">Read more</span><span class="btn__label btn__label--ghost">Read more</span></a>
    </li>`).join('');

  const pl = qs('[data-partners]');
  if (pl) {
    const half = Math.ceil(PARTNERS.length / 2);
    const groups = [PARTNERS.slice(0, half), PARTNERS.slice(half)];
    pl.innerHTML = groups.map((g) =>
      `<li class="partners__item"><span class="partners__item-inner">${
        g.map((t) => `<span>${t}</span>`).join('')}</span></li>`).join('');
  }

  const tr = qs('[data-slider-track]');
  if (tr) tr.innerHTML = HIGHLIGHTS.map(([t, c, g]) => `
    <article class="highlight-item">
      <span class="highlight-item__media"><span class="highlight-item__fill" style="background:${g}"></span></span>
      <h3 class="highlight-item__title">${t}</h3><p class="highlight-item__copy">${c}</p>
    </article>`).join('');

  const ci = qs('[data-carousel-images]');
  if (ci) ci.innerHTML = FIGS.map((g, i) =>
    `<span class="carousel-figure${i === 0 ? ' is-active' : ''}" style="background:${g}"></span>`).join('');
  const cf = qs('[data-carousel-figs]');
  if (cf) cf.innerHTML = '<span></span><span></span>';
}

/* ---------------------------------------------------------
   discipline carousel
   --------------------------------------------------------- */
function initCarousel() {
  const root = qs('[data-carousel]');
  if (!root) return;
  const titles = qsa('.home-carousel-title', root);
  const copies = qsa('.home-carousel-copy', root);
  const figs   = qsa('.carousel-figure', root);
  const navs   = qsa('.home-carousel-nav__item button', root);
  const n = titles.length;
  let cur = 0;

  const set = (i) => {
    i = (i % n + n) % n;
    cur = i;
    titles.forEach((t, k) => t.classList.toggle('home-carousel-title--in', k === i));
    copies.forEach((c, k) => c.classList.toggle('home-carousel-copy--active', k === i));
    figs.forEach((f, k) => f.classList.toggle('is-active', k === i));
    navs.forEach((b, k) => b.classList.toggle('is-active', k === i));
  };
  set(0);

  qs('.home-carousel__btn--prev', root)?.addEventListener('click', () => set(cur - 1));
  qs('.home-carousel__btn--next', root)?.addEventListener('click', () => set(cur + 1));
  navs.forEach((b) => b.addEventListener('click', () => set(+b.dataset.goto)));

  // auto-advance while the section is on screen
  let timer = null;
  ST.create({ trigger: root, start: 'top 60%', end: 'bottom 40%',
    onToggle: (s) => {
      clearInterval(timer);
      if (s.isActive && !REDUCED) timer = setInterval(() => set(cur + 1), 4200);
    }
  });
}

/* ---------------------------------------------------------
   slider
   --------------------------------------------------------- */
function initSlider() {
  const root = qs('[data-slider]'), track = qs('[data-slider-track]');
  if (!root || !track) return;
  let x = 0, target = 0, max = 0, down = false, sx = 0, st0 = 0;
  const measure = () => { max = Math.max(0, track.scrollWidth - root.clientWidth); };
  measure(); addEventListener('resize', measure, { passive: true });
  root.addEventListener('pointerdown', (e) => {
    down = true; sx = e.clientX; st0 = target; root.classList.add('is-dragging');
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (down) target = clamp(st0 - (e.clientX - sx), 0, max);
  });
  const up = (e) => { down = false; root.classList.remove('is-dragging');
    if (e.pointerId != null && root.hasPointerCapture?.(e.pointerId)) root.releasePointerCapture(e.pointerId); };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  gsap.ticker.add(() => {
    x += (target - x) * (REDUCED ? 1 : 0.09);
    track.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`;
  });
}

/* ---------------------------------------------------------
   countdown
   --------------------------------------------------------- */
function initCountdown() {
  const target = new Date(); target.setMonth(target.getMonth() + 2, 1); target.setHours(9, 0, 0, 0);
  const pad = (v) => String(Math.max(0, v)).padStart(2, '0');
  const tick = () => {
    const d = Math.max(0, target - new Date()) / 1000;
    const vals = { days: Math.floor(d / 86400), hours: Math.floor(d / 3600) % 24,
                   minutes: Math.floor(d / 60) % 60, seconds: Math.floor(d) % 60 };
    qsa('[data-cd]').forEach((el) => { el.textContent = pad(vals[el.dataset.cd]); });
  };
  tick(); setInterval(tick, 1000);
}

/* ---------------------------------------------------------
   nav overlay + contact
   --------------------------------------------------------- */
function initNav() {
  const nav = qs('.nav'), toggle = qs('.nav-toggle');
  if (!nav || !toggle) return;
  let open = false;
  const items = qsa('.nav__wrapper--main .nav-item', nav);
  const setOpen = (v) => {
    open = v;
    document.body.classList.toggle('nav-open', v);
    toggle.setAttribute('aria-expanded', String(v));
    if (v) {
      nav.hidden = false; lenis?.stop();
      gsap.to(nav, { clipPath: 'inset(0 0 0% 0)', duration: .9, ease: 'expo.out' });
      gsap.fromTo(items, { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: .9, stagger: .07, ease: 'expo.out', delay: .12 });
    } else {
      lenis?.start();
      gsap.to(nav, { clipPath: 'inset(0 0 100% 0)', duration: .7, ease: 'expo.inOut',
        onComplete: () => { nav.hidden = true; } });
    }
  };
  toggle.addEventListener('click', () => setOpen(!open));
  qsa('a', nav).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

  qs('.tickets-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('contact-open');
    qs('#contact')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
  qs('.modal-countdown__btn')?.addEventListener('click', () =>
    qs('[data-modal-countdown]')?.classList.remove('modal-countdown--visible'));
}

/* ---------------------------------------------------------
   cursor
   --------------------------------------------------------- */
function initCursor() {
  const cur = qs('[data-cursor-el]');
  if (!cur || REDUCED || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  addEventListener('pointerdown', () => cur.classList.add('cursor--clicking'));
  addEventListener('pointerup',   () => cur.classList.remove('cursor--clicking'));
  gsap.ticker.add(() => {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-cursor]');
    if (!t) return;
    cur.classList.add('cursor--visible');
    cur.classList.toggle('cursor--next', t.dataset.cursor === 'next');
    cur.classList.toggle('cursor--prev', t.dataset.cursor === 'prev');
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest?.('[data-cursor]');
    if (t && !e.relatedTarget?.closest?.('[data-cursor]')) cur.classList.remove('cursor--visible');
  });
}

/* ---------------------------------------------------------
   boot
   --------------------------------------------------------- */
function boot() {
  initScroll();
  build();
  initSplitting();
  initBackground();
  initWebGL();
  initWords();
  initCarousel();
  initSlider();
  initCountdown();
  initNav();
  initCursor();
  initReveals();
  initIntro();
  ST.refresh();
  document.body.classList.add('is-ready');
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
