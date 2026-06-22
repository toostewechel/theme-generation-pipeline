# The Color Engine, in Plain Terms

*A non-technical overview of what we added to the token pipeline and why it matters. Written 2026-06-22.*

## TL;DR

We used to hand-pick every color in the design system, one value at a time, twice (once for light mode, once for dark). Now a small "engine" **generates the entire color set from three simple inputs**: a base gray, a contrast level, and your brand accent colors. Pick those three things and the whole palette falls out, light and dark, with accessibility already guaranteed. Change an input and everything updates together, instantly and consistently.

It bolts onto the pipeline we already have. None of the existing plumbing (the part that ships tokens to the website and other platforms) changed. We just replaced the slow, manual, error-prone part at the front.

## The old way vs. the new way

| | Before (hand-authored) | After (generated) |
|---|---|---|
| Defining colors | Pick ~100+ values by hand | Pick 3 inputs, derive the rest |
| Light + dark | Maintain two separate sets | One source, both modes out |
| Accessibility | Check contrast after, fix bugs as they appear | Built in: it passes by construction |
| Rebrand / new client | Re-pick everything | Paste a brand color, done |
| Consistency | Depends on human discipline | Guaranteed by the math |

## What you actually get (the outcomes)

**1. A whole palette from three decisions.**
Instead of curating hundreds of swatches, a designer chooses a neutral tone, how punchy the contrast should be, and the brand accent colors. The engine derives every surface, text color, border, button fill, and status color from those, in light and dark. Less work, fewer decisions, no drift.

**2. Accessibility stops being a recurring bug.**
This is the big one. The engine tunes every colored button so that white text on it clears the accessibility contrast standard, on *every* intent at once: blue, green, red, amber, whatever. You verify contrast one time and it holds for the entire palette, forever. A whole category of "this label is hard to read" defects simply stops appearing. That matters more every year, because increasingly the thing assembling the interface (a teammate moving fast, or an AI tool) can't eyeball contrast for itself, so the system has to be right by default.

**3. Light and dark for free.**
Dark mode is not a separate project to design and maintain. It comes out of the same engine as a second output. Change the brand color and both modes update in lockstep.

**4. Rebranding takes seconds, not weeks.**
Paste a client's brand hex and the entire system re-derives around it: ramps, buttons, states, dark mode. This is what makes white-labeling and "the same product in a different brand" cheap instead of a rebuild. For the exact brand color itself (a logo, a hero), we also keep a verbatim copy so it always matches precisely.

**5. New theme variants are nearly free later.**
Because everything is generated, "high-contrast mode" or a "color-blind-safe palette" become *different inputs*, not a from-scratch design effort. The capability is built in even before we turn it on.

**6. A studio designers can actually use.**
There is a visual tool where a designer drags sliders or pastes a brand color and sees the whole palette update live, including a real-time readout of which colors pass accessibility and a preview of buttons and components in context. They save, and the system regenerates. No editing config files by hand.

**7. A smaller, simpler set of names to learn.**
We also slimmed the vocabulary the design system exposes. Instead of dozens of near-duplicate color names per component, there is one small, consistent set (foreground, background, borders, plus intents). Easier to learn, easier to keep tidy, and the names describe *roles* so they stay accurate even when the colors change.

## The one analogy

It's the difference between a **dictionary** and a **grammar**.

A dictionary makes you look up every word someone already wrote down. If a word is missing, you're stuck. A grammar lets you *generate* correct sentences you've never seen, from a few rules. The old palette was a dictionary of fixed colors. The new engine is a grammar: give it three inputs and it produces a complete, correct, accessible palette, including combinations nobody hand-authored.

## What this means for risk (for the cautious stakeholder)

- **It's additive.** The existing pipeline that delivers tokens to the website and other platforms is unchanged. We swapped how the color values are produced, not how they're shipped.
- **It's verifiable.** The accessibility guarantee is enforced by automated tests, so it can't silently regress.
- **It's reversible in concept.** The output is still standard design tokens and standard CSS variables; nothing about the engine locks us in.

## In one sentence

> We turned color from a hand-maintained list into a generated system: three inputs produce a complete, accessible, light-and-dark palette, so re-theming is instant, dark mode and accessibility come for free, and a whole class of contrast bugs disappears.

---

# Technical Appendix: How It Works (and Why)

For engineers. The jargon is intentional here.

## Color space

Everything is computed in **OKLCH** (`L` perceptual lightness 0–1, `C` chroma, `H` hue in degrees). It's perceptually uniform, so equal `L` steps read as even, and it's CSS-native (`oklch()`, and `oklch(from … l c h)` for runtime state shifts). All output is emitted as `oklch(L C H)` custom properties, gamut-clamped to Display-P3 via `culori`'s `clampChroma(color, "oklch", "p3")`.

## Inputs

`theme.config.ts` holds the entire design intent:

```ts
{
  neutral:  { hue, chroma },                 // the gray, tinted toward brand
  contrast: 0..1 | "low" | "default" | "high",
  accents:  { primary, secondary, tertiary },// each { hue, chroma }
  status:   { success, error, warning, info },
  brand?:   { primary?, secondary?, tertiary? } // verbatim source colors (exact)
}
```

