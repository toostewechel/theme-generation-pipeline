# Intent Border Tokens — Design Spec

*Written 2026-06-22. Adds per-intent border tokens (success/error/warning/info/neutral), each with a solid and a `-subtle` variant, for both light and dark modes, to the color engine's semantic layer. Then regenerates the pipeline and syncs the output to the snapshotlabs site.*

## Goal

The semantic layer carries a full per-intent set for foreground (`color-fg-{intent}`) and background (`color-bg-{intent}`, `color-bg-{intent}-subtle`), but the border set is neutral/brand only — there is no `color-border-success`, `-error`, `-warning`, `-info`, or `-neutral`. This closes that gap so a colored callout, validation field, or status chip has a dedicated border token instead of falling back to `border-default` or a `bg-*` value.

## Tokens added (10 names × 2 modes = 20 entries)

Solid and subtle variant for each of the four intents plus neutral:

- `color-border-success`, `color-border-success-subtle`
- `color-border-error`, `color-border-error-subtle`
- `color-border-warning`, `color-border-warning-subtle`
- `color-border-info`, `color-border-info-subtle`
- `color-border-neutral`, `color-border-neutral-subtle`

## Ramp-step mapping

Each token is a `ref()` to a ramp step, following the existing `bg-*`/`fg-*` pattern. Guiding logic: a **solid** intent border sits one step stronger than the `500` fill (so a filled/tinted element has a defined rim); a **subtle** border is a faint hairline, one step more visible than the `-subtle` fill (`100` light / `900` dark). Steps invert across modes the same way `fg-*` does (lower step = lighter; dark surfaces need lighter borders to be visible).

| Token | Light step | Dark step |
|---|---|---|
| `color-border-success` | `success` `600` | `success` `400` |
| `color-border-success-subtle` | `success` `200` | `success` `800` |
| `color-border-error` | `error` `600` | `error` `400` |
| `color-border-error-subtle` | `error` `200` | `error` `800` |
| `color-border-warning` | `warning` `600` | `warning` `400` |
| `color-border-warning-subtle` | `warning` `200` | `warning` `800` |
| `color-border-info` | `info` `600` | `info` `400` |
| `color-border-info-subtle` | `info` `200` | `info` `800` |
| `color-border-neutral` | `neutral` `300` | `neutral` `700` |
| `color-border-neutral-subtle` | `neutral` `200` | `neutral` `800` |

## Implementation

All changes are in `src/engine/semantics.ts`, in the kept-token tables alongside the existing borders:

- `KEEP_LIGHT` (currently `src/engine/semantics.ts:167-174`): add the 10 tokens with their **Light** steps using `ref("<ramp>", "<step>")`.
- `KEEP_DARK` (currently `src/engine/semantics.ts:211-218`): add the same 10 tokens with their **Dark** steps.

No new helper, type, or module is needed — `ref()` already exists and is the mechanism the surrounding borders use. The tokens flow through `resolveSemantics` → `buildSemanticDtcg` → `color.light/dark.tokens.json` → Style Dictionary → `dist/css/tokens.css` with no other code change, and they are automatically included in the Figma export bundle (which serializes the same semantic files).

Place the new entries grouped together (e.g. after `color-border-brand-secondary`) and keep the light/dark ordering identical so the two tables read in parallel.

## Pipeline regeneration + snapshotlabs sync

After the engine change:

1. `npm run build:theme` — regenerates `src/tokens/color.light.tokens.json` and `color.dark.tokens.json` (now containing the 10 new border refs each). `primitives-color.mode-1.tokens.json` is unchanged (no new primitives).
2. `npm run build:tokens` — regenerates `dist/css/tokens.css` with the new `--color-border-*` custom properties under `:root` (light) and the dark selector.
3. Copy `dist/css/tokens.css` verbatim over `~/Documents/GitHub/snapshotlabs/site/src/styles/_tokens.scss` (branch `feat/lean-token-migration`). The new tokens appear; everything else is unchanged.

## Testing

- The existing parity guard (`src/engine/semantics.test.ts:46-58`) already enforces that `SEMANTICS_LIGHT` and `SEMANTICS_DARK` define identical keys — adding a token to only one table fails the suite. Adding all 20 entries keeps it green.
- Add a focused test in `semantics.test.ts` asserting the 10 new names resolve and reference the expected ramp/step in each mode (e.g. `color-border-success` → `{success-600}` light, `{success-400}` dark), so the step mapping is pinned and a future retune can't silently shift it.
- `npm test` must stay green overall.

## Non-goals

- No new primitive colors (borders reuse existing ramp steps).
- No change to the existing neutral/brand border tokens (`border-default`, `-emphasis`, `-subtle`, `-gridlines`, `-white`, `-interactive-frame`, `-brand-primary`, `-brand-secondary`).
- No interaction-state border tokens (hover/focus/active) — out of scope.
- No automatic commit in the snapshotlabs repo; the sync is a file copy and the user reviews/commits there.

## Risks / trade-offs

- **Step choices are aesthetic.** The `600/400` solid and `200/800` subtle mapping is a judgment call; the pinned test makes any future change explicit rather than accidental. `border-neutral` (`300`/`700`) is the most subjective and easy to retune later.
- **P3→sRGB at the boundary** is unchanged from the rest of the system; borders emit as `oklch()` like every other color token.
