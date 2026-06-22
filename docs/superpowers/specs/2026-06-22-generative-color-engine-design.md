# Generative Color Engine — Design Spec

**Date:** 2026-06-22
**Repo:** `theme-generation-pipeline`
**Status:** Approved for planning

## Summary

Replace the hand-authored color *dictionary* in the token pipeline with a
generative *grammar*. Today every color is hand-tuned sRGB hex: primitive
palettes (`color-neutral-*`, `color-accent-*`, …) plus independently authored
`color.light` / `color.dark` semantic files. We replace the color half of the
pipeline with an engine that **derives** the entire color token set — ramps and
semantics, light and dark — from three conceptual inputs:

1. a **neutral seed** (the gray, expressed in OKLCH),
2. a **contrast** value (how far the lightness range is spread),
3. an **accent set** (primary / secondary / tertiary brand hues), plus a fixed
   **status-hue map** (success / error / warning / info) the engine ramps.

"It's a grammar, not a dictionary. You don't look up the word, you derive it."

This unlocks light/dark from one source, and makes later flex themes
(high-contrast, color-blind-safe, white-label) a matter of changing inputs
rather than re-authoring tokens.

## Goals

- Derive all color tokens from the three inputs above, in OKLCH.
- Emit the **same semantic token names** the pipeline produces today, so
  downstream consumers (the Snapshot Labs site) need no rewiring.
- Output `oklch(L C H)` CSS variables (P3-capable, gamut-clamped).
- **Match the current look closely** — calibrate inputs and the semantic
  mapping so generated output is visually indistinguishable from today's, giving
  an old-vs-new diff as a correctness check.
- Ship a lightweight **studio** (Vite dev app) so designers tweak the inputs
  visually and see ramps, semantics, and a sample UI update live, then Save back
  to the config.
- Establish the pipeline's first automated tests around the engine.

## Non-Goals (YAGNI)

- **Flex themes** (high-contrast / color-blind-safe / white-label) are *not*
  built now. The engine is architected so they are a future input set, not new
  code, but they are out of scope for v1.
- **Site-side work** in `snapshotlabs` is out of scope. The engine emits the
  same names; consuming the new `tokens.css` is a trivial downstream follow-up.
- Typography, spacing, and radius tokens are **untouched**. The engine owns
  color only.
- No hex / dual-format output. `oklch()` only.

## Scope Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Scope | Pipeline engine only |
| Input model | Neutral seed + contrast + accent **set** (primary/secondary/tertiary); status hues are separate fixed seeds the engine ramps |
| Derivation | **Hybrid** — fixed-step mapping for most tokens; contrast-targeted resolution for contrast-sensitive tokens (text/border on surfaces) |
| Engine seam | Engine emits DTCG color files; existing Style Dictionary build consumes them unchanged |
| Target look | Match current look closely (provable parity) |
| Color format | `oklch(L C H)` output |
| Color library | `culori` (zero-dep, browser-safe) + WCAG-2 contrast |
| Studio | Vite dev app with a dev-only Save endpoint that writes `theme.config.ts` |
| Contrast input | A 0–1 number with `low`/`default`/`high` word-aliases (`0.25` / `0.5` / `0.85`) |

## Architecture

```
theme.config.ts            ← the 3 inputs (neutral seed, contrast, accent set + status hues)
        │
        ▼
  engine/ (new, isomorphic — no Node-only imports)
   ├─ ramps.ts             ← inputs → OKLCH ramps (neutral, each accent, each status) at steps 50…950
   ├─ contrast.ts          ← wcagContrast helpers + resolveOnSurface() target resolver
   ├─ semantics.ts         ← maps ramps → semantic tokens (fixed-step OR contrast-targeted)
   ├─ emit-dtcg.ts         ← (Node) writes generated DTCG JSON into src/tokens/
   └─ build-theme.ts       ← (Node) orchestrator: npm run build:theme, runs before build:tokens
        │
        ▼
  src/tokens/*.tokens.json  (generated color files replace hand-authored ones)
        │
        ▼
  Style Dictionary (existing buildTokens.ts + new oklch/css transform) → dist/css/tokens.css

  studio/ (new, Vite dev app)
   └─ imports engine/{ramps,contrast,semantics}.ts directly → live preview + Save endpoint
```

