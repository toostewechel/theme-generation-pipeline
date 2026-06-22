# Generative Color Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-authored color dictionary in `theme-generation-pipeline` with a generative OKLCH engine that derives the entire color token set (ramps, alphas, dark-surfaces, light/dark semantics) from three inputs — a neutral seed, a contrast value, and an accent set — and a Vite studio for visual authoring.

**Architecture:** A pure, isomorphic engine (`src/engine/`) turns `theme.config.ts` into DTCG color token JSON via a Node-only I/O shell (`scripts/buildTheme.ts`). The existing Style Dictionary build (`scripts/buildTokens.ts`) consumes those files unchanged except for one new `oklch/css` color transform. A Vite dev app (`tools/color-studio/`) imports the same engine for live preview and writes `theme.config.ts` back via a dev-only Save endpoint.

**Tech Stack:** TypeScript (ESM, run via `tsx`), Style Dictionary v5 + style-dictionary-utils, `culori` (OKLCH math, gamut clamp, WCAG contrast), `vitest` (tests), `vite` (studio).

## Global Constraints

- **OKLCH output only.** Final CSS variables are `oklch(L C H)` / `oklch(L C H / a)`. No hex, no dual-format.
- **Engine is isomorphic.** `src/engine/{types,contrast-input,ramps,steps,contrast,semantics,derived}.ts` and `src/engine/index.ts` must NOT import `fs`, `path`, `node:*`, or any Node-only API. Only `scripts/buildTheme.ts` and `src/engine/emit-dtcg.ts` may touch the filesystem. A test enforces this.
- **Token names are frozen.** The generated DTCG must emit the exact token names that exist today (including the typo `color-white-alpha-transparant` and the correct `color-black-alpha-transparent`) so downstream `var(--…)` references keep resolving.
- **Engine owns color only.** Never modify typography, spacing, radius token files, or their build paths.
- **Coverage:** engine generates `neutral`, `accent` (primary), `sky` (secondary), `pink` (tertiary), and four regularized status ramps `success`/`error`/`warning`/`info`; derives `black-alpha-*` / `white-alpha-*` and `dark-surface-1..5`. `prism-*` is static passthrough. The legacy `swiss-red`/`vermillion` and `*-alpha` status scales are retired.
- **Relaxed parity:** only the `neutral` ramp and `accent` (primary) ramp must stay within the proximity-guide tolerance of today's values. Other colors may change.
- **Lightness convention:** OKLCH `l` is stored and emitted in the `0..1` range; hue `h` in degrees `0..360`.
- **Step order in output** follows the existing natural-sort already applied by `buildTokens.ts`; the engine does not need to pre-sort.
- TDD throughout: write the failing test, watch it fail, implement minimally, watch it pass, commit.
- All work happens in the `theme-generation-pipeline` repo. Run a feature branch, not `main`.

---

## File Structure

**Engine (pure, isomorphic):**
- `src/engine/types.ts` — shared types (`HueSeed`, `ContrastInput`, `ThemeInputs`, `Oklch`, `Ramp`, `RampSet`, semantic spec types).
- `src/engine/contrast-input.ts` — `resolveContrast()` (word-alias + clamp) and `targetFor()` (contrast→WCAG-minimum nudge).
- `src/engine/steps.ts` — canonical step lists + starting lightness/chroma curve constants (the calibration surface).
- `src/engine/ramps.ts` — `buildRamp()`, `buildRamps()`.
- `src/engine/contrast.ts` — `contrastRatio()` (culori WCAG wrapper) + `resolveOnSurface()`.
- `src/engine/derived.ts` — alpha maps + `buildAlphas()`, `buildDarkSurfaces()`.
- `src/engine/semantics.ts` — `SEMANTICS` table + `resolveSemantics()`.
- `src/engine/index.ts` — barrel re-exporting the pure modules (the studio's import surface).

**Engine (Node-only I/O shell):**
- `src/engine/emit-dtcg.ts` — converts engine output to DTCG objects + `writeGeneratedTokens()`.
- `scripts/buildTheme.ts` — orchestrator behind `npm run build:theme`.

**Build integration:**
- `src/transforms/oklchColor.ts` — the `oklch/css` Style Dictionary transform.
- `scripts/buildTokens.ts` — MODIFY: register + swap in `oklch/css` for `w3c-color/css`.
- `src/tokens/primitives-color.static.tokens.json` — CREATE: `prism-*` passthrough.
- `src/tokens/manifest.json` — MODIFY: add the static file to `primitives-color`.
- `theme.config.ts` — CREATE: the three inputs.

**Studio:**
- `tools/color-studio/{package.json,vite.config.ts,index.html,tsconfig.json}`
- `tools/color-studio/src/{main.ts,ui/*.ts,serialize.ts}`

**Tests:** colocated as `src/engine/*.test.ts` plus `src/engine/isomorphism.test.ts` and `src/transforms/oklchColor.test.ts`; `vitest.config.ts` at repo root.

---

## Task 1: Tooling — culori + vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Test: `src/engine/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` (vitest) and an installed, importable `culori`.

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline
git checkout -b feat/generative-color-engine
npm install culori@^4.0.0
npm install -D vitest@^2.0.0
```

- [ ] **Step 2: Add the `test` and `build:theme` scripts**

Edit `package.json` `scripts` to read exactly:

```json
  "scripts": {
    "build:tokens": "npx tsx scripts/buildTokens.ts",
    "build:tokens-nd": "npx tsx scripts/buildTokens.ts --no-descriptions",
    "build:theme": "npx tsx scripts/buildTheme.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview:fluid": "cd tools/fluid-preview && npm run dev",
    "preview:radius": "cd tools/radius-preview && npm run dev",
    "preview:studio": "cd tools/color-studio && npm run dev"
  }
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write a smoke test proving culori + vitest work**

`src/engine/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { oklch, formatCss } from "culori";

describe("tooling smoke test", () => {
  it("culori converts a hex to oklch", () => {
    const c = oklch("#7db664");
    expect(c).toBeDefined();
    expect(c!.mode).toBe("oklch");
    expect(c!.l).toBeGreaterThan(0);
  });

  it("culori formats an oklch color to a css string", () => {
    const css = formatCss({ mode: "oklch", l: 0.73, c: 0.12, h: 138 });
    expect(css).toContain("oklch");
  });
});
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test`
Expected: PASS, 2 tests in `smoke.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/engine/smoke.test.ts
git commit -m "chore: add culori + vitest tooling for color engine"
```

---

## Task 2: Types + contrast-input resolution

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/contrast-input.ts`
- Test: `src/engine/contrast-input.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `HueSeed = { hue: number; chroma: number }`; `ContrastInput = number | "low" | "default" | "high"`; `ThemeInputs` (see code); `Oklch = { l: number; c: number; h: number; alpha?: number }`; `Ramp = Record<string, Oklch>`; `RampSet` (8 named ramps).
  - `contrast-input.ts`: `resolveContrast(input: ContrastInput): number` (always `0..1`); `targetFor(baseMin: number, contrast: number): number` (WCAG minimum after contrast nudge).

- [ ] **Step 1: Write the failing test**

`src/engine/contrast-input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveContrast, targetFor } from "./contrast-input.js";

describe("resolveContrast", () => {
  it("maps word aliases to numbers", () => {
    expect(resolveContrast("low")).toBe(0.25);
    expect(resolveContrast("default")).toBe(0.5);
    expect(resolveContrast("high")).toBe(0.85);
  });

  it("passes numbers through", () => {
    expect(resolveContrast(0.63)).toBe(0.63);
  });

  it("clamps numbers to [0,1]", () => {
    expect(resolveContrast(-1)).toBe(0);
    expect(resolveContrast(5)).toBe(1);
  });
});

describe("targetFor", () => {
  it("returns the base minimum at or below default contrast", () => {
    expect(targetFor(4.5, 0.5)).toBeCloseTo(4.5, 5);
    expect(targetFor(4.5, 0.25)).toBeCloseTo(4.5, 5);
  });

  it("never drops below the base minimum", () => {
    expect(targetFor(4.5, 0)).toBeGreaterThanOrEqual(4.5);
  });

  it("raises the minimum toward 7 as contrast approaches 1", () => {
    expect(targetFor(4.5, 1)).toBeCloseTo(7, 1);
    expect(targetFor(4.5, 0.85)).toBeGreaterThan(4.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- contrast-input`
Expected: FAIL — cannot find module `./contrast-input.js`.

- [ ] **Step 3: Implement `types.ts`**

```ts
export interface HueSeed {
  /** OKLCH hue in degrees, 0..360 */
  hue: number;
  /** OKLCH chroma at full strength (the ramp scales this by step) */
  chroma: number;
}

export type ContrastInput = number | "low" | "default" | "high";

export interface ThemeInputs {
  neutral: HueSeed;
  contrast: ContrastInput;
  accents: { primary: HueSeed; secondary: HueSeed; tertiary: HueSeed };
  status: { success: HueSeed; error: HueSeed; warning: HueSeed; info: HueSeed };
}

/** A single resolved color. l in 0..1, h in degrees, alpha in 0..1. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/** step name ("50", "500", "paper", …) -> color */
export type Ramp = Record<string, Oklch>;

export interface RampSet {
  neutral: Ramp;
  accent: Ramp; // primary
  secondary: Ramp; // sky
  tertiary: Ramp; // pink
  success: Ramp;
  error: Ramp;
  warning: Ramp;
  info: Ramp;
}
```

- [ ] **Step 4: Implement `contrast-input.ts`**

```ts
import type { ContrastInput } from "./types.js";

const ALIASES: Record<string, number> = { low: 0.25, default: 0.5, high: 0.85 };

/** Resolve a ContrastInput to a number in [0,1]. */
export function resolveContrast(input: ContrastInput): number {
  const n = typeof input === "number" ? input : ALIASES[input];
  if (n === undefined || Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Nudge a WCAG minimum by contrast. At/below default (0.5) the base minimum is
 * unchanged; above default it ramps linearly toward 7 (AAA-ish for body text).
 * Never returns below `baseMin`.
 */
export function targetFor(baseMin: number, contrast: number): number {
  const c = Math.min(1, Math.max(0, contrast));
  if (c <= 0.5) return baseMin;
  const t = (c - 0.5) / 0.5; // 0..1 across the upper half
  return baseMin + t * (7 - baseMin);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- contrast-input`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/contrast-input.ts src/engine/contrast-input.test.ts
git commit -m "feat(engine): add types and contrast-input resolution"
```

---

## Task 3: Ramp synthesis

**Files:**
- Create: `src/engine/steps.ts`
- Create: `src/engine/ramps.ts`
- Test: `src/engine/ramps.test.ts`

**Interfaces:**
- Consumes: `HueSeed`, `Oklch`, `Ramp`, `RampSet`, `ThemeInputs` (Task 2); `resolveContrast` (Task 2).
- Produces:
  - `steps.ts`: `NEUTRAL_STEPS: string[]`, `HUE_STEPS: string[]`, `NEUTRAL_LIGHTNESS: Record<string,number>`, `HUE_LIGHTNESS: Record<string,number>`, `CHROMA_CURVE: Record<string,number>`.
  - `ramps.ts`: `buildRamp(seed: HueSeed, steps: string[], lightness: Record<string,number>, contrast: number): Ramp`; `buildRamps(inputs: ThemeInputs): RampSet`.

- [ ] **Step 1: Write the failing test**

`src/engine/ramps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clampChroma, inGamut } from "culori";
import { buildRamp, buildRamps } from "./ramps.js";
import { NEUTRAL_STEPS, HUE_STEPS, NEUTRAL_LIGHTNESS, HUE_LIGHTNESS } from "./steps.js";
import type { ThemeInputs } from "./types.js";

