# Portfolio — motion-led one-pager

A scroll-driven single-page site. Smooth-scroll layer feeding GSAP ScrollTrigger,
a Three.js disc-ring mark composited with `mix-blend-mode: difference`, and a 3D
word carousel.

## Run it

```bash
python3 -m http.server 8777      # or: npx serve .
# http://127.0.0.1:8777
```

No build step, no install — the three libraries are vendored.

## Layout

```
index.html              markup + section order
assets/css/style.css    tokens, 12-col grid, components, motion primitives
assets/js/main.js       orchestration (boot order at the bottom)
assets/js/logo-webgl.js Three.js disc-ring + GLSL gradient shader
vendor/                 gsap 3.12.5, ScrollTrigger, lenis 1.0.42, three r160
```

## Layout system

Root font-size is `62.5%`, so `1rem = 10px` and every value in the stylesheet reads
in tens. The page is a **12-column grid**: `gap: 0 2.4rem`, `padding: 0 1.2rem`.
A fixed **6.5rem rail** is pinned to the right edge; `.content-wrapper` carries a
matching `margin-right`, so the grid resolves against the remaining width.

Type scale is fixed rather than fluid: `h1` 17.5rem/1, `h2` 15rem/0.8,
`h3` 3rem/1.05, `p` 1.8rem/1, `p2` 1.4rem/1 — with a `h2--scale` variant at
`10.13514vw` for headlines that must track the viewport.

## Motion

**One scroll loop.** Lenis owns scrolling and drives GSAP's ticker; ScrollTrigger
updates from Lenis' `scroll` event, so nothing else schedules frames:

```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

**Entrances are CSS, not tweens.** Text is split into `.anim-char` / `.anim-line`
spans with staggered `transition-delay`; ScrollTrigger only toggles an `.is-visible`
class on the container and CSS does the rest. Characters flip up in 3D under a
`perspective: 100rem`:

```css
.anim-char { opacity:0; transform:translateY(10rem) rotateX(-90deg);
             transition:transform 1.2s cubic-bezier(.19,1,.22,1), opacity .5s linear }
.is-visible .anim-char { opacity:1; transform:translateY(0) rotateX(0) }
```

`.anim-square` (blocks wiping up from `translateY(100%)`) and `.anim-fade` follow
the same pattern.

**The ring mark** threads ~46 translucent discs along parametric paths. Each disc is
a quad with its corners discarded in the fragment shader, shaded by a six-stop
vertical gradient then graded (tint / contrast / brightness / saturation). The whole
canvas composites with `mix-blend-mode: difference`, so the mark inverts whatever
gradient sits behind it rather than painting over it.

**The word carousel is a 3D drum.** `.words-carousel__list` is a `50vw` square with
`transform-style: preserve-3d`; each word is rotated `i * (360/n)` degrees about X and
pushed out by the radius. Scrolling the 400vh section rotates the drum, so words
arrive face-on and leave edge-on.

| Component | Mechanism |
|---|---|
| Discipline carousel | Full-height invisible prev/next halves, synced title + figure + copy, auto-advance while in view |
| Slider | Pointer drag with an inertial lerp on the GSAP ticker |
| Buttons | Dual-label swap (main up `-4rem`, ghost in from `+4rem`) over a `scaleY` wipe |
| Cursor | 15rem follower; arrow draws itself via `stroke-dashoffset`, rotates per `prev`/`next` |
| Background | Two fixed half-panels, palettes cross-fading at section boundaries |

## Accessibility

- `prefers-reduced-motion` short-circuits Lenis, the WebGL drift and every scrub;
  split text renders fully visible and the drum stops rotating.
- Skip link, `aria-expanded` on both rail toggles, Escape closes the nav overlay.
- The custom cursor is gated behind `(hover:hover) and (pointer:fine)`.

## Notes

All imagery is procedural — CSS gradients and WebGL. There are no binary assets in
the repo. Forms are demos and post nowhere.
