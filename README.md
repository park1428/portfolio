# Portfolio — motion-led one-pager

A from-scratch front-end built around a scroll-driven motion system: a smooth-scroll
layer feeding GSAP ScrollTrigger, a Three.js ring mark, and a set of scroll-linked
components (wipe-reveal word carousel, sticky discipline carousel, drag slider).

## Run it

```bash
python3 -m http.server 8777      # or: npx serve .
# open http://127.0.0.1:8777
```

No build step and no install — the three libraries are vendored in `vendor/`.

## Layout

```
index.html              markup + section order
assets/css/style.css    design tokens, 6-col grid, all components
assets/js/main.js       motion orchestration (boot order at the bottom)
assets/js/logo-webgl.js Three.js ring mark + GLSL disc shader
vendor/                 gsap 3.12.5, ScrollTrigger, lenis 1.0.42, three r160
```

## How the motion works

**One scroll loop.** Lenis owns scrolling and drives GSAP's ticker; ScrollTrigger
updates from Lenis' `scroll` event. Every scroll-linked behaviour reads from that
single loop, so nothing fights over `requestAnimationFrame`:

```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

**The ring mark** (`logo-webgl.js`) threads ~46 translucent discs along parametric
paths — a circle plus a traced glyph. Each disc is a quad with the corners discarded
in the fragment shader, shaded by a six-stop vertical gradient and then graded
(tint / contrast / brightness / saturation). Because the discs are transparent and
overlap, the gradient stacks and builds depth rather than reading as flat colour.
Scroll progress feeds `setProgress()` to drive rotation.

**Scroll-linked components**, all scrubbed:

| Component | Mechanism |
|---|---|
| Word carousel | Each word owns a `0..1` slot; `clip-path: inset()` wipes in from the left, then out to the right |
| Discipline carousel | 400vh section, sticky stage, progress quantised to an index that syncs title + figure + copy |
| Masked quote | Words split to `<i>`, lit progressively as the block crosses the viewport |
| Work grid | Staggered entrance + alternating per-column parallax drift |
| Background | Two fixed half-panels; palettes cross-fade at section boundaries |

**Slider** is pointer-driven with its own inertial lerp on the GSAP ticker, so it
never allocates a scroll listener of its own.

## Accessibility

- `prefers-reduced-motion` short-circuits Lenis, the WebGL drift, and every scrub;
  the carousels drop to a single readable state and the quote renders fully lit.
- Skip link, focus-visible defaults, `aria-expanded` on both rail toggles,
  Escape closes the nav overlay.
- The custom cursor is suppressed on coarse pointers.

## Notes

Imagery is generated procedurally (CSS gradients, canvas halftone, WebGL) — there
are no binary image assets in the repo. The contact form is a demo and posts nowhere.