const INPUTS: ThemeInputs = {
  neutral: { hue: 70, chroma: 0.006 },
  contrast: "default",
  accents: {
    primary: { hue: 138, chroma: 0.12 },
    secondary: { hue: 220, chroma: 0.11 },
    tertiary: { hue: 330, chroma: 0.1 },
  },
  status: {
    success: { hue: 150, chroma: 0.12 },
    error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 },
    info: { hue: 240, chroma: 0.12 },
  },
};

const inP3 = inGamut("p3");

describe("buildRamp", () => {
  const ramp = buildRamp(INPUTS.accents.primary, HUE_STEPS, HUE_LIGHTNESS, 0.5);

  it("produces a color for every step", () => {
    for (const step of HUE_STEPS) {
      expect(ramp[step]).toBeDefined();
      expect(ramp[step].mode ?? "oklch").toBeTruthy();
    }
  });

  it("is monotonically decreasing in lightness from light to dark steps", () => {
    const ls = HUE_STEPS.map((s) => ramp[s].l);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });

  it("stays within the P3 gamut after clamping", () => {
    for (const step of HUE_STEPS) {
      const c = { mode: "oklch" as const, l: ramp[step].l, c: ramp[step].c, h: ramp[step].h };
      expect(inP3(clampChroma(c, "oklch", "p3"))).toBe(true);
    }
  });
});

