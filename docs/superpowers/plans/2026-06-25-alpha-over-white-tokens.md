# Alpha-over-white Color Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional engine feature that emits alphredo-style alpha twins of the 8 primitive color ramps — each solid step solved to the most-transparent color that composites over white to match it.

**Architecture:** A new pure function `alphaOverWhite` solves the alpha in sRGB-gamma space (where browsers/Figma composite) and returns OKLCH + alpha (the engine's native storage). `buildPrimitivesDtcg` emits `color-{ramp}-alpha-{step}` twins when `ThemeInputs.alpha` is true. Color Studio gets a toggle and a white-plate preview row. Off by default; no pipeline/transform changes.

**Tech Stack:** TypeScript, Style Dictionary v5, culori (color math), Vitest (tests), React + Base UI (Color Studio).

## Global Constraints

- Math is solved in **gamma sRGB**; tokens are stored in **OKLCH + alpha** (`colorSpace: "oklch"`). Copied verbatim from spec.
- Background is **white only** (`#fff`, sRGB `[1,1,1]`).
- Coverage is the **8 named ramps**: `neutral, accent, secondary, tertiary, success, error, warning, info`. Exclude `darkSurface` and `brand`.
- Token name pattern: `color-{ramp}-alpha-{step}` (mirrors existing `color-white-alpha-*`).
- Default **off**: when `inputs.alpha` is falsy, output is byte-identical to today. Existing `color-black/white-alpha-*` ladder is untouched (coexist).
- Color components rounded to 4 dp, hue to 2 dp (match existing `oklchToDtcg` in [src/engine/dtcg.ts](../../../src/engine/dtcg.ts)).
- Ramps are gamut-clamped to **p3**, so a solid may be outside sRGB. Gamut-map each solid into sRGB (`clampChroma(..., "rgb")`) before solving so channels stay in `[0,1]`.

---

### Task 1: `alphaOverWhite` engine function

**Files:**
- Create: `src/engine/alpha-over.ts`
- Create: `src/engine/alpha-over.test.ts`
- Modify: `src/engine/index.ts` (add re-export)

**Interfaces:**
- Consumes: `Oklch` from [src/engine/types.ts](../../../src/engine/types.ts) — `{ l: number; c: number; h: number; alpha?: number }`.
- Produces: `alphaOverWhite(solid: Oklch): Oklch` — returns an `Oklch` with `alpha` set (0..1). Consumed by Task 2 (dtcg emission) and Task 4 (preview).

- [ ] **Step 1: Write the failing test**

Create `src/engine/alpha-over.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rgb, clampChroma } from "culori";
import type { Oklch } from "./types.js";
import { alphaOverWhite } from "./alpha-over.js";

// Recompose a twin (color + alpha) over white in gamma sRGB: out = a·C + (1-a)·1.
function composeOverWhite(twin: Oklch): [number, number, number] {
  const a = twin.alpha ?? 1;
  const s = rgb({ mode: "oklch", l: twin.l, c: twin.c, h: twin.h })!;
  return [
    a * s.r + (1 - a),
    a * s.g + (1 - a),
    a * s.b + (1 - a),
  ];
}

// The sRGB the solid maps to (after gamut-mapping into sRGB), the target match.
function srgbOf(solid: Oklch): [number, number, number] {
  const g = clampChroma({ mode: "oklch", l: solid.l, c: solid.c, h: solid.h }, "oklch", "rgb");
  const s = rgb(g)!;
  return [s.r, s.g, s.b];
}

describe("alphaOverWhite", () => {
  it("composited over white matches the original solid (round-trip)", () => {
    const solid: Oklch = { l: 0.625, c: 0.168, h: 151 }; // a mid accent fill
    const twin = alphaOverWhite(solid);
    const got = composeOverWhite(twin);
    const want = srgbOf(solid);
    for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 6);
  });

  it("alpha equals 1 - min(sRGB channel)", () => {
    const solid: Oklch = { l: 0.5, c: 0.1, h: 250 };
    const [r, g, b] = srgbOf(solid);
    const twin = alphaOverWhite(solid);
    expect(twin.alpha).toBeCloseTo(1 - Math.min(r, g, b), 4);
  });

  it("pure white solid -> alpha 0 (fully transparent)", () => {
    const twin = alphaOverWhite({ l: 1, c: 0, h: 0 });
    expect(twin.alpha).toBe(0);
  });

  it("black solid -> alpha 1 (opaque)", () => {
    const twin = alphaOverWhite({ l: 0, c: 0, h: 0 });
    expect(twin.alpha).toBeCloseTo(1, 4);
  });

  it("alpha increases monotonically as the solid darkens", () => {
    const light = alphaOverWhite({ l: 0.95, c: 0.02, h: 151 });
    const mid = alphaOverWhite({ l: 0.6, c: 0.1, h: 151 });
    const dark = alphaOverWhite({ l: 0.25, c: 0.05, h: 151 });
    expect(light.alpha!).toBeLessThan(mid.alpha!);
    expect(mid.alpha!).toBeLessThan(dark.alpha!);
  });

  it("keeps a high-chroma p3 solid within valid sRGB bounds", () => {
    const twin = alphaOverWhite({ l: 0.55, c: 0.37, h: 145 }); // beyond sRGB gamut
    expect(twin.alpha!).toBeGreaterThanOrEqual(0);
    expect(twin.alpha!).toBeLessThanOrEqual(1);
    const got = composeOverWhite(twin);
    for (const ch of got) {
      expect(ch).toBeGreaterThanOrEqual(-1e-6);
      expect(ch).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/alpha-over.test.ts`
Expected: FAIL — `Failed to resolve import "./alpha-over.js"` / `alphaOverWhite is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/alpha-over.ts`:

```ts
import { rgb, oklch, clampChroma } from "culori";
import type { Oklch } from "./types.js";

const WHITE: Oklch = { l: 1, c: 0, h: 0 };

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Solve the "alphredo" problem against a white background: given an opaque
 * OKLCH color, return the most-transparent color that, composited over white
 * in gamma sRGB, renders identically to the input.
 *
 * The math runs in gamma sRGB because browsers and Figma composite alpha
 * there; the solid is gamut-mapped into sRGB first (ramps are p3-clamped, so a
 * raw conversion can fall outside [0,1]). The result is returned in OKLCH +
 * alpha to match the engine's native storage space.
 */
export function alphaOverWhite(solid: Oklch): Oklch {
  const inGamut = clampChroma(
    { mode: "oklch", l: solid.l, c: solid.c, h: solid.h },
    "oklch",
    "rgb",
  );
  const s = rgb(inGamut)!;
  const f = [clamp01(s.r), clamp01(s.g), clamp01(s.b)];
  const alpha = 1 - Math.min(f[0], f[1], f[2]);
  if (alpha <= 0) return { ...WHITE, alpha: 0 }; // pure white → invisible over white
  const c = f.map((x) => clamp01((x - (1 - alpha)) / alpha));
  const back = oklch({ mode: "rgb", r: c[0], g: c[1], b: c[2] })!;
  return {
    l: round(back.l),
    c: round(back.c ?? 0),
    h: round(back.h ?? solid.h, 2),
    alpha: round(alpha),
  };
}
```

- [ ] **Step 4: Add the re-export**

In `src/engine/index.ts`, add after the existing `export * from "./derived.js";` line:

```ts
export * from "./alpha-over.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/alpha-over.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/alpha-over.ts src/engine/alpha-over.test.ts src/engine/index.ts
git commit -m "feat(engine): add alphaOverWhite alphredo solver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `alpha?` input + gated token emission

**Files:**
- Modify: `src/engine/types.ts` (add `alpha?: boolean` to `ThemeInputs`)
- Modify: `src/engine/dtcg.ts` (gated emission in `buildPrimitivesDtcg`)
- Modify: `src/engine/dtcg.test.ts` (new tests)

**Interfaces:**
- Consumes: `alphaOverWhite` from Task 1; `rampNamePrefix` and `buildRamps` already in [src/engine/dtcg.ts](../../../src/engine/dtcg.ts).
- Produces: token keys `color-{ramp}-alpha-{step}` in the `primitives-color.mode-1.tokens.json` object when `inputs.alpha === true`. Each value is `{ $type: "color", $value: { colorSpace: "oklch", components: [...], alpha: number } }`.

- [ ] **Step 1: Add the `alpha?` field**

In `src/engine/types.ts`, inside the `ThemeInputs` interface, add after the `darkSurfaces?` field (before the closing brace):

```ts
  /**
   * When true, emit `color-{ramp}-alpha-{step}` twins for the 8 named ramps:
   * each solid step solved (alphredo-style) to the most-transparent color that
   * composites over white to match it. Omitted/false → no alpha twins (default).
   */
  alpha?: boolean;
```

- [ ] **Step 2: Write the failing test**

In `src/engine/dtcg.test.ts`, add a new `describe` block at the end of the file (the `INPUTS` fixture is already defined at module top):

```ts
import { buildRamps } from "./ramps.js"; // add to the existing imports at top

const ALPHA_TWIN = /^color-(neutral|accent|secondary|tertiary|success|error|warning|info)-alpha-/;

describe("alpha-over-white twins", () => {
  it("omitted alpha → no ramp alpha twins, output unchanged", () => {
    const out = buildPrimitivesDtcg(INPUTS);
    const twins = Object.keys(out).filter((k) => ALPHA_TWIN.test(k));
    expect(twins).toEqual([]);
  });

  it("alpha:true → one twin per solid step across the 8 ramps", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true });
    const set = buildRamps({ ...INPUTS, alpha: true });
    const ramps = ["neutral", "accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const;
    const expected = ramps.reduce((n, r) => n + Object.keys(set[r]).length, 0);
    const twins = Object.keys(out).filter((k) => ALPHA_TWIN.test(k));
    expect(twins.length).toBe(expected);
  });

  it("each twin carries an alpha field and oklch colorSpace", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true }) as Record<string, any>;
    const twin = out["color-accent-alpha-500"];
    expect(twin).toBeDefined();
    expect(twin.$value.colorSpace).toBe("oklch");
    expect(typeof twin.$value.alpha).toBe("number");
    expect(twin.$value.alpha).toBeGreaterThan(0);
    expect(twin.$value.alpha).toBeLessThanOrEqual(1);
  });

  it("does not add twins for darkSurface or brand", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true });
    expect(out).not.toHaveProperty("color-neutral-dark-surface-alpha-1");
    expect(out).not.toHaveProperty("color-brand-primary-alpha");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: FAIL — the `alpha:true` tests find 0 twins (`color-accent-alpha-500` undefined).

