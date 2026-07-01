# Variable Accents (1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Color Studio add/remove accent colors (min 1, max 3); the engine emits primitive ramps and brand tokens only for the accents that exist.

**Architecture:** Accents are named, tail-ordered, optional slots — `primary` (always), then `secondary`, then `tertiary`. `buildRamps` *omits* absent ramp keys; `buildPrimitivesDtcg` skips absent ramps/brand/alpha-twins; `resolveSemantics` falls a missing accent slot back to `primary` so the live preview stays whole. The studio sidebar gains add/remove controls backed by pure helpers in `theme-state.ts`.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), culori, vitest (node env), React 19 + Base UI (color-studio, Vite).

## Global Constraints

- DTCG token format ($type/$value; refs as `{token-name}`). Primitive token names are frozen — the 2nd accent is always `secondary`, the 3rd always `tertiary`.
- Tail-ordering (no `tertiary` without `secondary`) is a UI guarantee; the engine must treat each slot independently and never assume ordering.
- Accent count is clamped to [1, 3]; `primary` is never removable.
- ESM imports use `.js` extensions even for `.ts`/`.tsx` sources.
- Engine + helper tests run with `npx vitest run <path>` (node env, no DOM). color-studio UI files (preview.ts, Sidebar.tsx, SeedControl.tsx) have no DOM test env by precedent — their gate is `cd tools/color-studio && npm run build` plus the manual checklist.
- No new dependencies. Do not touch the primitives-only export contract beyond emitting fewer ramps. Status section stays a fixed 4.

---

### Task 1: Optional accent slots in types + `buildRamps` omits absent ramps

**Files:**
- Modify: `src/engine/types.ts:13` (accents shape) and `src/engine/types.ts:48-59` (RampSet)
- Modify: `src/engine/ramps.ts:98-118` (buildRamps)
- Test: `src/engine/ramps.test.ts`

**Interfaces:**
- Consumes: `buildHueRamp`, `HueSeed`, `ThemeInputs` (existing).
- Produces: `ThemeInputs.accents = { primary: HueSeed; secondary?: HueSeed; tertiary?: HueSeed }`. `RampSet.secondary?: Ramp` and `RampSet.tertiary?: Ramp` (optional). `buildRamps(inputs)` returns a `RampSet` whose `secondary`/`tertiary` keys are **absent** (not `undefined`) when the corresponding accent seed is absent.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/ramps.test.ts` (keep existing tests). If the file has a shared `INPUTS`-style fixture, reuse it; otherwise this block defines its own:

```typescript
import { describe, it, expect } from "vitest";
import { buildRamps } from "./ramps.js";
import type { ThemeInputs } from "./types.js";

const BASE: ThemeInputs = {
  neutral: { hue: 70, chroma: 0.006 },
  contrast: "default",
  accents: { primary: { hue: 138, chroma: 0.12 } },
  status: {
    success: { hue: 150, chroma: 0.12 }, error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 }, info: { hue: 240, chroma: 0.12 },
  },
};

