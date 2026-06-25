# Alpha-over-white color tokens — design

**Date:** 2026-06-25
**Status:** Approved for planning

## Summary

Add an optional engine feature that emits **alpha-channel twins** of the primitive
color ramps. For each solid ramp step, derive the most-transparent color that —
composited over a white background — renders identically to the solid. This is the
same operation as [alphredo.app](https://alphredo.app/): one translucent token that
matches the solid over white *and* tints correctly over any other surface (borders,
hover/press fills, overlays).

The feature is **off by default** and toggled by a single boolean on `ThemeInputs`,
surfaced as a switch in Color Studio.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Primary use case | Universal tints/overlays — most/all ramp steps get an alpha twin |
| Background solved against | **White only** (`#fff` / sRGB `[1,1,1]`) |
| Ramp coverage | **All 8 named ramps**: neutral, accent, secondary, tertiary, success, error, warning, info. `darkSurface` and `brand` excluded |
| Relationship to existing `color-black/white-alpha-*` | **Coexist** — fixed opacity ladder unchanged; new twins added alongside |
| Toggle shape | **Single global boolean** `alpha?: boolean` |
| Default | **Off** (opt-in; current output unchanged when unset) |
| Math space vs storage space | Solve in **sRGB-gamma**; store in **OKLCH + alpha** |

## Why solve in sRGB but store in OKLCH

These are two independent choices and they do not trade off:

- **Math space must be sRGB-gamma.** Browsers and Figma composite alpha in
  gamma-encoded sRGB. alphredo's guarantee ("renders identically over the
  background") only holds if the alpha amount and back-solved color are computed in
  that space. The alpha amount is `1 − min(sRGB channel)`.
- **Storage space is free.** The pipeline ([src/transforms/oklchColor.ts](../../../src/transforms/oklchColor.ts))
  already accepts both sRGB and OKLCH token inputs (`dtcgToCulori`) and normalizes
  everything to `oklch(L C H / a)` on output. `oklchToDtcg`
  ([src/engine/dtcg.ts](../../../src/engine/dtcg.ts)) already emits an `alpha`
  field and `formatOklch` already preserves it. The browser then composites that
  `oklch()` color in sRGB-gamma regardless of the stored coordinate space.
  sRGB→OKLCH conversion of an in-gamut color is lossless to 4 dp.

So: solve in sRGB for fidelity, store in OKLCH for engine consistency. The stale
sRGB committed `primitives-color.mode-1.tokens.json` disappears on the next
`build:theme` (which emits OKLCH) — unrelated to this feature but worth noting.

## Architecture

### 1. Engine derivation — `src/engine/alpha-over.ts` (new module)

A single pure function, kept separate from the fixed-ladder `buildAlphas` in
[src/engine/derived.ts](../../../src/engine/derived.ts) (different concept, no
coupling):

```ts
export function alphaOverWhite(solid: Oklch): Oklch
```

Algorithm:

1. Convert `solid` to gamma sRGB via culori (`rgb({ mode: "oklch", ... })`) →
   `F = [r, g, b]` in 0–1.
2. `alpha = 1 − min(F.r, F.g, F.b)` — the lightest channel caps transparency.
3. Back-solve over white (bg = 1): `Cᵢ = (Fᵢ − (1 − alpha)) / alpha`, clamp float
   noise to `[0, 1]`.
4. Convert `C` back to OKLCH; attach `alpha` rounded to 4 dp.

Edge cases:

- **Pure white solid** (`F = [1,1,1]`): `alpha = 0`. Return a fully transparent
  color (invisible over white = correct match). Guard the divide-by-zero.
- **Black solid** (`F = [0,0,0]`): `alpha = 1`, color = black (opaque).
- Across a ramp: lighter steps → lower alpha, darker steps → higher alpha
  (monotonic by construction).

### 2. Token emission — gate in `buildPrimitivesDtcg` ([src/engine/dtcg.ts](../../../src/engine/dtcg.ts))

After the existing solid-ramp loop, when enabled:

```ts
if (inputs.alpha) {
  for (const [key, prefix] of Object.entries(rampNamePrefix)) {
    for (const [step, color] of Object.entries(ramps[key])) {
      out[`${prefix}-alpha-${step}`] = oklchToDtcg(alphaOverWhite(color));
    }
  }
}
```

- Token names: `color-{ramp}-alpha-{step}` (e.g. `color-accent-alpha-500`,
  `color-neutral-alpha-50`) — mirrors the existing `color-white-alpha-*` convention.
- Iterates `rampNamePrefix` only → the 8 named ramps. `darkSurface` and `brand`
  are not in that map and are correctly excluded.
- No pipeline changes: `oklchToDtcg` emits `alpha`, `formatOklch` preserves it →
  CSS `oklch(L C H / a)`.

### 3. Toggle — engine input ([src/engine/types.ts](../../../src/engine/types.ts))

```ts
/** When true, emit `color-{ramp}-alpha-{step}` twins for the 8 named ramps:
 * each solid step solved (alphredo-style) to the most-transparent color that
 * composites over white to match it. Omitted/false → no alpha twins (default). */
alpha?: boolean;
```

- Falsy → output byte-identical to today; existing consumers and the
  `color-black/white-alpha-*` ladder untouched.
- `theme.config.ts`: field omitted today; flips to `alpha: true` when enabled.
  `serialize.ts` persists it automatically (whole-object stringify).

### 4. Color Studio control ([tools/color-studio/](../../../tools/color-studio/))

- A single Base UI `Toggle` (already imported in
  [Sidebar.tsx](../../../tools/color-studio/src/components/Sidebar.tsx)), placed in
  an "Output" row near the footer actions (Save / Copy for Figma) — it is a global
  output option, not a seed, so it lives outside the foundation/accents/status
  sections.
- Wiring: `onChange({ ...state, alpha: !state.alpha })`. Flows automatically to:
  - **Live preview** (via `rafState`).
  - **Save** → `/__save-theme` → `serialize.ts` → `theme.config.ts`.
  - **Copy for Figma** → `serializeTokenBundle` → `buildTokenBundle` →
    `buildGeneratedFiles` (already routes through `buildPrimitivesDtcg`).
- **Preview rendering:** when enabled, render the alpha ramps over a white plate in
  [Preview.tsx](../../../tools/color-studio/src/components/Preview.tsx) — one
  labeled swatch row per ramp — so the "matches the solid" property is visible.
  This is the only genuinely new UI work.
- **Out of scope:** previewing alpha tints over colored/patterned backdrops; any
  change to `theme-state.ts` `SectionKey`/reset/modified-dot machinery (a global
  boolean is not a resettable seed section).

### 5. Tests

- `src/engine/alpha-over.test.ts`:
  - Round-trip: twin composited over white ≈ original solid (within tolerance).
  - `alpha === 1 − min(channel)`.
  - White solid → `alpha 0`; black solid → `alpha 1`.
  - Monotonic alpha across a representative ramp.
- `src/engine/dtcg.test.ts`:
  - With `alpha: true`: `color-{ramp}-alpha-{step}` present for each of the 8 ramps,
    each with an `alpha` field; count `=== 8 × steps`.
  - With `alpha` omitted: no `*-alpha-*` ramp twins; output byte-identical to today.
- Confirm the Figma bundle (`serializeTokenBundle`) includes the twins when enabled
  (routes through `buildGeneratedFiles`).

### 6. Token drift

The drift check ([src/engine/token-drift.ts](../../../src/engine/token-drift.ts))
compares generated vs committed tokens. Default off + committed `theme.config.ts`
without `alpha` → **no drift**. If `alpha: true` is later committed, regenerate so
committed files match. Verify drift stays green in both states; note any ignore-list
handling if required.

## Scope boundaries

**In scope:** `alpha-over.ts` module, gated emission in `buildPrimitivesDtcg`,
`alpha?` type field, Studio toggle + minimal white-plate preview, tests.

**Out of scope (YAGNI):** multiple/configurable backgrounds; per-ramp toggles;
alpha twins for `darkSurface`/`brand`; superseding or modifying the existing
`color-black/white-alpha-*` ladder; preview over non-white backdrops.

## Footprint

One new pure module, one gated loop, one optional type field, one Studio toggle plus
a minimal preview row, and tests. No pipeline/transform changes.