- [ ] **Step 4: Implement gated emission**

In `src/engine/dtcg.ts`, add the import near the top (with the other `./` imports):

```ts
import { alphaOverWhite } from "./alpha-over.js";
```

Then in `buildPrimitivesDtcg`, insert this block immediately before the final `return out;`:

```ts
  if (inputs.alpha) {
    for (const [key, prefix] of Object.entries(rampNamePrefix)) {
      const ramp = ramps[key as keyof typeof ramps];
      for (const [step, color] of Object.entries(ramp)) {
        out[`${prefix}-alpha-${step}`] = oklchToDtcg(alphaOverWhite(color));
      }
    }
  }
```

(`rampNamePrefix` already covers exactly the 8 named ramps — `darkSurface` and `brand` are not in it, so they are excluded automatically.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: PASS (existing tests + 4 new tests).

- [ ] **Step 6: Run the full engine test suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green, including `isomorphism`, `figma-export`, `emit-dtcg`.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/dtcg.ts src/engine/dtcg.test.ts
git commit -m "feat(engine): emit color-{ramp}-alpha-{step} twins when alpha enabled

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Color Studio toggle + persistence guard

**Files:**
- Modify: `tools/color-studio/src/components/Sidebar.tsx` (add Output toggle block)
- Modify: `tools/color-studio/src/serialize.test.ts` (guard that `alpha` persists)

**Interfaces:**
- Consumes: `state.alpha` (now valid on `ThemeInputs`); `onChange(next: ThemeInputs)` already passed to `Sidebar`. The `Toggle` component is already imported in `Sidebar.tsx`.
- Produces: a UI switch that flips `state.alpha`. No new props — flows through the existing `onChange` → save / Figma-copy paths.

- [ ] **Step 1: Write the persistence guard test**

In `tools/color-studio/src/serialize.test.ts`, add a test inside the existing `describe`:

```ts
it("persists the alpha flag when enabled", () => {
  const base = { neutral: { hue: 70, chroma: 0.006 }, contrast: "default",
    accents: { primary: { hue: 138, chroma: 0.12 }, secondary: { hue: 220, chroma: 0.11 }, tertiary: { hue: 330, chroma: 0.1 } },
    status: { success: { hue: 150, chroma: 0.12 }, error: { hue: 25, chroma: 0.17 }, warning: { hue: 70, chroma: 0.15 }, info: { hue: 240, chroma: 0.12 } },
    alpha: true } as const;
  const out = serializeConfig(base as any);
  expect(out).toContain('"alpha": true');
});
```

(If `serialize.test.ts` already builds an inputs object, reuse it and just add `alpha: true` plus the `toContain` assertion instead of duplicating the fixture.)

- [ ] **Step 2: Run the test — it passes immediately**

Run: `cd tools/color-studio && npx vitest run src/serialize.test.ts`
Expected: PASS. `serializeConfig` JSON-stringifies the whole object, so persistence already works — this test is a regression guard, not red-green. Confirm green, then continue.

- [ ] **Step 3: Add the Output toggle to the Sidebar**

In `tools/color-studio/src/components/Sidebar.tsx`, insert this block immediately before `<div className="foot">`:

```tsx
      <div className="sec sec--output">
        <div className="sec-head" style={{ cursor: "default" }}>
          <span className="sec-title">Output</span>
        </div>
        <label className="alpha-toggle">
          <Toggle
            pressed={!!state.alpha}
            onPressedChange={(p) => onChange({ ...state, alpha: p })}
            className="mode-toggle"
            aria-label="Toggle alpha-over-white tokens"
          />
          <span>
            Alpha-over-white tokens
            <small>Emit translucent twins of every ramp step, matched over white.</small>
          </span>
        </label>
      </div>
```

- [ ] **Step 4: Add minimal styling**

In `tools/color-studio/src/styles.css`, append:

```css
.sec--output { padding: 12px 0; }
.alpha-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.alpha-toggle small { display: block; opacity: 0.6; font-size: 11px; margin-top: 2px; }
```

- [ ] **Step 5: Verify in the running studio**

Run: `npm run preview:studio` (from repo root), open the served URL.
Expected behavior to confirm:
1. An "Output" section with an "Alpha-over-white tokens" switch appears above the footer.
2. Toggling it on, then clicking **Save theme**, writes `"alpha": true` into `theme.config.ts` (check the file).
3. Toggling it off and saving removes the `alpha` key (or sets it false) in `theme.config.ts`.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add tools/color-studio/src/components/Sidebar.tsx tools/color-studio/src/styles.css tools/color-studio/src/serialize.test.ts
git commit -m "feat(color-studio): add alpha-over-white output toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Color Studio preview row

**Files:**
- Modify: `tools/color-studio/src/ui/preview.ts` (add `renderAlphaRamps`, gate on `state.alpha`)
- Modify: `tools/color-studio/src/styles.css` (white plate for the alpha row)

**Interfaces:**
- Consumes: `alphaOverWhite` from the engine (Task 1, re-exported via `@project/src/engine/index.js`); `RampSet`, `Oklch`, the existing `css()` helper and `.ramp`/`.chip`/`.chip-fill` classes in [tools/color-studio/src/ui/preview.ts](../../../tools/color-studio/src/ui/preview.ts).
- Produces: a "Alpha over white" section rendered into `#pv-body` only when `state.alpha` is true.

- [ ] **Step 1: Add the import**

In `tools/color-studio/src/ui/preview.ts`, extend the existing engine import to include `alphaOverWhite`:

```ts
import {
  buildRamps, resolveSemantics, buildAlphas, buildDarkSurfaces, contrastRatio,
  alphaOverWhite,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";
```

- [ ] **Step 2: Add the `renderAlphaRamps` function**

In `tools/color-studio/src/ui/preview.ts`, add this function (e.g. just after `renderRamps`):

```ts
// The 8 named ramps that get alpha twins (excludes darkSurface).
const ALPHA_RAMPS: (keyof RampSet)[] = [
  "neutral", "accent", "secondary", "tertiary",
  "success", "error", "warning", "info",
];

// Alpha-over-white twins on a white plate, so "matches the solid" reads at a
// glance regardless of the preview's light/dark mode (these are solved vs white).
function renderAlphaRamps(set: RampSet): string {
  const rows = ALPHA_RAMPS.map((name) => {
    const ramp = set[name] as Record<string, Oklch>;
    const chips = Object.entries(ramp).map(([step, color]) => {
      const twin = alphaOverWhite(color);
      return `<div class="chip" title="${name}-alpha-${step} · α ${twin.alpha}">
        <span class="chip-fill" style="background:${css(twin)}">
          <span class="step" style="color:#111">${step}</span>
        </span>
      </div>`;
    }).join("");
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div></div>`;
  });
  return `<div class="pv-section pv-alpha"><div class="pv-section-title">Alpha over white <span class="pv-legend">each step solved to the most-transparent color that matches the solid over white</span></div>${rows.join("")}</div>`;
}
```

- [ ] **Step 3: Gate it into the render output**

In `renderPreview`, change the final `body.innerHTML = ...` assignment to append the alpha row when enabled:

```ts
  body.innerHTML =
    renderRamps(set, surface) + renderLabelOnFill(set) + renderDarkSurfaces(state) +
    renderBrand(state) + renderSample(vars) +
    (state.alpha ? renderAlphaRamps(set) : "");