describe("buildRamps — variable accents", () => {
  it("omits secondary and tertiary when only primary is present", () => {
    const set = buildRamps(BASE);
    expect(set.accent).toBeDefined();
    expect("secondary" in set).toBe(false);
    expect("tertiary" in set).toBe(false);
  });

  it("includes secondary but omits tertiary when two accents are present", () => {
    const set = buildRamps({ ...BASE, accents: { ...BASE.accents, secondary: { hue: 220, chroma: 0.11 } } });
    expect(set.secondary).toBeDefined();
    expect("tertiary" in set).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/ramps.test.ts`
Expected: FAIL — `buildRamps` currently always reads `inputs.accents.secondary`/`.tertiary` (TypeError on undefined, or `secondary in set` is true with an undefined value).

- [ ] **Step 3: Update the types**

In `src/engine/types.ts`, change the `accents` field (line 13) to:

```typescript
  accents: { primary: HueSeed; secondary?: HueSeed; tertiary?: HueSeed };
```

In the same file, make the `RampSet` accent ramps optional (lines 50-51, the `accent`/`secondary`/`tertiary` members):

```typescript
  accent: Ramp; // primary (always present)
  secondary?: Ramp; // 2nd accent, omitted when absent
  tertiary?: Ramp; // 3rd accent, omitted when absent
```

- [ ] **Step 4: Update `buildRamps`**

Replace the `return { ... }` object in `src/engine/ramps.ts:102-117` with a conditional-spread version:

```typescript
  return {
    neutral: buildRamp(inputs.neutral, NEUTRAL_STEPS, NEUTRAL_LIGHTNESS, k),
    accent: hue(inputs.accents.primary),
    ...(inputs.accents.secondary ? { secondary: hue(inputs.accents.secondary) } : {}),
    ...(inputs.accents.tertiary ? { tertiary: hue(inputs.accents.tertiary) } : {}),
    success: hue(inputs.status.success),
    error: hue(inputs.status.error),
    warning: hue(inputs.status.warning),
    info: hue(inputs.status.info),
    darkSurface: buildDarkSurfaces(
      inputs.neutral.hue,
      inputs.neutral.chroma,
      inputs.darkSurfaces?.base,
      inputs.darkSurfaces?.step,
    ),
  };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/ramps.test.ts`
Expected: PASS (new + existing tests in the file).

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/ramps.ts src/engine/ramps.test.ts
git commit -m "feat(engine): optional accent slots; buildRamps omits absent ramps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `buildPrimitivesDtcg` skips absent accent ramps, brand, and alpha twins

**Files:**
- Modify: `src/engine/dtcg.ts:35-72` (buildPrimitivesDtcg)
- Test: `src/engine/dtcg.test.ts`

**Interfaces:**
- Consumes: `buildRamps` from Task 1 (omits absent keys); `inputs.accents` optional slots.
- Produces: `buildPrimitivesDtcg(inputs)` emits no `color-secondary-*`/`color-tertiary-*` tokens, no `color-brand-secondary`/`color-brand-tertiary`, and (with `alpha:true`) no `color-secondary-alpha-*`/`color-tertiary-alpha-*` twins, for accents that are absent.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/dtcg.test.ts` (it already defines a 3-accent `INPUTS` fixture and imports `buildPrimitivesDtcg`). Append:

```typescript
describe("buildPrimitivesDtcg — variable accents", () => {
  const ONE = { ...INPUTS, accents: { primary: INPUTS.accents.primary } };

  it("omits secondary/tertiary ramp tokens when only primary is present", () => {
    const out = buildPrimitivesDtcg(ONE);
    expect(out["color-accent-500"]).toBeDefined();
    expect(out["color-secondary-500"]).toBeUndefined();
    expect(out["color-tertiary-500"]).toBeUndefined();
  });

  it("omits brand tokens for absent accent slots", () => {
    const out = buildPrimitivesDtcg(ONE);
    expect(out["color-brand-primary"]).toBeDefined();
    expect(out["color-brand-secondary"]).toBeUndefined();
    expect(out["color-brand-tertiary"]).toBeUndefined();
  });

  it("omits alpha twins for absent accent ramps", () => {
    const out = buildPrimitivesDtcg({ ...ONE, alpha: true });
    expect(out["color-accent-alpha-500"]).toBeDefined();
    expect(out["color-secondary-alpha-500"]).toBeUndefined();
    expect(out["color-tertiary-alpha-500"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: FAIL — current `buildPrimitivesDtcg` throws (`Object.entries(undefined)` on the absent ramp) or emits brand for absent slots.

- [ ] **Step 3: Guard the ramp loops and brand loop in `buildPrimitivesDtcg`**

In `src/engine/dtcg.ts`, the main ramp loop (lines 38-43) — add a skip for absent ramps:

```typescript
  for (const [key, prefix] of Object.entries(rampNamePrefix)) {
    const ramp = ramps[key as keyof typeof ramps];
    if (!ramp) continue;
    for (const [step, color] of Object.entries(ramp)) {
      out[`${prefix}-${step}`] = oklchToDtcg(color);
    }
  }
```

Replace the brand `slots` block (lines 52-60) so it only includes present accents:

```typescript
  const brandSlots = (["primary", "secondary", "tertiary"] as const).filter(
    (slot) => inputs.accents[slot],
  );
  for (const slot of brandSlots) {
    const seed = inputs.accents[slot]!;
    const brand = inputs.brand?.[slot] ?? { l: BRAND_DEFAULT_L, c: seed.chroma, h: seed.hue };
    out[`color-brand-${slot}`] = oklchToDtcg(brand);
  }
```

In the alpha-twin loop (lines 62-69), add the same skip:

```typescript
  if (inputs.alpha) {
    for (const [key, prefix] of Object.entries(rampNamePrefix)) {
      const ramp = ramps[key as keyof typeof ramps];
      if (!ramp) continue;
      for (const [step, color] of Object.entries(ramp)) {
        out[`${prefix}-alpha-${step}`] = oklchToDtcg(alphaOverWhite(color));
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/engine/dtcg.ts src/engine/dtcg.test.ts
git commit -m "feat(engine): primitives emit skips absent accent ramps/brand/alpha

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `resolveSemantics` falls back a missing accent slot → primary

**Files:**
- Modify: `src/engine/semantics.ts:272-281` (resolveSpec)
- Test: `src/engine/semantics.test.ts`

**Interfaces:**
- Consumes: `RampSet` (optional accent ramps) from Task 1; `nameFor`, `resolveOnSurface`, `stepsFor` (existing).
- Produces: `resolveSemantics(ramps, inputs, mode)` — any spec whose `ramp` (or target `onRamp`) is `secondary`/`tertiary` but absent from `ramps` resolves against `accent` instead, at the same step. Output stays a total map for any accent count.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/semantics.test.ts` (reuse its existing fixture/imports; it imports `resolveSemantics` and `buildRamps`). Append:

```typescript
describe("resolveSemantics — missing accent fallback", () => {
  it("resolves secondary-referencing tokens to the primary ramp when no secondary accent", () => {
    const oneAccent = { ...INPUTS, accents: { primary: INPUTS.accents.primary } };
    const ramps = buildRamps(oneAccent);
    const resolved = resolveSemantics(ramps, oneAccent, "light");
    // color-fg-secondary is ref("secondary", "700"); with no secondary accent it
    // falls back to the primary ramp at the same step.
    expect((resolved["color-fg-secondary"] as { ref: string }).ref).toBe("color-accent-700");
  });
});
```

(If the file's existing tests show refs are stored wrapped in braces, match that convention instead — assert against whatever bare/`{…}` form the sibling tests use.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/semantics.test.ts`
Expected: FAIL — current `resolveSpec` calls `nameFor("secondary", ...)` → `color-secondary-700`, and the target branch throws on `ramps["secondary"]` being undefined.

- [ ] **Step 3: Add the fallback in `resolveSpec`**

In `src/engine/semantics.ts`, add a helper just above `resolveSpec` (line 272) and route both ramp uses through it:

```typescript
/** A semantic ref to an absent accent slot falls back to primary (`accent`),
 * so the resolver stays total for any accent count. UI guarantees tail-order;
 * the engine just substitutes whatever accent slot is missing. */
function accentOrFallback(ramp: RefSpec["ramp"], ramps: RampSet): RefSpec["ramp"] {
  if ((ramp === "secondary" || ramp === "tertiary") && !ramps[ramp]) return "accent";
  return ramp;
}

function resolveSpec(spec: SemanticSpec, ramps: RampSet, k: number): ResolvedToken {
  if (spec.kind === "raw") return { raw: spec.token };
  if (spec.kind === "passthrough") return { ref: spec.name };
  if (spec.kind === "ref") return { ref: nameFor(accentOrFallback(spec.ramp, ramps), spec.step) };
  // target: contrast-resolved ref
  const onRamp = accentOrFallback(spec.onRamp, ramps);
  const fam = accentOrFallback(spec.ramp, ramps);
  const surface = ramps[onRamp]![spec.onStep];
  const min = targetFor(spec.min, k);
  const step = resolveOnSurface(ramps[fam]!, surface, min, stepsFor(fam));
  return { ref: nameFor(fam, step) };
}
```

(If `TargetSpec`'s `onRamp`/`ramp` field type does not already include the accent slots, no change is needed — `accentOrFallback` accepts `RefSpec["ramp"]`, the superset; pass the field as-is. The `!` non-null assertions are sound because `accentOrFallback` only ever returns a present ramp key.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/semantics.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/engine/semantics.ts src/engine/semantics.test.ts
git commit -m "feat(engine): resolveSemantics falls back missing accent to primary

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Preview guards absent accents (alpha ramps, label-on-fill, brand)

**Files:**
- Modify: `tools/color-studio/src/ui/preview.ts:136-147` (renderAlphaRamps), `:155-169` (renderLabelOnFill), `:188-195` (renderBrand)

**Interfaces:**
- Consumes: `RampSet` with optional accent ramps (Task 1); `resolveSemantics` fallback (Task 3, keeps playground vars defined).
- Produces: preview renders for any accent count without throwing. `renderRamps` (`Object.entries(set)`) and `refToColor` (already `?.`) need no change because `buildRamps` omits absent keys.

No unit test (no DOM test env by precedent). Gate is the color-studio build + manual checklist in Task 7.

- [ ] **Step 1: Guard `renderAlphaRamps`**

In `tools/color-studio/src/ui/preview.ts`, change the `ALPHA_RAMPS.map` so absent ramps are filtered out before indexing (replace lines 137-138 region):

```typescript
  const rows = ALPHA_RAMPS.filter((name) => set[name]).map((name) => {
    const ramp = set[name] as Record<string, Oklch>;
```

- [ ] **Step 2: Guard `renderLabelOnFill`**

Filter the `intents` list to present ramps before reading `set[fam]["500"]` (replace the `const pills = intents.map(...)` opening, around line 158):

```typescript
  const pills = intents.filter(([, fam]) => set[fam]).map(([label, fam]) => {
    const fill = set[fam]!["500"];
```

`set.accent` is always present, so the `ratio` line (`set.accent["500"]`) needs no change.

- [ ] **Step 3: Guard `renderBrand`**

Filter the brand `slots` to present accents before reading `state.accents[slot]` (replace the `const items = slots.map(...)` opening, around line 191):

```typescript
  const items = slots.filter(([, slot]) => state.accents[slot]).map(([label, slot]) => {
    const seed = state.accents[slot]!;
```

- [ ] **Step 4: Verify the color-studio build compiles**

Run: `cd tools/color-studio && npm run build`
Expected: build succeeds (exit 0), no TypeScript errors from the optional accent types in preview.ts.

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio/src/ui/preview.ts
git commit -m "feat(color-studio): preview tolerates 1-3 accents

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `theme-state` add/remove/count helpers

**Files:**
- Modify: `tools/color-studio/src/lib/theme-state.ts`
- Test: `tools/color-studio/src/lib/theme-state.test.ts`

**Interfaces:**
- Consumes: `ThemeInputs` (optional accent slots, Task 1).
- Produces:
  - `ACCENT_SLOTS = ["primary","secondary","tertiary"] as const`, `type AccentSlot`.
  - `presentAccentSlots(t): AccentSlot[]` — present slots in order.
  - `accentCount(t): number` — `presentAccentSlots(t).length`.
  - `addAccent(t): ThemeInputs` — appends `ACCENT_SLOTS[accentCount(t)]` with seed `{ hue: (primary.hue + 90*accentCount(t)) % 360, chroma: primary.chroma }`; no-op at 3.
  - `removeAccent(t): ThemeInputs` — drops the last present slot and its `brand` entry; no-op at 1.

- [ ] **Step 1: Write the failing test**

Append to `tools/color-studio/src/lib/theme-state.test.ts` (reuse its existing imports/fixtures; if it has a 3-accent baseline, derive from it). Self-contained block:

```typescript
import { accentCount, addAccent, removeAccent } from "./theme-state.js";
import type { ThemeInputs } from "@project/src/engine/index.js";

const THREE: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: 0.5,
  accents: {
    primary: { hue: 100, chroma: 0.12 },
    secondary: { hue: 220, chroma: 0.11 },
    tertiary: { hue: 330, chroma: 0.1 },
  },
  status: {
    success: { hue: 150, chroma: 0.12 }, error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 }, info: { hue: 240, chroma: 0.12 },
  },
  brand: { secondary: { l: 0.6, c: 0.11, h: 220 } },
};
const ONE: ThemeInputs = { ...THREE, accents: { primary: THREE.accents.primary }, brand: {} };

describe("accent add/remove", () => {
  it("accentCount reflects present slots", () => {
    expect(accentCount(ONE)).toBe(1);
    expect(accentCount(THREE)).toBe(3);
  });

  it("addAccent appends secondary with a hue-rotated seed", () => {
    const next = addAccent(ONE);
    expect(accentCount(next)).toBe(2);
    expect(next.accents.secondary).toEqual({ hue: (100 + 90) % 360, chroma: 0.12 });
  });

  it("addAccent appends tertiary (+180) as the third", () => {
    const next = addAccent(addAccent(ONE));
    expect(accentCount(next)).toBe(3);
    expect(next.accents.tertiary).toEqual({ hue: (100 + 180) % 360, chroma: 0.12 });
  });

  it("addAccent is a no-op at 3", () => {
    expect(addAccent(THREE)).toEqual(THREE);
  });

  it("removeAccent drops the last slot and its brand entry", () => {
    const next = removeAccent(THREE);
    expect(accentCount(next)).toBe(2);
    expect("tertiary" in next.accents).toBe(false);
    const next2 = removeAccent(next); // drops secondary + brand.secondary
    expect(accentCount(next2)).toBe(1);
    expect(next2.brand && "secondary" in next2.brand).toBe(false);
  });

  it("removeAccent is a no-op at 1", () => {
    expect(removeAccent(ONE)).toEqual(ONE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tools/color-studio/src/lib/theme-state.test.ts`
Expected: FAIL — `accentCount`/`addAccent`/`removeAccent` are not exported yet.

- [ ] **Step 3: Implement the helpers**

Append to `tools/color-studio/src/lib/theme-state.ts`:

```typescript
import type { HueSeed } from "@project/src/engine/index.js";

export const ACCENT_SLOTS = ["primary", "secondary", "tertiary"] as const;
export type AccentSlot = (typeof ACCENT_SLOTS)[number];

export function presentAccentSlots(t: ThemeInputs): AccentSlot[] {
  return ACCENT_SLOTS.filter((s) => t.accents[s]);
}

export function accentCount(t: ThemeInputs): number {
  return presentAccentSlots(t).length;
}

export function addAccent(t: ThemeInputs): ThemeInputs {
  const count = accentCount(t);
  if (count >= ACCENT_SLOTS.length) return t;
  const slot = ACCENT_SLOTS[count]; // count 1 → secondary, 2 → tertiary
  const seed: HueSeed = {
    hue: (t.accents.primary.hue + 90 * count) % 360,
    chroma: t.accents.primary.chroma,
  };
  return { ...t, accents: { ...t.accents, [slot]: seed } };
}

export function removeAccent(t: ThemeInputs): ThemeInputs {
  const present = presentAccentSlots(t);
  if (present.length <= 1) return t;
  const last = present[present.length - 1] as "secondary" | "tertiary";
  const { [last]: _dropped, ...accents } = t.accents;
  const next: ThemeInputs = { ...t, accents };
  if (t.brand && last in t.brand) {
    const { [last]: _b, ...brand } = t.brand;
    next.brand = brand;
  }
  return next;
}
```

(The top-of-file already imports `ThemeInputs`; add the `HueSeed` import alongside it rather than duplicating.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tools/color-studio/src/lib/theme-state.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio/src/lib/theme-state.ts tools/color-studio/src/lib/theme-state.test.ts
git commit -m "feat(color-studio): accentCount/addAccent/removeAccent helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: SeedControl remove affordance + Sidebar add/remove UI

**Files:**
- Modify: `tools/color-studio/src/components/SeedControl.tsx:7-14` (props) and `:45-56` (seed-head)
- Modify: `tools/color-studio/src/components/Sidebar.tsx:28` (drop fixed ACCENTS), `:9-13` (imports), `:107-130` (Accents section)

**Interfaces:**
- Consumes: `presentAccentSlots`, `accentCount`, `addAccent`, `removeAccent` from Task 5.
- Produces: an Accents section that renders one `SeedControl` per present slot, a remove (✕) control on the last present slot when count > 1, and an "Add accent" button when count < 3.

No unit test (no DOM env). Gate is the color-studio build + manual checklist in Task 7.

- [ ] **Step 1: Add an optional `onRemove` to `SeedControl`**

In `tools/color-studio/src/components/SeedControl.tsx`, extend the props interface (lines 7-14):

```typescript
interface SeedControlProps {
  name: string;
  seed: HueSeed;
  onSeed: (seed: HueSeed, source?: Oklch) => void;
  /** When provided, render a remove (✕) button in the seed header. */
  onRemove?: () => void;
}
```

Update the destructure on line 16:

```typescript
export function SeedControl({ name, seed, onSeed, onRemove }: SeedControlProps) {
```

In the `seed-head` block, add a remove button right after the hex `<input>` (before the closing `</div>` of `seed-head`, line 55-56):

```tsx
        {onRemove && (
          <button
            type="button"
            className="seed-remove"
            onClick={onRemove}
            aria-label={`Remove ${name} accent`}
            title={`Remove ${name} accent`}
          >
            ×
          </button>
        )}
```

- [ ] **Step 2: Rewrite the Sidebar Accents section**

In `tools/color-studio/src/components/Sidebar.tsx`, update the imports from `theme-state` (lines 9-13):

```typescript
import {
  isSectionModified,
  resetSection,
  presentAccentSlots,
  accentCount,
  addAccent,
  removeAccent,
  type SectionKey,
} from "../lib/theme-state.js";
```

Remove the fixed `const ACCENTS = [...]` (line 28); keep `STATUS`.

Replace the Accents `<Section>`'s children (the `{ACCENTS.map(...)}` block, lines 114-129) with:

```tsx
        {presentAccentSlots(state).map((key, i, all) => (
          <SeedControl
            key={key}
            name={key}
            seed={state.accents[key]!}
            onSeed={(seed: HueSeed, source?: Oklch) =>
              onChange({
                ...state,
                accents: { ...state.accents, [key]: seed },
                ...(source ? { brand: { ...state.brand, [key]: source } } : {}),
              })
            }
            onRemove={
              key !== "primary" && i === all.length - 1
                ? () => onChange(removeAccent(state))
                : undefined
            }
          />
        ))}
        {accentCount(state) < 3 && (
          <button
            type="button"
            className="btn btn--ghost add-accent"
            onClick={() => onChange(addAccent(state))}
          >
            + Add accent
          </button>
        )}
```

- [ ] **Step 3: Verify the color-studio build compiles**

Run: `cd tools/color-studio && npm run build`
Expected: build succeeds (exit 0), no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add tools/color-studio/src/components/SeedControl.tsx tools/color-studio/src/components/Sidebar.tsx
git commit -m "feat(color-studio): add/remove accents in the sidebar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all engine + theme-state tests green, including existing 3-accent suites.

- [ ] **Step 2: Build the studio**

Run: `cd tools/color-studio && npm run build`
Expected: exit 0, no type errors.

- [ ] **Step 3: Manual checklist (run `npm run preview:studio`)**

Confirm in the browser:
- Accents section starts at 3; "+ Add accent" is hidden at 3.
- Removing tertiary, then secondary: ramp specimens for the removed accent disappear; "+ Add accent" reappears; primary has no ✕ and cannot be removed (min 1).
- Adding an accent inserts a hue-rotated seed (visibly distinct from primary) and its ramp appears.
- The playground stays fully styled at every count (removed-accent specimens adopt the primary color).
- "Copy for Figma" with 1 accent produces a bundle whose `primitives-color.mode-1.tokens.json` has no `color-secondary-*`/`color-tertiary-*`/`color-brand-secondary`/`color-brand-tertiary`.

- [ ] **Step 4: Confirm working tree**

Run: `git status`
Expected: clean except the pre-existing `theme.config.ts` working-tree drift (not part of this feature).