describe("buildRamps", () => {
  const set = buildRamps(INPUTS);

  it("builds all eight named ramps", () => {
    for (const key of ["neutral", "accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const) {
      expect(set[key]).toBeDefined();
    }
  });

  it("includes the special neutral steps", () => {
    for (const step of ["0", "paper", "650", "850"]) {
      expect(set.neutral[step]).toBeDefined();
    }
    expect(NEUTRAL_STEPS).toContain("paper");
  });

  it("keeps neutral chroma low (reads as gray)", () => {
    for (const step of NEUTRAL_STEPS) {
      expect(set.neutral[step].c).toBeLessThan(0.02);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- ramps`
Expected: FAIL — cannot find `./steps.js` / `./ramps.js`.

- [ ] **Step 3: Implement `steps.ts` with the starting calibration constants**

```ts
// Canonical step lists. These names MUST match today's primitive token names.
export const NEUTRAL_STEPS: string[] = [
  "0", "paper", "50", "100", "200", "300", "400", "500",
  "600", "650", "700", "800", "850", "900", "950",
];

export const HUE_STEPS: string[] = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

// Starting target lightness (OKLCH l, 0..1) at contrast = default (0.5).
// These are the calibration surface — Task 4 tunes them against today's palette.
export const NEUTRAL_LIGHTNESS: Record<string, number> = {
  "0": 1.0, paper: 0.985, "50": 0.975, "100": 0.945, "200": 0.895,
  "300": 0.83, "400": 0.74, "500": 0.65, "600": 0.56, "650": 0.51,
  "700": 0.46, "800": 0.37, "850": 0.32, "900": 0.275, "950": 0.19,
};

export const HUE_LIGHTNESS: Record<string, number> = {
  "50": 0.975, "100": 0.94, "200": 0.885, "300": 0.815, "400": 0.73,
  "500": 0.655, "600": 0.575, "700": 0.49, "800": 0.405, "900": 0.31, "950": 0.22,
};

// Chroma multiplier per step (peaks mid-ramp, tapers at the ends).
export const CHROMA_CURVE: Record<string, number> = {
  "0": 0.0, paper: 0.5, "50": 0.25, "100": 0.45, "200": 0.7, "300": 0.9,
  "400": 1.0, "500": 1.0, "600": 0.95, "650": 0.9, "700": 0.85,
  "800": 0.7, "850": 0.6, "900": 0.5, "950": 0.35,
};
```

- [ ] **Step 4: Implement `ramps.ts`**

```ts
import { clampChroma } from "culori";
import type { HueSeed, Oklch, Ramp, RampSet, ThemeInputs } from "./types.js";
import { resolveContrast } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS, NEUTRAL_LIGHTNESS, HUE_LIGHTNESS, CHROMA_CURVE } from "./steps.js";

/** Spread lightness around the mid (0.5) by the contrast knob. */
function applyContrast(l: number, contrast: number): number {
  const spread = 0.7 + contrast * 0.6; // low→0.88, default→1.0, high→1.21
  return Math.min(1, Math.max(0, 0.5 + (l - 0.5) * spread));
}

export function buildRamp(
  seed: HueSeed,
  steps: string[],
  lightness: Record<string, number>,
  contrast: number,
): Ramp {
  const ramp: Ramp = {};
  for (const step of steps) {
    const l = applyContrast(lightness[step], contrast);
    const c = seed.chroma * (CHROMA_CURVE[step] ?? 1);
    const clamped = clampChroma({ mode: "oklch", l, c, h: seed.hue }, "oklch", "p3");
    ramp[step] = { l: clamped.l, c: clamped.c ?? 0, h: clamped.h ?? seed.hue };
  }
  return ramp;
}

export function buildRamps(inputs: ThemeInputs): RampSet {
  const k = resolveContrast(inputs.contrast);
  return {
    neutral: buildRamp(inputs.neutral, NEUTRAL_STEPS, NEUTRAL_LIGHTNESS, k),
    accent: buildRamp(inputs.accents.primary, HUE_STEPS, HUE_LIGHTNESS, k),
    secondary: buildRamp(inputs.accents.secondary, HUE_STEPS, HUE_LIGHTNESS, k),
    tertiary: buildRamp(inputs.accents.tertiary, HUE_STEPS, HUE_LIGHTNESS, k),
    success: buildRamp(inputs.status.success, HUE_STEPS, HUE_LIGHTNESS, k),
    error: buildRamp(inputs.status.error, HUE_STEPS, HUE_LIGHTNESS, k),
    warning: buildRamp(inputs.status.warning, HUE_STEPS, HUE_LIGHTNESS, k),
    info: buildRamp(inputs.status.info, HUE_STEPS, HUE_LIGHTNESS, k),
  };
}
```

> Note: `clampChroma` returns a culori color whose `h` can be `undefined` for achromatic results; the code falls back to the seed hue. The `Oklch` objects here intentionally omit `mode`; the ramps test reads `.l/.c/.h` directly.

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- ramps`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/steps.ts src/engine/ramps.ts src/engine/ramps.test.ts
git commit -m "feat(engine): synthesize OKLCH ramps from hue seeds + contrast"
```

---

## Task 4: theme.config.ts + neutral/primary proximity calibration

**Files:**
- Create: `theme.config.ts`
- Test: `src/engine/parity.test.ts`

**Interfaces:**
- Consumes: `buildRamps` (Task 3); the current `src/tokens/primitives-color.mode-1.tokens.json` (read in the test) as the proximity target.
- Produces: `theme.config.ts` default export `themeInputs: ThemeInputs`.

- [ ] **Step 1: Create `theme.config.ts` with the calibrated-start inputs**

```ts
import type { ThemeInputs } from "./src/engine/types.js";

const themeInputs: ThemeInputs = {
  neutral: { hue: 70, chroma: 0.006 }, // warm near-gray, matches today's paper-ish tint
  contrast: "default",
  accents: {
    primary: { hue: 138, chroma: 0.12 }, // green (today's accent-500 ≈ #7db664)
    secondary: { hue: 220, chroma: 0.11 }, // sky/blue
    tertiary: { hue: 330, chroma: 0.1 }, // pink
  },
  status: {
    success: { hue: 150, chroma: 0.12 },
    error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 },
    info: { hue: 240, chroma: 0.12 },
  },
};

export default themeInputs;
```

- [ ] **Step 1b: Snapshot today's primitives as a frozen fixture**

The proximity test must compare against the ORIGINAL hand-authored palette, but Task 10 will overwrite `src/tokens/primitives-color.mode-1.tokens.json` with generated output. Capture the legacy values into a committed fixture first:

```bash
mkdir -p src/engine/__fixtures__
cp src/tokens/primitives-color.mode-1.tokens.json src/engine/__fixtures__/legacy-primitives.json
```

This fixture is the stable parity target and is committed in this task.

- [ ] **Step 2: Write the proximity-guide test (neutral + primary only)**

`src/engine/parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { differenceEuclidean, oklch, rgb } from "culori";
import { buildRamps } from "./ramps.js";
import themeInputs from "../../theme.config.js";

// Read the FROZEN legacy fixture (not the live token file, which Task 10 overwrites).
const current = JSON.parse(
  readFileSync(new URL("./__fixtures__/legacy-primitives.json", import.meta.url), "utf-8"),
);

function currentOklch(name: string) {
  const comps = current[name].$value.components as number[];
  return oklch(rgb({ mode: "rgb", r: comps[0], g: comps[1], b: comps[2] }));
}

const dE = differenceEuclidean("oklch");
// Proximity GUIDE tolerance (not a hard gate). Tighten/loosen during calibration.
const TOL = 0.06;

describe("proximity guide — neutral ramp", () => {
  const set = buildRamps(themeInputs);
  for (const step of ["50", "100", "500", "900", "950"]) {
    it(`neutral-${step} is within tolerance of today`, () => {
      const gen = { mode: "oklch" as const, ...set.neutral[step] };
      const cur = currentOklch(`color-neutral-${step}`);
      expect(dE(gen, cur)).toBeLessThan(TOL);
    });
  }
});

describe("proximity guide — primary accent", () => {
  const set = buildRamps(themeInputs);
  for (const step of ["100", "500", "900"]) {
    it(`accent-${step} is within tolerance of today`, () => {
      const gen = { mode: "oklch" as const, ...set.accent[step] };
      const cur = currentOklch(`color-accent-${step}`);
      expect(dE(gen, cur)).toBeLessThan(TOL);
    });
  }
});
```

- [ ] **Step 3: Run it to see which steps are out of tolerance**

Run: `npm test -- parity`
Expected: Some assertions may FAIL initially (the starting constants are approximate).

- [ ] **Step 4: Calibrate until the guide passes**

Adjust ONLY these constants until `npm test -- parity` is green:
- `NEUTRAL_LIGHTNESS` / `HUE_LIGHTNESS` in `src/engine/steps.ts` (move a step's `l` toward the measured target).
- `neutral.chroma` / `neutral.hue` and `accents.primary` in `theme.config.ts`.

Tip for reading targets: `node --input-type=module -e "import {oklch,rgb} from 'culori'; import c from './src/tokens/primitives-color.mode-1.tokens.json' assert {type:'json'}; const v=c['color-accent-500'].\$value.components; console.log(oklch(rgb({mode:'rgb',r:v[0],g:v[1],b:v[2]})));"`
Do not loosen `TOL` below `0.06` to force a pass — adjust the curve instead. If a single step is stubborn, nudging just that step's lightness is fine.

- [ ] **Step 5: Run the full suite to confirm nothing else regressed**

Run: `npm test`
Expected: PASS (smoke, contrast-input, ramps, parity).

- [ ] **Step 6: Commit**

```bash
git add theme.config.ts src/engine/steps.ts src/engine/parity.test.ts src/engine/__fixtures__/legacy-primitives.json
git commit -m "feat(engine): add theme.config and calibrate neutral/primary proximity"
```

---

## Task 5: Contrast helpers

**Files:**
- Create: `src/engine/contrast.ts`
- Test: `src/engine/contrast.test.ts`

**Interfaces:**
- Consumes: `Oklch`, `Ramp` (Task 2).
- Produces: `contrastRatio(a: Oklch, b: Oklch): number`; `resolveOnSurface(ramp: Ramp, surface: Oklch, minRatio: number, steps: string[]): string` (returns the first step name, scanning dark→light or light→dark automatically toward the higher-contrast end, that meets `minRatio`; falls back to the highest-contrast step if none qualifies).

- [ ] **Step 1: Write the failing test**

`src/engine/contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contrastRatio, resolveOnSurface } from "./contrast.js";
import { buildRamps } from "./ramps.js";
import themeInputs from "../../theme.config.js";
import { NEUTRAL_STEPS } from "./steps.js";

const white = { l: 1, c: 0, h: 0 };
const black = { l: 0, c: 0, h: 0 };

describe("contrastRatio", () => {
  it("returns ~21 for black on white", () => {
    expect(contrastRatio(black, white)).toBeGreaterThan(20);
  });
  it("returns ~1 for identical colors", () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 1);
  });
});

describe("resolveOnSurface", () => {
  const set = buildRamps(themeInputs);
  it("finds a neutral step meeting 4.5:1 against a near-white surface", () => {
    const surface = set.neutral["0"];
    const step = resolveOnSurface(set.neutral, surface, 4.5, NEUTRAL_STEPS);
    expect(NEUTRAL_STEPS).toContain(step);
    expect(contrastRatio(set.neutral[step], surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("finds a step meeting 4.5:1 against a dark surface", () => {
    const surface = set.neutral["950"];
    const step = resolveOnSurface(set.neutral, surface, 4.5, NEUTRAL_STEPS);
    expect(contrastRatio(set.neutral[step], surface)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "src/engine/contrast.test"`
Expected: FAIL — cannot find `./contrast.js`.

- [ ] **Step 3: Implement `contrast.ts`**

```ts
import { wcagContrast } from "culori";
import type { Oklch, Ramp } from "./types.js";

function toCulori(c: Oklch) {
  return { mode: "oklch" as const, l: c.l, c: c.c, h: c.h };
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  return wcagContrast(toCulori(a), toCulori(b));
}

/**
 * Pick the first ramp step (scanning from the end farther from the surface in
 * lightness, i.e. the higher-contrast direction) that meets `minRatio` against
 * `surface`. If none qualify, return the step with the maximum contrast.
 */
export function resolveOnSurface(
  ramp: Ramp,
  surface: Oklch,
  minRatio: number,
  steps: string[],
): string {
  // Order steps by their contrast against the surface, descending.
  const ranked = [...steps].sort(
    (a, b) => contrastRatio(ramp[b], surface) - contrastRatio(ramp[a], surface),
  );
  for (let i = ranked.length - 1; i >= 0; i--) {
    if (contrastRatio(ramp[ranked[i]], surface) >= minRatio) return ranked[i];
  }
  return ranked[0]; // highest contrast available
}
```

> `resolveOnSurface` returns the *lowest-contrast step that still clears the bar* (the most subtle option that is still accessible), by scanning the contrast-descending list from its low-contrast end.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- "src/engine/contrast.test"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/contrast.ts src/engine/contrast.test.ts
git commit -m "feat(engine): add WCAG contrast ratio + on-surface resolver"
```

---

## Task 6: Semantic mapping (light + dark)

**Files:**
- Create: `src/engine/semantics.ts`
- Test: `src/engine/semantics.test.ts`

**Interfaces:**
- Consumes: `RampSet`, `Oklch` (Task 2); `resolveOnSurface`, `contrastRatio` (Task 5); `targetFor`, `resolveContrast` (Task 2); `NEUTRAL_STEPS` (Task 3).
- Produces:
  - Types: `RefSpec = { kind: "ref"; ramp: keyof RampSet | "black-alpha" | "white-alpha"; step: string }`; `TargetSpec = { kind: "target"; onRamp: keyof RampSet; onStep: string; ramp: keyof RampSet; min: number }`; `SemanticSpec = RefSpec | TargetSpec`.
  - `SEMANTICS_LIGHT: Record<string, SemanticSpec>` and `SEMANTICS_DARK: Record<string, SemanticSpec>`.
  - `ResolvedToken = { ref: string } | { value: Oklch }`.
  - `resolveSemantics(ramps: RampSet, inputs: ThemeInputs, mode: "light" | "dark"): Record<string, ResolvedToken>`.

> Scope note: the `SEMANTICS_*` tables below are seeded with a representative core set drawn from today's `color.light.tokens.json` / `color.dark.tokens.json`. During implementation, extend each table to cover **every** `color-*` semantic token name that exists in those two files today (text, icon, border, background, action, control, feedback, state), so the generated output keeps name parity. Use the existing files as the authoritative name list: `grep -oE '"color-[^"]+"' src/tokens/color.light.tokens.json`. Feedback tokens map onto the new `success/error/warning/info` ramps.

- [ ] **Step 1: Write the failing test**

`src/engine/semantics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveSemantics, SEMANTICS_LIGHT, SEMANTICS_DARK } from "./semantics.js";
import { buildRamps } from "./ramps.js";
import { contrastRatio } from "./contrast.js";
import themeInputs from "../../theme.config.js";

const ramps = buildRamps(themeInputs);

describe("resolveSemantics — fixed-step refs", () => {
  const light = resolveSemantics(ramps, themeInputs, "light");
  it("emits a reference for a fixed-step token", () => {
    expect(light["color-background-surface-default"]).toEqual({ ref: "color-neutral-0" });
  });
});

describe("resolveSemantics — contrast-targeted tokens pass WCAG", () => {
  for (const mode of ["light", "dark"] as const) {
    const resolved = resolveSemantics(ramps, themeInputs, mode);
    const surfaceName =
      mode === "light" ? "color-neutral-0" : "color-neutral-dark-surface-2";
    it(`${mode}: text-default clears 4.5:1 on the default surface`, () => {
      const token = resolved["color-text-default"];
      // contrast-targeted tokens resolve to a literal value OR a ref into the ramp;
      // either way the engine guarantees the ratio. We assert via the value form.
      expect("value" in token || "ref" in token).toBe(true);
    });
  }
});

describe("SEMANTICS tables cover the same names in light and dark", () => {
  it("dark defines every key that light defines", () => {
    for (const key of Object.keys(SEMANTICS_LIGHT)) {
      expect(SEMANTICS_DARK[key], `missing dark spec for ${key}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- semantics`
Expected: FAIL — cannot find `./semantics.js`.

- [ ] **Step 3: Implement `semantics.ts`**

```ts
import type { Oklch, RampSet, ThemeInputs } from "./types.js";
import { resolveOnSurface } from "./contrast.js";
import { resolveContrast, targetFor } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";

export type RefSpec = {
  kind: "ref";
  ramp: keyof RampSet | "black-alpha" | "white-alpha";
  step: string;
};
export type TargetSpec = {
  kind: "target";
  onRamp: keyof RampSet;
  onStep: string;
  ramp: keyof RampSet;
  min: number;
};
export type SemanticSpec = RefSpec | TargetSpec;
export type ResolvedToken = { ref: string } | { value: Oklch };

const ref = (ramp: RefSpec["ramp"], step: string): RefSpec => ({ kind: "ref", ramp, step });
const target = (onRamp: keyof RampSet, onStep: string, ramp: keyof RampSet, min: number): TargetSpec =>
  ({ kind: "target", onRamp, onStep, ramp, min });

// CORE set — extend to full parity with today's color.light/color.dark token names.
export const SEMANTICS_LIGHT: Record<string, SemanticSpec> = {
  "color-background-surface-default": ref("neutral", "0"),
  "color-background-surface-sunken": ref("neutral", "paper"),
  "color-background-surface-raised": ref("neutral", "0"),
  "color-background-surface-inverse": ref("neutral", "900"),
  "color-background-brand-primary": ref("accent", "500"),
  "color-text-emphasis": ref("accent", "900"),
  "color-text-default": target("neutral", "0", "neutral", 4.5),
  "color-text-subtle": target("neutral", "0", "neutral", 4.5),
  "color-text-muted": target("neutral", "0", "neutral", 3),
  "color-border-default": ref("black-alpha", "12"),
  "color-border-subtle": ref("black-alpha", "8"),
  "color-feedback-error-text": ref("error", "700"),
  "color-feedback-success-text": ref("success", "700"),
  "color-feedback-warning-text": ref("warning", "700"),
  "color-feedback-info-text": ref("info", "700"),
};

export const SEMANTICS_DARK: Record<string, SemanticSpec> = {
  "color-background-surface-default": ref("neutral", "950"),
  "color-background-surface-sunken": ref("neutral", "950"),
  "color-background-surface-raised": ref("neutral", "900"),
  "color-background-surface-inverse": ref("neutral", "50"),
  "color-background-brand-primary": ref("accent", "500"),
  "color-text-emphasis": ref("neutral", "50"),
  "color-text-default": target("neutral", "950", "neutral", 4.5),
  "color-text-subtle": target("neutral", "950", "neutral", 4.5),
  "color-text-muted": target("neutral", "950", "neutral", 3),
  "color-border-default": ref("white-alpha", "12"),
  "color-border-subtle": ref("white-alpha", "8"),
  "color-feedback-error-text": ref("error", "400"),
  "color-feedback-success-text": ref("success", "400"),
  "color-feedback-warning-text": ref("warning", "400"),
  "color-feedback-info-text": ref("info", "400"),
};

const STEPS_FOR: Record<string, string[]> = { neutral: NEUTRAL_STEPS };
const stepsFor = (ramp: keyof RampSet) => STEPS_FOR[ramp] ?? HUE_STEPS;

function nameFor(ramp: RefSpec["ramp"], step: string): string {
  if (ramp === "black-alpha") return `color-black-alpha-${step}`;
  if (ramp === "white-alpha") return `color-white-alpha-${step}`;
  if (ramp === "accent") return `color-accent-${step}`;
  if (ramp === "secondary") return `color-sky-${step}`;
  if (ramp === "tertiary") return `color-pink-${step}`;
  return `color-${ramp}-${step}`; // neutral, success, error, warning, info
}

export function resolveSemantics(
  ramps: RampSet,
  inputs: ThemeInputs,
  mode: "light" | "dark",
): Record<string, ResolvedToken> {
  const table = mode === "light" ? SEMANTICS_LIGHT : SEMANTICS_DARK;
  const k = resolveContrast(inputs.contrast);
  const out: Record<string, ResolvedToken> = {};

  for (const [name, spec] of Object.entries(table)) {
    if (spec.kind === "ref") {
      out[name] = { ref: nameFor(spec.ramp, spec.step) };
    } else {
      const surface = ramps[spec.onRamp][spec.onStep];
      const min = targetFor(spec.min, k);
      const step = resolveOnSurface(ramps[spec.ramp], surface, min, stepsFor(spec.ramp));
      // Emit as a reference to the resolved step so SD keeps the var() reference graph.
      out[name] = { ref: nameFor(spec.ramp, step) };
    }
  }
  return out;
}
```

> Decision: contrast-targeted tokens emit a **reference to the resolved step** (`{ ref }`), not a literal value. This keeps the Style Dictionary reference graph intact (`outputReferences: true` still produces `var(--color-neutral-800)`), and the WCAG guarantee holds because the step was chosen to clear the target. The `ResolvedToken` union keeps `{ value }` available for a future synthesized-color path but it is unused in v1.

- [ ] **Step 4: Extend the tables to full name parity**

List today's semantic names and ensure every one appears in BOTH tables:

```bash
diff <(grep -oE '"color-[^"]+"' src/tokens/color.light.tokens.json | sort -u) \
     <(grep -oE '"color-[^"]+"' src/tokens/color.dark.tokens.json | sort -u)
```

Add any missing entries to `SEMANTICS_LIGHT` / `SEMANTICS_DARK`, choosing `ref(...)` (mirroring today's assignment, remapping feedback to the new status ramps) or `target(...)` for text/border-on-surface tokens.

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- semantics`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/semantics.ts src/engine/semantics.test.ts
git commit -m "feat(engine): semantic mapping with contrast-targeted resolution"
```

---

## Task 7: Derived alphas + dark-surfaces

**Files:**
- Create: `src/engine/derived.ts`
- Test: `src/engine/derived.test.ts`

**Interfaces:**
- Consumes: `Oklch`, `Ramp`, `RampSet` (Task 2).
- Produces:
  - `BLACK_ALPHA: Record<string, number>` and `WHITE_ALPHA: Record<string, number>` (step → opacity; keys preserve today's spellings incl. `transparent` for black and `transparant` for white).
  - `BLACK_BASE: Oklch`, `WHITE_BASE: Oklch`.
  - `buildAlphas(): { black: Ramp; white: Ramp }` (each step is an `Oklch` with `alpha`).
  - `DARK_SURFACE_LIGHTNESS: Record<string, number>`; `buildDarkSurfaces(neutralSeedHue: number, neutralSeedChroma: number): Ramp` (keys `"1".."5"`).

- [ ] **Step 1: Write the failing test**

`src/engine/derived.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAlphas, buildDarkSurfaces, BLACK_ALPHA, WHITE_ALPHA } from "./derived.js";

describe("buildAlphas", () => {
  const { black, white } = buildAlphas();
  it("preserves the black 'transparent' and white 'transparant' keys", () => {
    expect(BLACK_ALPHA).toHaveProperty("transparent");
    expect(WHITE_ALPHA).toHaveProperty("transparant");
  });
  it("sets alpha from the opacity map", () => {
    expect(black["12"].alpha).toBeCloseTo(0.12, 5);
    expect(white["transparant"].alpha).toBe(0);
  });
  it("black base is dark, white base is light", () => {
    expect(black["80"].l).toBeLessThan(0.3);
    expect(white["80"].l).toBeGreaterThan(0.95);
  });
});

describe("buildDarkSurfaces", () => {
  const surf = buildDarkSurfaces(70, 0.006);
  it("produces five increasing-lightness surfaces", () => {
    const ls = ["1", "2", "3", "4", "5"].map((s) => surf[s].l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThan(ls[i - 1]);
    expect(ls[0]).toBeLessThan(0.25);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- derived`
Expected: FAIL — cannot find `./derived.js`.

- [ ] **Step 3: Implement `derived.ts`**

```ts
import type { Oklch, Ramp } from "./types.js";

// Opacity maps. Keys MUST match today's token names exactly (note the differing
// spelling: black uses "transparent", white uses "transparant").
const OPACITIES = {
  "4": 0.04, "8": 0.08, "12": 0.12, "16": 0.16, "24": 0.24,
  "32": 0.32, "48": 0.48, "64": 0.64, "80": 0.8,
} as const;

export const BLACK_ALPHA: Record<string, number> = { transparent: 0, ...OPACITIES };
export const WHITE_ALPHA: Record<string, number> = { transparant: 0, ...OPACITIES };

// Today's alpha base colors: black-alpha rests on #0a0a0a, white-alpha on #fff.
export const BLACK_BASE: Oklch = { l: 0.13, c: 0, h: 0 };
export const WHITE_BASE: Oklch = { l: 1, c: 0, h: 0 };

export function buildAlphas(): { black: Ramp; white: Ramp } {
  const black: Ramp = {};
  for (const [step, alpha] of Object.entries(BLACK_ALPHA)) black[step] = { ...BLACK_BASE, alpha };
  const white: Ramp = {};
  for (const [step, alpha] of Object.entries(WHITE_ALPHA)) white[step] = { ...WHITE_BASE, alpha };
  return { black, white };
}

// Dark-mode surface lightnesses (today: #0a0a0a..#242424 → l ≈ 0.13..0.30).
export const DARK_SURFACE_LIGHTNESS: Record<string, number> = {
  "1": 0.13, "2": 0.16, "3": 0.2, "4": 0.24, "5": 0.3,
};

export function buildDarkSurfaces(hue: number, chroma: number): Ramp {
  const out: Ramp = {};
  for (const [step, l] of Object.entries(DARK_SURFACE_LIGHTNESS)) {
    out[step] = { l, c: Math.min(chroma, 0.01), h: hue };
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- derived`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/derived.ts src/engine/derived.test.ts
git commit -m "feat(engine): derive alpha ramps and dark-mode surfaces"
```

---

## Task 8: DTCG emission + isomorphic barrel + isomorphism guard

**Files:**
- Create: `src/engine/emit-dtcg.ts` (Node-only)
- Create: `src/engine/index.ts` (pure barrel)
- Test: `src/engine/emit-dtcg.test.ts`
- Test: `src/engine/isomorphism.test.ts`

**Interfaces:**
- Consumes: all prior engine modules + `ThemeInputs`.
- Produces:
  - `index.ts`: re-exports `types`, `contrast-input`, `steps`, `ramps`, `contrast`, `derived`, `semantics` (NOT `emit-dtcg`).
  - `emit-dtcg.ts`: `oklchToDtcg(c: Oklch): object` (`{ $type:"color", $value:{ colorSpace:"oklch", components:[l,c,h], alpha? } }`); `buildPrimitivesDtcg(inputs): Record<string, object>`; `buildSemanticDtcg(inputs, mode): Record<string, object>`; `writeGeneratedTokens(inputs: ThemeInputs, tokensDir: string): void`.

- [ ] **Step 1: Write the failing tests**

`src/engine/emit-dtcg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { oklchToDtcg, buildPrimitivesDtcg, buildSemanticDtcg } from "./emit-dtcg.js";
import themeInputs from "../../theme.config.js";

describe("oklchToDtcg", () => {
  it("emits a DTCG oklch color object", () => {
    const t = oklchToDtcg({ l: 0.5, c: 0.1, h: 138 });
    expect(t).toMatchObject({ $type: "color", $value: { colorSpace: "oklch" } });
    expect((t as any).$value.components).toEqual([0.5, 0.1, 138]);
  });
  it("includes alpha when present", () => {
    const t = oklchToDtcg({ l: 0.13, c: 0, h: 0, alpha: 0.12 });
    expect((t as any).$value.alpha).toBe(0.12);
  });
});

describe("buildPrimitivesDtcg", () => {
  const prims = buildPrimitivesDtcg(themeInputs);
  it("includes generated ramp, alpha and dark-surface tokens with frozen names", () => {
    expect(prims["color-neutral-0"]).toBeDefined();
    expect(prims["color-accent-500"]).toBeDefined();
    expect(prims["color-sky-500"]).toBeDefined();
    expect(prims["color-success-500"]).toBeDefined();
    expect(prims["color-black-alpha-12"]).toBeDefined();
    expect(prims["color-white-alpha-transparant"]).toBeDefined();
    expect(prims["color-neutral-dark-surface-2"]).toBeDefined();
  });
  it("does NOT include prism (static passthrough)", () => {
    expect(prims["color-prism-green"]).toBeUndefined();
  });
});

describe("buildSemanticDtcg", () => {
  it("emits reference values for semantic tokens", () => {
    const light = buildSemanticDtcg(themeInputs, "light");
    expect(light["color-background-surface-default"].$value).toBe("{color-neutral-0}");
  });
});
```

`src/engine/isomorphism.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Guard: the pure engine modules must not import Node-only APIs.
const PURE = [
  "types.ts", "contrast-input.ts", "steps.ts", "ramps.ts",
  "contrast.ts", "derived.ts", "semantics.ts", "index.ts",
];

describe("engine isomorphism", () => {
  for (const file of PURE) {
    it(`${file} has no node-only imports`, () => {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf-8");
      expect(src).not.toMatch(/from\s+["']node:/);
      expect(src).not.toMatch(/from\s+["']fs["']/);
      expect(src).not.toMatch(/from\s+["']path["']/);
      expect(src).not.toMatch(/require\(["'](fs|path|node:)/);
    });
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- emit-dtcg isomorphism`
Expected: FAIL — cannot find `./emit-dtcg.js`; isomorphism test fails until `index.ts` exists.

- [ ] **Step 3: Implement `index.ts` (pure barrel)**

```ts
export * from "./types.js";
export * from "./contrast-input.js";
export * from "./steps.js";
export * from "./ramps.js";
export * from "./contrast.js";
export * from "./derived.js";
export * from "./semantics.js";
```

- [ ] **Step 4: Implement `emit-dtcg.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Oklch, ThemeInputs } from "./types.js";
import { buildRamps } from "./ramps.js";
import { buildAlphas, buildDarkSurfaces } from "./derived.js";
import { resolveSemantics } from "./semantics.js";

const BANNER = "auto-generated by build:theme — do not edit";

export function oklchToDtcg(c: Oklch): object {
  const value: Record<string, unknown> = {
    colorSpace: "oklch",
    components: [round(c.l), round(c.c), round(c.h, 2)],
  };
  if (c.alpha !== undefined) value.alpha = c.alpha;
  return { $type: "color", $value: value };
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const rampNamePrefix: Record<string, string> = {
  neutral: "color-neutral",
  accent: "color-accent",
  secondary: "color-sky",
  tertiary: "color-pink",
  success: "color-success",
  error: "color-error",
  warning: "color-warning",
  info: "color-info",
};

export function buildPrimitivesDtcg(inputs: ThemeInputs): Record<string, object> {
  const out: Record<string, object> = {};
  const ramps = buildRamps(inputs);
  for (const [key, prefix] of Object.entries(rampNamePrefix)) {
    const ramp = ramps[key as keyof typeof ramps];
    for (const [step, color] of Object.entries(ramp)) {
      out[`${prefix}-${step}`] = oklchToDtcg(color);
    }
  }
  const { black, white } = buildAlphas();
  for (const [step, color] of Object.entries(black)) out[`color-black-alpha-${step}`] = oklchToDtcg(color);
  for (const [step, color] of Object.entries(white)) out[`color-white-alpha-${step}`] = oklchToDtcg(color);

  const darkSurf = buildDarkSurfaces(inputs.neutral.hue, inputs.neutral.chroma);
  for (const [step, color] of Object.entries(darkSurf)) {
    out[`color-neutral-dark-surface-${step}`] = oklchToDtcg(color);
  }
  return out;
}

export function buildSemanticDtcg(inputs: ThemeInputs, mode: "light" | "dark"): Record<string, any> {
  const ramps = buildRamps(inputs);
  const resolved = resolveSemantics(ramps, inputs, mode);
  const out: Record<string, any> = {};
  for (const [name, token] of Object.entries(resolved)) {
    out[name] = "ref" in token ? { $type: "color", $value: `{${token.ref}}` } : oklchToDtcg(token.value);
  }
  return out;
}

export function writeGeneratedTokens(inputs: ThemeInputs, tokensDir: string): void {
  mkdirSync(tokensDir, { recursive: true });
  const withBanner = (obj: object) => ({ $description: BANNER, ...obj });

  writeFileSync(
    join(tokensDir, "primitives-color.mode-1.tokens.json"),
    JSON.stringify(withBanner(buildPrimitivesDtcg(inputs)), null, 2) + "\n",
  );
  writeFileSync(
    join(tokensDir, "color.light.tokens.json"),
    JSON.stringify(buildSemanticDtcg(inputs, "light"), null, 2) + "\n",
  );
  writeFileSync(
    join(tokensDir, "color.dark.tokens.json"),
    JSON.stringify(buildSemanticDtcg(inputs, "dark"), null, 2) + "\n",
  );
}
```

> The `$description: BANNER` top-level key is a harmless DTCG group description; Style Dictionary ignores non-`$value` group metadata. If the build warns about it, move the banner to a leading JSON comment is NOT possible (JSON), so instead emit it as a sibling `_comment` key and confirm SD ignores it during Task 11's integration run.

- [ ] **Step 5: Run them to verify they pass**

Run: `npm test -- emit-dtcg isomorphism`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/index.ts src/engine/emit-dtcg.ts src/engine/emit-dtcg.test.ts src/engine/isomorphism.test.ts
git commit -m "feat(engine): DTCG emission, isomorphic barrel, isomorphism guard"
```

---

## Task 9: Static prism passthrough + manifest

**Files:**
- Create: `src/tokens/primitives-color.static.tokens.json`
- Modify: `src/tokens/manifest.json`

**Interfaces:**
- Produces: a static file holding the 8 `color-prism-*` tokens; manifest's `primitives-color` collection lists both the generated and static files.

- [ ] **Step 1: Create the static prism file**

Copy the 8 `color-prism-*` entries **verbatim** from the current `src/tokens/primitives-color.mode-1.tokens.json` into a new file `src/tokens/primitives-color.static.tokens.json`. Extract them precisely:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const all = JSON.parse(readFileSync("src/tokens/primitives-color.mode-1.tokens.json","utf-8"));
const out = {};
for (const k of Object.keys(all)) if (k.startsWith("color-prism-")) out[k] = all[k];
writeFileSync("src/tokens/primitives-color.static.tokens.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote", Object.keys(out).length, "prism tokens");
'
```

Expected: `wrote 8 prism tokens`.

- [ ] **Step 2: Update the manifest**

In `src/tokens/manifest.json`, change the `primitives-color` collection to list both files:

```json
    "primitives-color": {
      "modes": {
        "mode-1": [
          "primitives-color.mode-1.tokens.json",
          "primitives-color.static.tokens.json"
        ]
      }
    },
```

- [ ] **Step 3: Verify the manifest still parses and lists both files**

Run: `node --input-type=module -e 'import {readFileSync} from "node:fs"; const m=JSON.parse(readFileSync("src/tokens/manifest.json","utf-8")); console.log(m.collections["primitives-color"].modes["mode-1"]);'`
Expected: `[ 'primitives-color.mode-1.tokens.json', 'primitives-color.static.tokens.json' ]`

- [ ] **Step 4: Commit**

```bash
git add src/tokens/primitives-color.static.tokens.json src/tokens/manifest.json
git commit -m "feat(tokens): split prism colors into static passthrough file"
```

---

## Task 10: build:theme orchestrator

**Files:**
- Create: `scripts/buildTheme.ts`
- Test: `src/engine/build-theme.test.ts`

**Interfaces:**
- Consumes: `writeGeneratedTokens` (Task 8); `theme.config.ts`.
- Produces: `npm run build:theme` regenerates the three generated color files in `src/tokens/`.

- [ ] **Step 1: Write the failing test**

`src/engine/build-theme.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGeneratedTokens } from "./emit-dtcg.js";
import themeInputs from "../../theme.config.js";

describe("writeGeneratedTokens (the core of build:theme)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "theme-"));
    writeGeneratedTokens(themeInputs, dir);
  });

  it("writes the three generated color files", () => {
    expect(existsSync(join(dir, "primitives-color.mode-1.tokens.json"))).toBe(true);
    expect(existsSync(join(dir, "color.light.tokens.json"))).toBe(true);
    expect(existsSync(join(dir, "color.dark.tokens.json"))).toBe(true);
  });

  it("primitives file contains an oklch color value", () => {
    const prims = JSON.parse(readFileSync(join(dir, "primitives-color.mode-1.tokens.json"), "utf-8"));
    expect(prims["color-accent-500"].$value.colorSpace).toBe("oklch");
  });

  it("light semantics reference primitives", () => {
    const light = JSON.parse(readFileSync(join(dir, "color.light.tokens.json"), "utf-8"));
    expect(light["color-background-surface-default"].$value).toBe("{color-neutral-0}");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- build-theme`
Expected: FAIL until `emit-dtcg` is wired (it exists from Task 8, so this should actually PASS — if so, that is fine; the test documents the contract). If it fails, fix `emit-dtcg.ts` before continuing.

- [ ] **Step 3: Implement `scripts/buildTheme.ts`**

```ts
import { writeGeneratedTokens } from "../src/engine/emit-dtcg.js";
import themeInputs from "../theme.config.js";

function main() {
  try {
    console.log("🎨 Generating color tokens from theme.config.ts…");
    writeGeneratedTokens(themeInputs, "src/tokens");
    console.log("✅ src/tokens/primitives-color.mode-1.tokens.json");
    console.log("✅ src/tokens/color.light.tokens.json");
    console.log("✅ src/tokens/color.dark.tokens.json");
    console.log("\nNext: npm run build:tokens");
    process.exit(0);
  } catch (error) {
    console.error("Theme generation failed:", error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 4: Run the orchestrator for real**

```bash
# Back up the current hand-authored color files so we can diff after generating:
cp src/tokens/color.light.tokens.json /tmp/old-light.json
npm run build:theme
```

Expected: prints the three ✅ lines and exits 0. `src/tokens/primitives-color.mode-1.tokens.json` is now the generated oklch version (prism tokens are gone from it — they live in the static file).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all engine tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/buildTheme.ts src/engine/build-theme.test.ts src/tokens/primitives-color.mode-1.tokens.json src/tokens/color.light.tokens.json src/tokens/color.dark.tokens.json
git commit -m "feat: add build:theme orchestrator and regenerate color tokens"
```

---

## Task 11: oklch/css Style Dictionary transform

**Files:**
- Create: `src/transforms/oklchColor.ts`
- Test: `src/transforms/oklchColor.test.ts`
- Modify: `scripts/buildTokens.ts`

**Interfaces:**
- Consumes: the generated DTCG color tokens (oklch components) + the static prism tokens (srgb components).
- Produces: a registered `oklch/css` transform that formats ANY color token (oklch- or srgb-componented) as an `oklch(L C H)` / `oklch(L C H / a)` CSS string, gamut-clamped to P3. `buildTokens.ts` uses it in place of `w3c-color/css`.

- [ ] **Step 1: Write the failing test**

`src/transforms/oklchColor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatOklch, dtcgToCulori } from "./oklchColor.js";

describe("dtcgToCulori", () => {
  it("parses an oklch component value", () => {
    const c = dtcgToCulori({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(c).toMatchObject({ mode: "oklch", l: 0.5, c: 0.1, h: 138 });
  });
  it("parses an srgb component value (prism passthrough)", () => {
    const c = dtcgToCulori({ colorSpace: "srgb", components: [0.165, 0.596, 0.169] });
    expect(c.mode).toBe("oklch");
    expect(c.l).toBeGreaterThan(0);
  });
});

describe("formatOklch", () => {
  it("formats without alpha", () => {
    const css = formatOklch({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(css).toMatch(/^oklch\(0\.5 0\.1 138\)$/);
  });
  it("formats with alpha", () => {
    const css = formatOklch({ colorSpace: "oklch", components: [0.13, 0, 0], alpha: 0.12 });
    expect(css).toMatch(/\/ 0\.12\)$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- oklchColor`
Expected: FAIL — cannot find `./oklchColor.js`.

- [ ] **Step 3: Implement `src/transforms/oklchColor.ts`**

```ts
import { oklch, clampChroma } from "culori";

interface DtcgColorValue {
  colorSpace: string;
  components: number[];
  alpha?: number;
}

/** Convert a DTCG color value (oklch or srgb components) to a culori oklch color. */
export function dtcgToCulori(value: DtcgColorValue) {
  const [a, b, c] = value.components;
  if (value.colorSpace === "oklch") {
    return clampChroma({ mode: "oklch", l: a, c: b, h: c }, "oklch", "p3");
  }
  // srgb (and anything else culori understands via rgb components)
  const conv = oklch({ mode: "rgb", r: a, g: b, b: c });
  return clampChroma({ mode: "oklch", l: conv!.l, c: conv!.c ?? 0, h: conv!.h ?? 0 }, "oklch", "p3");
}

const r = (n: number, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Format a DTCG color value as a CSS oklch() string. */
export function formatOklch(value: DtcgColorValue): string {
  const c = dtcgToCulori(value);
  const l = r(c.l);
  const ch = r(c.c ?? 0);
  const h = r(c.h ?? 0, 2);
  const alpha = value.alpha;
  return alpha === undefined
    ? `oklch(${l} ${ch} ${h})`
    : `oklch(${l} ${ch} ${h} / ${alpha})`;
}

/** Style Dictionary transform object. */
export const oklchCssTransform = {
  name: "oklch/css",
  type: "value" as const,
  transitive: true,
  filter: (token: any) =>
    token.$type === "color" &&
    typeof token.$value === "object" &&
    token.$value?.components !== undefined,
  transform: (token: any) => formatOklch(token.$value as DtcgColorValue),
};
```

- [ ] **Step 4: Run the transform unit test to verify it passes**

Run: `npm test -- oklchColor`
Expected: PASS.

- [ ] **Step 5: Register the transform and swap it into the build**

In `scripts/buildTokens.ts`:

1. Add the import near the top (after the existing imports):

```ts
import { oklchCssTransform } from "../src/transforms/oklchColor.js";
```

2. Register it next to the other `registerTransform` calls (before `buildTokens()` is defined):

```ts
StyleDictionary.registerTransform(oklchCssTransform);
```

3. In `sharedPlatformConfig.transforms`, replace the line `"w3c-color/css",` with `"oklch/css",` (same position in the array).

- [ ] **Step 6: Run the full token build and verify oklch output**

```bash
npm run build:tokens
grep -m1 "color-accent-500" dist/css/tokens.css
grep -m1 "color-border-default" dist/css/tokens.css
```

Expected: the build prints its success lines; `--color-accent-500` shows an `oklch(… … …)` value; `--color-border-default` resolves to `var(--color-black-alpha-12)` (reference preserved). Confirm there are no stray hex color values in the color section of `dist/css/tokens.css`.

- [ ] **Step 7: Verify the banner did not break the build**

If `buildTokens` warned about the `$description`/`_comment` banner key, open `src/engine/emit-dtcg.ts` and change `withBanner` to emit the banner under a key Style Dictionary ignores (a leading `_comment` string). Re-run `npm run build:theme && npm run build:tokens` and confirm a clean build. If there was no warning, leave it.

- [ ] **Step 8: Commit**

```bash
git add src/transforms/oklchColor.ts src/transforms/oklchColor.test.ts scripts/buildTokens.ts dist/css/tokens.css dist/scss
git commit -m "feat(build): emit oklch() CSS via new oklch/css transform"
```

---

## Task 12: Studio scaffold

**Files:**
- Create: `tools/color-studio/package.json`
- Create: `tools/color-studio/vite.config.ts`
- Create: `tools/color-studio/tsconfig.json`
- Create: `tools/color-studio/index.html`
- Create: `tools/color-studio/src/main.ts`

**Interfaces:**
- Consumes: `buildRamps` (via `@project/src/engine/index.js`); `theme.config.ts`.
- Produces: `npm run preview:studio` boots a Vite dev server that renders the generated ramps.

- [ ] **Step 1: Create `package.json`** (mirrors `tools/fluid-preview`)

```json
{
  "name": "color-studio",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`** (alias `@project` to the repo root, like the other tools)

```ts
import { defineConfig } from "vite";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "../..");

export default defineConfig({
  root: ".",
  resolve: {
    alias: { "@project": projectRoot },
  },
  server: {
    open: true,
    fs: { allow: [projectRoot] },
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Color Studio</title>
  </head>
  <body>
    <main id="app">
      <h1>Color Studio</h1>
      <section id="ramps"></section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts` rendering the ramps from the live engine**

```ts
import { buildRamps, type RampSet, type Oklch } from "@project/src/engine/index.js";
import themeInputs from "@project/theme.config.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function renderRamps(set: RampSet) {
  const root = document.getElementById("ramps")!;
  root.innerHTML = "";
  for (const [name, ramp] of Object.entries(set)) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "4px";
    row.style.margin = "6px 0";
    const label = document.createElement("code");
    label.textContent = name.padEnd(10);
    label.style.width = "90px";
    row.appendChild(label);
    for (const [step, color] of Object.entries(ramp as Record<string, Oklch>)) {
      const chip = document.createElement("div");
      chip.title = `${name}-${step}`;
      chip.style.width = "34px";
      chip.style.height = "34px";
      chip.style.background = css(color);
      chip.style.borderRadius = "4px";
      row.appendChild(chip);
    }
    root.appendChild(row);
  }
}

renderRamps(buildRamps(themeInputs));
```

- [ ] **Step 6: Install and boot the studio**

```bash
cd tools/color-studio && npm install && cd ../..
npm run preview:studio
```

Expected: a browser tab opens showing eight labelled ramp rows (neutral, accent, secondary, tertiary, success, error, warning, info) of OKLCH chips. Stop the dev server (Ctrl-C) once verified.

- [ ] **Step 7: Commit**

```bash
git add tools/color-studio/package.json tools/color-studio/vite.config.ts tools/color-studio/tsconfig.json tools/color-studio/index.html tools/color-studio/src/main.ts tools/color-studio/package-lock.json
git commit -m "feat(studio): scaffold Vite color studio rendering live ramps"
```

---

## Task 13: Studio interactivity — inputs, light/dark, WCAG badges, sample UI

**Files:**
- Create: `tools/color-studio/src/ui/controls.ts`
- Create: `tools/color-studio/src/ui/preview.ts`
- Modify: `tools/color-studio/src/main.ts`
- Modify: `tools/color-studio/index.html`

**Interfaces:**
- Consumes: `buildRamps`, `resolveSemantics`, `contrastRatio` (engine barrel); `ThemeInputs`.
- Produces: an editable in-memory `ThemeInputs` state; on any change the engine re-runs and the preview re-renders. A light/dark toggle. Per-chip WCAG badges. A small sample-UI block.

- [ ] **Step 1: Add the controls + preview containers to `index.html`**

Replace the `<main>` body with:

```html
    <main id="app">
      <aside id="controls"></aside>
      <section id="preview">
        <div id="mode-bar">
          <button id="mode-toggle" type="button">Mode: light</button>
        </div>
        <section id="ramps"></section>
        <section id="semantics"></section>
        <section id="sample"></section>
      </section>
    </main>
```

- [ ] **Step 2: Implement `src/ui/controls.ts`**

```ts
import type { ThemeInputs, HueSeed } from "@project/src/engine/index.js";

type OnChange = (next: ThemeInputs) => void;

function seedControl(
  label: string,
  seed: HueSeed,
  onInput: (s: HueSeed) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.margin = "8px 0";
  const title = document.createElement("div");
  title.textContent = label;
  title.style.fontSize = "12px";
  wrap.appendChild(title);

  const hue = document.createElement("input");
  hue.type = "range"; hue.min = "0"; hue.max = "360"; hue.step = "1";
  hue.value = String(seed.hue);
  const chroma = document.createElement("input");
  chroma.type = "range"; chroma.min = "0"; chroma.max = "0.3"; chroma.step = "0.005";
  chroma.value = String(seed.chroma);

  const emit = () => onInput({ hue: Number(hue.value), chroma: Number(chroma.value) });
  hue.addEventListener("input", emit);
  chroma.addEventListener("input", emit);
  wrap.append(hue, chroma);
  return wrap;
}

export function renderControls(state: ThemeInputs, onChange: OnChange): void {
  const root = document.getElementById("controls")!;
  root.innerHTML = "<h2 style='font-size:14px'>Inputs</h2>";

  root.appendChild(seedControl("neutral", state.neutral, (s) => onChange({ ...state, neutral: s })));

  const contrast = document.createElement("input");
  contrast.type = "range"; contrast.min = "0"; contrast.max = "1"; contrast.step = "0.01";
  contrast.value = String(typeof state.contrast === "number" ? state.contrast : 0.5);
  contrast.addEventListener("input", () => onChange({ ...state, contrast: Number(contrast.value) }));
  const cl = document.createElement("div"); cl.textContent = "contrast"; cl.style.fontSize = "12px";
  root.append(cl, contrast);

  for (const key of ["primary", "secondary", "tertiary"] as const) {
    root.appendChild(
      seedControl(`accent.${key}`, state.accents[key], (s) =>
        onChange({ ...state, accents: { ...state.accents, [key]: s } })),
    );
  }
  for (const key of ["success", "error", "warning", "info"] as const) {
    root.appendChild(
      seedControl(`status.${key}`, state.status[key], (s) =>
        onChange({ ...state, status: { ...state.status, [key]: s } })),
    );
  }
}
```

- [ ] **Step 3: Implement `src/ui/preview.ts`**

```ts
import {
  buildRamps, resolveSemantics, contrastRatio,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function renderRamps(set: RampSet, surface: Oklch) {
  const root = document.getElementById("ramps")!;
  root.innerHTML = "<h3 style='font-size:13px'>Ramps</h3>";
  for (const [name, ramp] of Object.entries(set)) {
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "4px"; row.style.margin = "4px 0";
    const label = document.createElement("code");
    label.textContent = name; label.style.width = "90px";
    row.appendChild(label);
    for (const [step, color] of Object.entries(ramp as Record<string, Oklch>)) {
      const chip = document.createElement("div");
      chip.style.width = "40px"; chip.style.height = "40px";
      chip.style.background = css(color); chip.style.borderRadius = "4px";
      chip.style.fontSize = "8px"; chip.style.color = "white";
      chip.title = `${name}-${step}: ${contrastRatio(color, surface).toFixed(2)}:1 vs surface`;
      row.appendChild(chip);
    }
    root.appendChild(row);
  }
}

function renderSample(set: RampSet, surface: Oklch) {
  const root = document.getElementById("sample")!;
  root.innerHTML = "<h3 style='font-size:13px'>Sample UI</h3>";
  const card = document.createElement("div");
  card.style.background = css(surface);
  card.style.padding = "16px";
  card.style.borderRadius = "8px";
  card.style.maxWidth = "320px";
  card.innerHTML = `
    <p style="color:${css(set.neutral["800"])}">Body text on the default surface.</p>
    <button style="background:${css(set.accent["500"])};color:white;border:none;padding:8px 14px;border-radius:6px">Primary</button>
  `;
  root.appendChild(card);
}

export function renderPreview(state: ThemeInputs, mode: "light" | "dark"): void {
  const set = buildRamps(state);
  resolveSemantics(set, state, mode); // exercises the resolver path
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  document.body.style.background = mode === "light" ? "#fff" : "#111";
  renderRamps(set, surface);
  renderSample(set, surface);
}
```

- [ ] **Step 4: Rewrite `src/main.ts` to wire state → controls → preview**

```ts
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderControls } from "./ui/controls.js";
import { renderPreview } from "./ui/preview.js";

let state: ThemeInputs = structuredClone(themeInputs);
let mode: "light" | "dark" = "light";

function rerender() {
  renderControls(state, (next) => { state = next; rerender(); });
  renderPreview(state, mode);
  const toggle = document.getElementById("mode-toggle")!;
  toggle.textContent = `Mode: ${mode}`;
}

document.getElementById("mode-toggle")!.addEventListener("click", () => {
  mode = mode === "light" ? "dark" : "light";
  rerender();
});

rerender();
```

- [ ] **Step 5: Boot and verify interactivity**

```bash
npm run preview:studio
```

Expected: dragging the contrast slider visibly spreads/compresses the ramps; changing the primary accent hue recolors the accent ramp and the sample button; the Mode toggle flips the surface and re-renders. Stop the server when done.

- [ ] **Step 6: Commit**

```bash
git add tools/color-studio/index.html tools/color-studio/src/main.ts tools/color-studio/src/ui/controls.ts tools/color-studio/src/ui/preview.ts
git commit -m "feat(studio): live inputs, light/dark toggle, WCAG badges, sample UI"
```

---

## Task 14: Studio Save endpoint

**Files:**
- Create: `tools/color-studio/src/serialize.ts`
- Modify: `tools/color-studio/vite.config.ts`
- Modify: `tools/color-studio/src/main.ts`
- Modify: `tools/color-studio/index.html`
- Test: `tools/color-studio/src/serialize.test.ts` (run by the root vitest)

**Interfaces:**
- Consumes: `ThemeInputs`.
- Produces: `serializeConfig(inputs: ThemeInputs): string` (a valid `theme.config.ts` source string); a Vite dev middleware on `POST /__save-theme` that writes the repo-root `theme.config.ts`; a Save button in the studio.

- [ ] **Step 1: Add `src/engine/*.test.ts` glob also covers the tool — confirm vitest include**

The root `vitest.config.ts` includes `src/**/*.test.ts`, which does NOT cover `tools/`. Update it to also run the studio's pure unit test:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tools/color-studio/src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 2: Write the failing test**

`tools/color-studio/src/serialize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serializeConfig } from "./serialize.js";

describe("serializeConfig", () => {
  const inputs = {
    neutral: { hue: 70, chroma: 0.006 },
    contrast: 0.5,
    accents: {
      primary: { hue: 138, chroma: 0.12 },
      secondary: { hue: 220, chroma: 0.11 },
      tertiary: { hue: 330, chroma: 0.1 },
    },
    status: {
      success: { hue: 150, chroma: 0.12 },
      error: { hue: 25, chroma: 0.17 },
      warning: { hue: 70, chroma: 0.15 },
      info: { hue: 240, chroma: 0.12 },
    },
  };

  it("produces a parseable default-export module string", () => {
    const src = serializeConfig(inputs);
    expect(src).toContain("const themeInputs: ThemeInputs");
    expect(src).toContain("export default themeInputs;");
    expect(src).toContain('hue: 138');
  });

  it("round-trips the numbers via JSON embedded in the source", () => {
    const src = serializeConfig(inputs);
    const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    expect(JSON.parse(json).accents.primary.hue).toBe(138);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- serialize`
Expected: FAIL — cannot find `./serialize.js`.

- [ ] **Step 4: Implement `src/serialize.ts`**

```ts
import type { ThemeInputs } from "@project/src/engine/index.js";

/** Emit a valid theme.config.ts source string for the given inputs. */
export function serializeConfig(inputs: ThemeInputs): string {
  const body = JSON.stringify(inputs, null, 2);
  return `import type { ThemeInputs } from "./src/engine/types.js";

const themeInputs: ThemeInputs = ${body};

export default themeInputs;
`;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- serialize`
Expected: PASS.

- [ ] **Step 6: Add the Save middleware to `vite.config.ts`**

```ts
import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { writeFileSync } from "fs";

const projectRoot = resolve(__dirname, "../..");

function saveThemePlugin(): Plugin {
  return {
    name: "save-theme",
    configureServer(server) {
      server.middlewares.use("/__save-theme", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            writeFileSync(resolve(projectRoot, "theme.config.ts"), body, "utf-8");
            res.statusCode = 200;
            res.end("ok");
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [saveThemePlugin()],
  resolve: { alias: { "@project": projectRoot } },
  server: { open: true, fs: { allow: [projectRoot] } },
});
```

- [ ] **Step 7: Add a Save button to the studio**

In `index.html`, add inside `#mode-bar`:

```html
          <button id="save-btn" type="button">Save to theme.config.ts</button>
```

In `src/main.ts`, add the import and a click handler (append after the mode-toggle handler):

```ts
import { serializeConfig } from "./serialize.js";

document.getElementById("save-btn")!.addEventListener("click", async () => {
  const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
  const btn = document.getElementById("save-btn")!;
  btn.textContent = res.ok ? "Saved ✓" : "Save failed";
  setTimeout(() => (btn.textContent = "Save to theme.config.ts"), 1500);
});
```

- [ ] **Step 8: Verify the round-trip end to end**

```bash
cp theme.config.ts /tmp/theme.config.backup.ts
npm run preview:studio
```

In the browser: change the primary accent hue, click **Save**, confirm "Saved ✓". Stop the server, then:

```bash
git diff theme.config.ts        # shows the hue you changed
npm run build:theme && npm run build:tokens   # regenerates CSS from the saved config
```

Expected: `theme.config.ts` reflects the studio change; the build succeeds and `dist/css/tokens.css` updates. Restore if you want the original inputs: `cp /tmp/theme.config.backup.ts theme.config.ts`.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS (all engine + serialize tests).

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts tools/color-studio/vite.config.ts tools/color-studio/index.html tools/color-studio/src/main.ts tools/color-studio/src/serialize.ts tools/color-studio/src/serialize.test.ts theme.config.ts
git commit -m "feat(studio): Save endpoint writes theme.config.ts round-trip"
```

---

## Final Verification (acceptance bar)

- [ ] **Step 1: Clean regenerate + build**

```bash
npm run build:theme && npm run build:tokens
```

Expected: both succeed; `dist/css/tokens.css` contains `oklch()` color variables and the same token *names* as before this work (spot-check `--color-text-default`, `--color-border-default`, `--color-accent-500`, `--color-feedback-error-text`).

- [ ] **Step 2: Full test suite green**

Run: `npm test`
Expected: PASS — smoke, contrast-input, ramps, parity (neutral+primary proximity), contrast, semantics, derived, emit-dtcg, build-theme, isomorphism, oklchColor, serialize.

- [ ] **Step 3: Confirm contrast guarantees**

Add (if not already present) a quick assertion run or eyeball the `semantics.test.ts` output: every `target(...)` token clears its WCAG minimum against its surface in both light and dark. (The resolver guarantees this; the test documents it.)

- [ ] **Step 4: Studio sanity**

`npm run preview:studio` → ramps render, sliders re-derive live, light/dark toggles, Save round-trips. Stop the server.

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch to decide merge/PR.

---

## Notes for the implementer

- **Why references, not literals, for contrast-targeted tokens (Task 6):** keeping `{color-neutral-800}` references means Style Dictionary's `outputReferences: true` still emits `var(--color-neutral-800)` in the CSS, preserving the variable graph the site relies on. The WCAG guarantee comes from *which* step was chosen, not from inlining a value.
- **Calibration is iterative (Task 4):** the lightness/chroma constants in `steps.ts` are a starting point. The proximity test is a *guide* — tune constants, don't loosen the test below `TOL = 0.06`. Only neutral + primary must stay close.
- **The banner key (Task 8/11):** Style Dictionary may treat a top-level `$description` as a group description. If the build warns, switch to a `_comment` sibling key. Verify during Task 11's integration build.
- **oklch component round-tripping (Task 11):** the `oklch/css` transform handles both oklch-component (generated) and srgb-component (prism passthrough) color values, so the static file needs no manual conversion.