```

- [ ] **Step 4: Add the white-plate styling**

In `tools/color-studio/src/styles.css`, append:

```css
.pv-alpha .ramp-chips { background: #fff; border-radius: 8px; padding: 4px; }
.pv-alpha .pv-section-title { color: inherit; }
```

- [ ] **Step 5: Verify in the running studio**

Run: `npm run preview:studio`, open the served URL.
Expected behavior to confirm:
1. With the Output toggle **off**, no "Alpha over white" section appears.
2. Toggling it **on** adds an "Alpha over white" section with one row per ramp, swatches sitting on a white plate.
3. Toggling the preview between light/dark surface leaves the alpha row on its white plate (it is always solved vs white).
4. The lightest steps (e.g. `50`) look nearly invisible (very low alpha); the darkest steps look near-opaque — the expected alphredo gradient.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add tools/color-studio/src/ui/preview.ts tools/color-studio/src/styles.css
git commit -m "feat(color-studio): preview alpha-over-white ramps on a white plate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verification (whole feature)

- [ ] `npm test` — all engine suites green.
- [ ] `cd tools/color-studio && npx vitest run` — studio unit tests green.
- [ ] Manual: enable the toggle, **Save theme**, then `npm run build:theme && npm run build:tokens` — confirm `dist/css/tokens.css` contains `--color-accent-alpha-500: oklch(... / <alpha>)` and that `npm run check:token-drift` reflects the regenerated tokens (commit regenerated token files if `alpha:true` is kept in `theme.config.ts`).
- [ ] With the toggle off and `theme.config.ts` lacking `alpha`, `npm run check:token-drift` is green (no drift) — confirming default output is unchanged.

## Notes / deliberate scope choices

- **No automated UI test for the toggle/preview.** The token math and emission are fully unit-tested (Tasks 1–2); the Studio is verified manually. An e2e (Playwright) test under `tools/color-studio/e2e/` is possible but out of scope for this footprint — flagged here so the omission is a conscious choice, not an oversight.
- **p3 → sRGB gamut-mapping** of vivid steps means a twin matches the *sRGB rendition* of that step over white. This is correct: alpha compositing is an sRGB operation, so there is no higher-fidelity target in that space. The solid token itself is unchanged.