### Key principle: the engine is isomorphic

`ramps.ts`, `contrast.ts`, and `semantics.ts` are pure TypeScript with **no
Node-only imports** (culori is browser-safe). The same engine runs in two
callers — the CLI build and the browser studio — so there is **zero logic
duplication and no drift** between what a designer previews and what the build
emits. Only `emit-dtcg.ts` and `build-theme.ts` (the fs/path I/O shell) are
Node-only. A test guards against `fs`/`path` leaking into the pure modules.

## The Derivation Model

### Inputs (`theme.config.ts`)

```ts
type HueSeed = { hue: number; chroma: number };   // OKLCH H (0–360), C

type ContrastInput = number | 'low' | 'default' | 'high';
// word-aliases resolve to numbers: low → 0.25, default → 0.5, high → 0.85
// raw numbers are clamped to [0, 1]

export interface ThemeInputs {
  neutral:  HueSeed;            // near-gray: low chroma, tints the whole UI
  contrast: ContrastInput;      // widens/compresses the lightness spread + nudges WCAG targets
  accents:  { primary: HueSeed; secondary: HueSeed; tertiary: HueSeed };
  status:   { success: HueSeed; error: HueSeed; warning: HueSeed; info: HueSeed };
}
```

### Ramp synthesis (`ramps.ts`)

- Each seed becomes a ramp across the **same fixed step indices used today**:
  `0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950` (neutral includes
  `0`; accent/status start at `50`).
- A calibrated **lightness curve** sets each step's OKLCH `L`.
- A **chroma curve** scales the seed's chroma — peaks mid-ramp, tapers toward
  the extremes; neutral stays near-zero so grays read neutral.
- The **contrast** input scales the lightness spread: higher pushes light steps
  lighter and dark steps darker; lower compresses toward the middle. One knob
  reshapes the single shared lightness curve, which all ramps inherit, keeping
  the system coherent.
- Every resulting color is **gamut-clamped to P3** (culori `toGamut`) so the
  emitted `oklch()` is always renderable.

### Contrast resolver (`contrast.ts`)

- `wcagContrast(a, b)` — WCAG-2 relative-luminance ratio (matches what
  accessibility audits check, so engine targets and audit results agree).
- `resolveOnSurface(ramp, surface, minRatio)` — walks the ramp for the first
  step meeting `minRatio` against the given surface color.
- The contrast input also **nudges WCAG targets**: higher contrast raises the
  minimum (e.g. 4.5 → up toward 7) so punchier themes genuinely earn it; lower
  relaxes toward the 4.5 floor but **never below it** — the engine does not
  generate inaccessible text.

### Semantic mapping (`semantics.ts`)

One declarative table, calibrated from the current `_tokens.scss`:

- **fixed-step** tokens emit a reference mirroring today, e.g.
  `text-default → {color-neutral-800}`. Parity by construction.
- **contrast-targeted** tokens (text/border on surfaces) declare an intent,
  e.g. `text-default → { on: 'surface-default', ramp: 'neutral', min: 4.5 }`,
  resolved by the engine.
- **Light vs dark** comes from one table: dark flips which ramp end is
  "surface," and contrast-targeted tokens re-resolve against the dark surface.
  Fixed-step dark assignments are calibrated from the current
  `color.dark.tokens.json`.

"Match current look" holds because the mapping table *is* the current semantic
assignment set; the engine regenerates the ramps perceptually underneath and
re-derives only the contrast-sensitive handful.

## Output & Build Wiring

- The engine regenerates **only** the color DTCG files: `primitives-color` (the
  ramps) and `color.light` / `color.dark` (semantics — references for
  fixed-step tokens, resolved values for contrast-targeted ones). It overwrites
  those files in `src/tokens/` and **does not touch** typography, spacing,
  radius, or `manifest.json`.