## Ramp synthesis (the core)

Each hue seed becomes an 11-step ramp (50…950). Two curves drive it:

**Lightness = a per-hue quadratic.** `L(t) = a·t² + b·t + c` over normalized step index `t ∈ [0,1]`, fitted through three anchors: a near-white light end, the **fill step (500) solved for contrast**, and a near-black dark end. Only the fill anchor differs per hue, so each hue gets its own quadratic.

**Why per-hue, not one shared curve:** OKLCH `L` is *perceptual* lightness, not WCAG *relative luminance* `Y`. Two hues at the same `L` have different `Y`, so a single shared lightness array yields inconsistent contrast across hues (measured spread on the old shared curve: white-on-fill ranged 2.39–2.70 at identical `L`). Solving each hue's fill in luminance space removes that.

**The fill solve:** binary search `L` so `wcagContrast(white, fill@hue) == target`. Contrast against white decreases monotonically as `L` rises, so the search converges. Result: white-on-fill lands on the target (default 4.6:1) for **every** hue, `±0` spread. The `contrast` knob raises the target toward 7 via `targetFor()`, which also darkens fills in lockstep.

**Chroma = a skewed gaussian.** `C(t) = peak · exp(−(t−μ)² / 2σ²)` with separate `σ` for the light and dark sides, `peak` = seed chroma, `μ` near the fill. Saturation peaks asymmetrically around mid-ramp in reality; flattening that into one symmetric multiplier makes some hues read flat and others oversaturated. After both curves, every step is P3 gamut-clamped, a monotonic-lightness pass (`EPSILON` nudge) guarantees strictly descending `L`, and a test asserts adjacent steps differ by ≥ 0.025 `L` (no near-collisions).

## Contrast model

WCAG 2.x relative-luminance ratios via `culori`'s `wcagContrast`, deliberately, so the engine's targets equal what a Lighthouse/axe audit measures. `targetFor(base, k)` holds the AA floor (4.5) at/below default contrast and ramps to ~7 as `k → 1`; it never returns below the floor, so generated text is never sub-AA.

## Semantic resolution (hybrid)

One declarative table per mode resolves names to either:
- **fixed-step refs** (e.g. `bg → {color-neutral-0}`), or
- **contrast-targeted** specs: `resolveOnSurface(ramp, surface, minRatio, steps)` walks the ramp and returns the *lowest-contrast step that still clears* `minRatio` against its surface (the most subtle accessible option). Light vs. dark is the same table with the surface end flipped; dark text resolves against the dark surface.

Tokens emit as `$value: "{ref}"` references so Style Dictionary keeps the `var()` graph intact; non-color dimension tokens (state intensities) emit as literal DTCG objects.

## The lean semantic layer

The role × intent matrices were collapsed to `fg-*` / `bg-*` roles (~36 tokens). Intent is a swapped CSS variable (`--fill` points at a ramp), not a token per (intent × slot). A single `fg-on-accent` (white) works on every solid fill *because* fills are WCAG-anchored. Primitive ramps are named by **role** (`secondary`, `tertiary`), not value (`sky`, `pink`), so retuning a hue never makes a name lie. `color-brand-*` carries the verbatim source color (full precision) for exact-match needs, separate from the derived ramp (the ramp seeds from the brand's hue + chroma and discards its lightness, since the ramp generates lightness).

## Pipeline seam

The engine is a **pre-step**, not a rewrite. `build:theme` runs the engine → writes DTCG JSON (`primitives-color`, `color.light`, `color.dark`) into `src/tokens/`. The existing Style Dictionary build (`build:tokens`) consumes them unchanged except for one new `oklch/css` value transform (`culori` → `oklch(L C H[/a])`, P3-clamped) swapped in for `w3c-color/css`. Output is the same `dist/css/tokens.css`: `:root` + `[data-color-mode='dark']` + radius-mode selectors, now with `oklch()` variables. `prism-*` (data-viz palette) stays a static passthrough.

## Isomorphic engine + studio

The engine modules (`ramps`, `contrast`, `semantics`, `derived`, `steps`, `contrast-input`, `types`) are pure TypeScript with zero Node imports; only the I/O shell (`emit-dtcg`, `scripts/buildTheme`) touches the filesystem. That isomorphism lets the **same engine** run in the Node build and in the browser studio (Vite app), so what a designer previews is byte-identical to what ships. A test greps the pure modules for `fs`/`path`/`node:` imports to keep it that way.

## Test surface (the guarantees, enforced)

- ramp invariants: strictly monotonic `L`, in-P3 after clamp, neutral chroma below a ceiling;
- spacing guard: adjacent steps ≥ 0.025 `L`;
- **WCAG-fill invariant**: white-on-fill ≥ target and near-constant across all hue ramps; contrast knob darkens fills;
- contrast resolver, semantics-pass-WCAG-in-both-modes, DTCG emission, the `oklch/css` transform, and the isomorphism guard.

## Why it works, in one line

Solving fill lightness per hue *in WCAG-luminance space* turns contrast from a per-color accident into a constant, provable property of the system: pass the check once, it holds for the whole palette.
