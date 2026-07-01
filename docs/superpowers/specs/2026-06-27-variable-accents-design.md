# Variable accents (1–3) — design

**Date:** 2026-06-27
**Status:** Approved (design)

## Summary

Let the user add and remove accent colors in Color Studio, with a minimum of 1
and a maximum of 3. Accents are *named, tail-ordered* slots — `primary`
(always present), then `secondary`, then `tertiary`. The engine emits the
primitive ramps and brand tokens only for the accents that exist; the Figma
seed export shrinks accordingly. Token names stay frozen (the 2nd accent is
always `secondary`, the 3rd always `tertiary`), preserving the Figma round-trip.

Builds on the just-merged primitives-only engine: the engine exports primitives
only and `resolveSemantics` is used solely by the live preview. So removing an
accent affects (a) which primitive ramps/brand tokens are emitted and (b) the
preview — never the semantic mapping shipped to Figma.

## Data model & invariant

`src/engine/types.ts`:
- `ThemeInputs.accents` becomes `{ primary: HueSeed; secondary?: HueSeed; tertiary?: HueSeed }`.
- `ThemeInputs.brand` slots stay optional (already `{ primary?; secondary?; tertiary? }`).
- `RampSet.secondary` and `RampSet.tertiary` become optional (`Ramp | undefined`).

**Invariant:** tail-ordering (no `tertiary` without `secondary`) is guaranteed
by the UI, NOT enforced by the engine. The engine emits each slot
*independently* — primary always, secondary iff present, tertiary iff present —
so it is robust to any combination and needs no ordering checks.

## Engine changes

### `src/engine/ramps.ts`
`buildRamps` builds `secondary`/`tertiary` only when the corresponding seed is
present:
```
secondary: inputs.accents.secondary ? hue(inputs.accents.secondary) : undefined,
tertiary:  inputs.accents.tertiary  ? hue(inputs.accents.tertiary)  : undefined,
```
`accent` (primary), `neutral`, `status`, and `darkSurface` are unchanged.

### `src/engine/dtcg.ts`
`buildPrimitivesDtcg`:
- The `rampNamePrefix` loop skips a ramp when `ramps[key]` is `undefined` (no
  `color-secondary-*` / `color-tertiary-*` emitted for absent slots).
- The brand loop emits `color-brand-{slot}` only for slots present in
  `inputs.accents` (skip absent `secondary`/`tertiary`).
- The alpha-twin loop skips absent ramps (it already iterates `rampNamePrefix`;
  guard the same way).

`buildSemanticDtcg` stays as-is structurally; it delegates to `resolveSemantics`
(below).

### `src/engine/semantics.ts`
`resolveSemantics` must remain total when an accent slot is absent. Add a
fallback: an accent-slot reference (`secondary`/`tertiary`) whose ramp is absent
in the passed `RampSet` resolves to the `accent` (primary) ramp at the **same
step**. Concretely, route the slot→name resolution (the `ramp === "secondary"`
/ `ramp === "tertiary"` branches near line 48) through a helper:
```
function accentSlotOrFallback(slot: "secondary" | "tertiary", ramps: RampSet): "accent" | "secondary" | "tertiary" {
  return ramps[slot] ? slot : "accent";
}
```
so e.g. `color-fg-secondary` resolves to `{color-accent-700}` when no secondary
accent exists. `neutral`/`status` refs are unaffected.

## Preview changes (`tools/color-studio/src/ui/preview.ts`)

- **Ramps tab:** render the Secondary / Tertiary ramp specimens only when
  `set.secondary` / `set.tertiary` exist (the rows around lines 130, 157, 189).
  Primary is always shown.
- **Playground:** styled from semantic vars; with the `resolveSemantics`
  fallback (above), every `--color-*` var stays defined, so the playground
  renders fully regardless of accent count (specimens for removed accents adopt
  the primary color).
- The seed-control loop that reads `state.accents[slot]` (lines ~189–193) skips
  absent slots.

## UI / interaction

### `tools/color-studio/src/lib/theme-state.ts`
Add two pure helpers and one constant:
- `MAX_ACCENTS = 3`, primary is the implicit min (1).
- `accentCount(t: ThemeInputs): 1 | 2 | 3` — number of present slots in order.
- `addAccent(t: ThemeInputs): ThemeInputs` — appends the next tail slot
  (`secondary` if absent, else `tertiary`) with a **hue-rotated default seed**:
  `{ hue: (t.accents.primary.hue + 90 * k) mod 360, chroma: t.accents.primary.chroma }`
  where `k` = the new slot's index (secondary → 1, tertiary → 2). Leaves `brand`
  for that slot unset (the engine derives `color-brand-*` from the seed). No-op
  when already at 3.
- `removeAccent(t: ThemeInputs): ThemeInputs` — drops the **last present** slot
  from `accents` and the matching `brand` entry. No-op when only primary remains.

Existing `slice`/`isSectionModified`/`resetSection` already operate on the whole
`accents` object and need no change (reset restores the baseline accent set,
including count).

### `tools/color-studio/src/components/Sidebar.tsx`
- Replace the fixed `ACCENTS` map with an iteration over the present slots
  (`["primary","secondary","tertiary"].filter(k => state.accents[k])`).
- Each non-primary present slot's `SeedControl` gets a remove (✕) control;
  primary has none. Wire it to `onChange(removeAccent(state))`. (Only the last
  slot is removable in practice because of tail-ordering, but gating the button
  to the last present slot is the explicit rule.)
- Render an **"Add accent"** button after the list when `accentCount(state) < 3`,
  wired to `onChange(addAccent(state))`.
- The existing `onSeed` brand-rewrite-on-paste logic is preserved per slot.

## Serialization / config

`serialize.ts` is `JSON.stringify(inputs)` — absent optional slots are omitted
automatically; no change. `theme.config.ts` defaults keep all three accents
(no change). A saved 1- or 2-accent config simply omits the absent slots.

## Out of scope

- The Status section stays a fixed 4 (success/error/warning/info).
- No arbitrary/middle removal or slot renumbering (tail-based only).
- No change to the primitives-only export contract beyond emitting fewer ramps.

## Testing

- `src/engine/ramps.test.ts`: 1-accent input → `secondary`/`tertiary` undefined;
  2-accent → `tertiary` undefined, `secondary` defined.
- `src/engine/dtcg.test.ts`: 1-accent `buildPrimitivesDtcg` omits
  `color-secondary-*`, `color-tertiary-*`, `color-brand-secondary`,
  `color-brand-tertiary`; with `alpha:true` no `color-secondary-alpha-*` twins.
- `src/engine/emit-dtcg.test.ts` / `figma-export.test.ts`: a 1-accent bundle's
  primitives file omits the absent ramps (export still primitives-only).
- `src/engine/semantics.test.ts`: with no secondary accent,
  `resolveSemantics(...).["color-fg-secondary"]` resolves to `{color-accent-700}`
  (light) — fallback to primary at the same step.
- `tools/color-studio/src/lib/theme-state.test.ts`: `accentCount`, `addAccent`
  (appends correct slot with hue-rotated seed; no-op at 3), `removeAccent`
  (drops last slot + its brand entry; no-op at 1).
- Existing 3-accent tests remain green (defaults unchanged).

## Verification

- `npm test` passes (new + existing).
- `npm run preview:studio`: adding/removing accents updates the sidebar, ramps
  tab, and playground live; removing drops the ramp specimen and shrinks the
  Figma copy; the playground stays fully styled at any count.