- **One Style Dictionary change:** register a new `oklch/css` color transform
  (culori → `oklch(L C H)`, gamut-clamped) and use it for color tokens in place
  of `w3c-color/css`. Everything else in `buildTokens.ts` — reference
  resolution, `:root` / `[data-color-mode='dark']` wrapping, the radius modes —
  is unchanged.
- Regenerated color JSON carries an `auto-generated by build:theme — do not
  edit` banner. Build order: `build:theme` → `build:tokens`.

## The Studio

A small **Vite dev app** in `studio/`, launched with `npm run theme:studio`.

```
studio/
  index.html
  main.ts            (mounts the UI)
  ui/*.ts            (input controls, ramp swatches, semantic swatches, sample UI)
  save-plugin.ts     (Vite middleware: POST → writes theme.config.ts)
```

Layout:

```
┌──────────────┬───────────────────────────────────────────────┐
│  INPUTS      │  PREVIEW                          [Light|Dark] │
│ Neutral seed │  Neutral / Primary / Status ramps, 50…950      │
│ Contrast     │   (swatch + step label + WCAG-contrast badge)  │
│ Accent set   │  SEMANTICS  surfaces · text · borders · intents│
│ Status hues  │  SAMPLE UI  [Button][Chip] card · link · text  │
│              │  Export: config snippet [Copy][Download][Save] │
└──────────────┴───────────────────────────────────────────────┘
```

How it works:

1. Loads the current `theme.config.ts` as initial state.
2. Every control change re-runs the engine **in memory** and instantly
   re-renders ramps (with WCAG badges), semantic swatches, and a small **sample
   UI** of real component shapes so color is judged in context.
3. Light/dark toggle shows both outputs of the one engine; contrast-targeted
   tokens visibly re-resolve.
4. **Save** POSTs the new inputs to the Vite dev middleware, which writes
   `theme.config.ts`. The designer then runs `build:theme && build:tokens` for
   real CSS.

The studio is an isolated module that *imports* the engine. It can be built as
a later phase once the engine is proven.

## Parity & Testing (TDD)

The pipeline has no automated tests today; the engine is where that changes.

1. **Ramp invariants** — lightness is monotonic across steps; every color is in
   P3 gamut; neutral chroma stays below a small ceiling.
2. **Contrast guarantees** — every contrast-targeted token meets its WCAG
   minimum against its surface, in **both** light and dark. This is the
   accessibility safety net.
3. **Parity snapshot** — with the calibrated inputs, generated semantics land
   within a small ΔE / ΔL tolerance of the current `_tokens.scss` values; a
   snapshot test flags drift so "match current look" is provable.
4. **Isomorphism guard** — importing the pure engine modules in a non-Node
   context must not pull in `fs`/`path`, keeping the studio buildable.

### v1 Acceptance bar

- Generated `tokens.css` is visually indistinguishable from today's.
- Every contrast-targeted token passes its WCAG minimum in light and dark.
- The studio renders the same output live and Save round-trips to
  `theme.config.ts`.

## Dependencies

- **Add (runtime/build):** `culori` — OKLCH math, gamut clamping, WCAG contrast.
- **Add (dev):** `vite` — the studio dev app.
- **Test runner:** a lightweight runner compatible with `tsx`/ESM (e.g.
  `vitest`, which also pairs naturally with Vite) — final choice made in the
  implementation plan.

## Risks & Mitigations

- **Parity drift on contrast-targeted tokens** — they may land a step away from
  the hand-tuned value. *Mitigation:* the parity snapshot test with an explicit
  tolerance; calibrate the lightness/chroma curves until within tolerance.
- **Isomorphism accidentally broken** — a future edit imports `fs` into a pure
  module and breaks the studio. *Mitigation:* the isomorphism guard test.
- **`oklch()` browser support (~96%)** — acceptable for this site; out of scope
  to add fallbacks (explicit non-goal).
```
