# Programmatic Color Engine — CLI, Claude Skill & Figma MCP Write — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing color engine callable from a prompt — structured inputs in, repo tokens/CSS rebuilt and Figma `primitives-color` variables updated in place via the official Figma MCP — with no studio UI and no manual paste.

**Architecture:** Add small, pure, tested engine helpers (hex→seed, sRGB conversion, name normalization, config serialization, input resolution/validation, a flat Figma write-plan builder) in `src/engine/`, a thin non-tested I/O CLI (`scripts/generateTheme.ts`) that composes them, and a Claude skill (`.claude/skills/generate-color-theme/`) that orchestrates the CLI plus a two-phase (preview → apply) `use_figma` write template. The engine core is never modified; `theme.config.ts` stays the single source of truth.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), `tsx` runner, `culori` (color math), `vitest` (tests), `node:util` `parseArgs` (CLI), the official Figma MCP `use_figma` tool.

## Global Constraints

- **Module system:** ESM. Import local files with `.js` specifiers (e.g. `import { x } from "./types.js"`), matching every existing engine file.
- **Engine purity (isomorphism guard):** files listed in `src/engine/isomorphism.test.ts`'s `PURE` array must not import `node:*`, `fs`, or `path`. `culori` is allowed (browser-safe). New pure files added to the engine that this plan guards: `figma-names.ts`.
- **Token value shape (verbatim):** primitive color tokens are `{ $type: "color", $value: { colorSpace: "oklch", components: [l, c, h], alpha? } }`.
- **Figma scope:** `primitives-color` collection only, single mode `mode-1`. **Update variables in place; create only genuinely-new ones; never prune.** The semantic `color` collection stays Figma-owned and is never written.
- **Color math location:** OKLCH→sRGB conversion happens in the engine (`culori`). The `use_figma` script carries no color library — it only sets `{r,g,b,a}` values (each channel in `[0,1]`, alpha in `[0,1]`) it is handed.
- **Figma variable naming:** match existing variables by `normalizeName(figmaName) === tokenKey`; create new variables using the flat `tokenKey` (e.g. `color-accent-500`). Pretty slash-path grouping is display-only, owned by the separate exporter repo, does not affect in-place matching, and is **out of scope** here.
- **Inputs:** structured only; no natural-language inference. Any `ThemeInputs` field not supplied is filled from the current `theme.config.ts` via `resolveInputs`. The resolved, complete `ThemeInputs` is validated before any write.
- **Safety:** the Figma write is two-phase — a read-only **preview** (update/create counts + would-create-new list) shown to the user for **confirmation**, then a separate **apply**. No implicit git commits.

---

## File Structure

**Create (pure engine helpers, `src/**/*.test.ts` picked up by vitest):**
- `src/engine/hex-input.ts` (+ `.test.ts`) — `hexToOklch`, `hexToHueSeed`.
- `src/engine/figma-names.ts` (+ `.test.ts`) — `normalizeName`.
- `src/engine/config-source.ts` (+ `.test.ts`) — `serializeConfig`.
- `src/engine/resolve-inputs.ts` (+ `.test.ts`) — `resolveInputs`, `DeepPartialInputs`.
- `src/engine/validate-inputs.ts` (+ `.test.ts`) — `validateInputs`, `ValidationResult`.

**Modify:**
- `src/engine/figma-export.ts` — add `dtcgColorToSrgb`, `buildFigmaVariablePlan`, `FigmaVariablePlan`, `FigmaVariablePlanEntry`.
- `src/engine/figma-export.test.ts` — add `buildFigmaVariablePlan` tests.
- `src/engine/isomorphism.test.ts` — add `"figma-names.ts"` to `PURE`.
- `src/engine/index.ts` — re-export the new modules.
- `package.json` — add `generate:theme` script.

**Create (thin I/O + orchestration, not vitest-tested):**
- `scripts/generateTheme.ts` — CLI wrapper.
- `.claude/skills/generate-color-theme/SKILL.md` — the Claude skill + embedded `use_figma` preview/apply templates.

---

## Task 1: `hexToOklch` / `hexToHueSeed` (structured hex → engine seeds)

**Files:**
- Create: `src/engine/hex-input.ts`
- Test: `src/engine/hex-input.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: `Oklch`, `HueSeed` from `./types.js`.
- Produces:
  - `hexToOklch(hex: string): Oklch` — full-precision OKLCH of a CSS hex (for verbatim `brand`). Throws `Error` on unparseable input.
  - `hexToHueSeed(hex: string): HueSeed` — `{ hue, chroma }` derived from the hex (for accent/status seeds). Throws on unparseable input.

- [ ] **Step 1: Write the failing test**

Create `src/engine/hex-input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hexToOklch, hexToHueSeed } from "./hex-input.js";

describe("hexToOklch", () => {
  it("converts a green hex to full-precision OKLCH", () => {
    const o = hexToOklch("#16a34a");
    expect(o.l).toBeCloseTo(0.627052, 4);
    expect(o.c).toBeCloseTo(0.169912, 4);
    expect(o.h).toBeCloseTo(149.213796, 3);
  });

  it("converts a blue hex to full-precision OKLCH", () => {
    const o = hexToOklch("#2563eb");
    expect(o.l).toBeCloseTo(0.54615, 4);
    expect(o.c).toBeCloseTo(0.215208, 4);
    expect(o.h).toBeCloseTo(262.880919, 3);
  });

  it("returns hue 0 and chroma 0 for pure gray", () => {
    const o = hexToOklch("#808080");
    expect(o.c).toBeCloseTo(0, 4);
    expect(o.h).toBe(0);
  });

  it("throws on an unparseable string", () => {
    expect(() => hexToOklch("not-a-color")).toThrow();
  });
});

describe("hexToHueSeed", () => {
  it("returns the hue and chroma of the hex", () => {
    const s = hexToHueSeed("#16a34a");
    expect(s.hue).toBeCloseTo(149.213796, 3);
    expect(s.chroma).toBeCloseTo(0.169912, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/hex-input.test.ts`
Expected: FAIL — cannot find module `./hex-input.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/hex-input.ts`:

```ts
import { oklch } from "culori";
import type { Oklch, HueSeed } from "./types.js";

/** Full-precision OKLCH of a CSS color string (hex, rgb(), etc.). Throws if unparseable. */
export function hexToOklch(hex: string): Oklch {
  const o = oklch(hex);
  if (!o) throw new Error(`hexToOklch: could not parse color "${hex}"`);
  return { l: o.l, c: o.c ?? 0, h: o.h ?? 0 };
}

/** Hue + chroma seed derived from a CSS color string. Throws if unparseable. */
export function hexToHueSeed(hex: string): HueSeed {
  const { c, h } = hexToOklch(hex);
  return { hue: h, chroma: c };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/hex-input.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Re-export from the engine index**

In `src/engine/index.ts`, add after the existing exports:

```ts
export * from "./hex-input.js";
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/hex-input.ts src/engine/hex-input.test.ts src/engine/index.ts
git commit -m "feat(engine): hex → OKLCH / HueSeed input helpers"
```

---

## Task 2: `normalizeName` (Figma variable match key)

**Files:**
- Create: `src/engine/figma-names.ts`
- Test: `src/engine/figma-names.test.ts`
- Modify: `src/engine/isomorphism.test.ts`, `src/engine/index.ts`

**Interfaces:**
- Produces: `normalizeName(name: string): string` — lowercases, maps `/` and whitespace runs to `-`, collapses repeated `-`, trims leading/trailing `-`. Used to match an existing Figma variable name back to a flat token key.

- [ ] **Step 1: Write the failing test**

Create `src/engine/figma-names.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeName } from "./figma-names.js";

describe("normalizeName", () => {
  it("maps a slash path to the flat token key", () => {
    expect(normalizeName("color/neutral/700")).toBe("color-neutral-700");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("Color / Neutral / 700")).toBe("color-neutral-700");
  });

  it("leaves an already-flat key unchanged", () => {
    expect(normalizeName("color-accent-500")).toBe("color-accent-500");
  });

  it("collapses repeated separators and trims", () => {
    expect(normalizeName("/color//neutral/dark-surface/3/")).toBe("color-neutral-dark-surface-3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/figma-names.test.ts`
Expected: FAIL — cannot find module `./figma-names.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/figma-names.ts`:

```ts
/**
 * Normalize a Figma variable name to the pipeline's flat token key.
 * `color/neutral/700` → `color-neutral-700`. This is the match key used to
 * update existing variables in place; it must be the inverse of any pretty
 * slash-path grouping applied on the Figma side.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/figma-names.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the file to the isomorphism guard**

In `src/engine/isomorphism.test.ts`, extend the `PURE` array (add `"figma-names.ts"`):

```ts
const PURE = [
  "types.ts", "contrast-input.ts", "steps.ts", "ramps.ts",
  "contrast.ts", "derived.ts", "semantics.ts", "index.ts",
  "dtcg.ts", "figma-export.ts", "figma-names.ts",
];
```

- [ ] **Step 6: Re-export from the engine index**

In `src/engine/index.ts`, add:

```ts
export * from "./figma-names.js";
```

- [ ] **Step 7: Run the guard + name tests**

Run: `npx vitest run src/engine/figma-names.test.ts src/engine/isomorphism.test.ts`
Expected: PASS (including the new `figma-names.ts has no node-only imports` case).

- [ ] **Step 8: Commit**

```bash
git add src/engine/figma-names.ts src/engine/figma-names.test.ts src/engine/isomorphism.test.ts src/engine/index.ts
git commit -m "feat(engine): normalizeName + isomorphism guard entry"
```

---

## Task 3: `dtcgColorToSrgb` + `buildFigmaVariablePlan` (the flat write-plan)

**Files:**
- Modify: `src/engine/figma-export.ts`
- Test: `src/engine/figma-export.test.ts`

**Interfaces:**
- Consumes: `ThemeInputs` from `./types.js`; `buildPrimitivesDtcg` from `./dtcg.js`.
- Produces:
  - `dtcgColorToSrgb(value: { colorSpace: string; components: number[]; alpha?: number }): { r: number; g: number; b: number; a: number }` — OKLCH DTCG value → sRGB, each channel clamped to `[0,1]`, `a` defaults to `1`.
  - `interface FigmaVariablePlanEntry { tokenKey: string; type: "COLOR"; valuesByMode: { "mode-1": { r: number; g: number; b: number; a: number } } }`
  - `interface FigmaVariablePlan { collection: "primitives-color"; modes: ["mode-1"]; variables: FigmaVariablePlanEntry[] }`
  - `buildFigmaVariablePlan(inputs: ThemeInputs): FigmaVariablePlan`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/figma-export.test.ts` (the file already imports `INPUTS`; add the new imports and block):

```ts
import { buildFigmaVariablePlan, dtcgColorToSrgb } from "./figma-export.js";

describe("dtcgColorToSrgb", () => {
  it("converts an OKLCH value to clamped sRGB with default alpha 1", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(c.r).toBeCloseTo(0.271255, 4);
    expect(c.g).toBeCloseTo(0.440745, 4);
    expect(c.b).toBeCloseTo(0.210346, 4);
    expect(c.a).toBe(1);
  });

  it("passes alpha through", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.13, 0, 0], alpha: 0.12 });
    expect(c.a).toBeCloseTo(0.12, 4);
    expect(c.r).toBeCloseTo(0.028385, 4);
  });

  it("clamps out-of-sRGB-gamut channels into [0,1]", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.99, 0.01, 208] });
    expect(c.b).toBe(1);
    for (const ch of [c.r, c.g, c.b]) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildFigmaVariablePlan", () => {
  const plan = buildFigmaVariablePlan(INPUTS);

  it("targets the primitives-color collection, mode-1 only", () => {
    expect(plan.collection).toBe("primitives-color");
    expect(plan.modes).toEqual(["mode-1"]);
  });

  it("emits one entry per primitive token, flat keys, all COLOR", () => {
    const keys = plan.variables.map((v) => v.tokenKey);
    expect(keys).toContain("color-accent-500");
    expect(keys).toContain("color-neutral-700");
    expect(keys.every((k) => !k.includes("/"))).toBe(true);
    expect(plan.variables.every((v) => v.type === "COLOR")).toBe(true);
  });

  it("every value is sRGB in [0,1] with an alpha", () => {
    for (const v of plan.variables) {
      const c = v.valuesByMode["mode-1"];
      for (const ch of [c.r, c.g, c.b, c.a]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/figma-export.test.ts`
Expected: FAIL — `buildFigmaVariablePlan`/`dtcgColorToSrgb` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/figma-export.ts`, add the `culori` and `buildPrimitivesDtcg` imports at the top and append the new exports:

```ts
import { rgb } from "culori";
import { buildPrimitivesDtcg } from "./dtcg.js";

export interface FigmaVariablePlanEntry {
  tokenKey: string;
  type: "COLOR";
  valuesByMode: { "mode-1": { r: number; g: number; b: number; a: number } };
}

export interface FigmaVariablePlan {
  collection: "primitives-color";
  modes: ["mode-1"];
  variables: FigmaVariablePlanEntry[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** OKLCH DTCG value → sRGB {r,g,b,a}, channels clamped to [0,1], alpha default 1. */
export function dtcgColorToSrgb(value: {
  colorSpace: string;
  components: number[];
  alpha?: number;
}): { r: number; g: number; b: number; a: number } {
  const [l, c, h] = value.components;
  const srgb = rgb({ mode: "oklch", l, c, h });
  return {
    r: clamp01(srgb.r),
    g: clamp01(srgb.g),
    b: clamp01(srgb.b),
    a: value.alpha ?? 1,
  };
}

/** Flat, Figma-write-ready plan for the primitives-color collection. */
export function buildFigmaVariablePlan(inputs: ThemeInputs): FigmaVariablePlan {
  const primitives = buildPrimitivesDtcg(inputs) as Record<
    string,
    { $value: { colorSpace: string; components: number[]; alpha?: number } }
  >;
  const variables: FigmaVariablePlanEntry[] = Object.entries(primitives).map(
    ([tokenKey, token]) => ({
      tokenKey,
      type: "COLOR",
      valuesByMode: { "mode-1": dtcgColorToSrgb(token.$value) },
    }),
  );
  return { collection: "primitives-color", modes: ["mode-1"], variables };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/figma-export.test.ts`
Expected: PASS (existing bundle tests + the new `dtcgColorToSrgb` and `buildFigmaVariablePlan` blocks).

- [ ] **Step 5: Run the isomorphism guard (culori must not trip it)**

Run: `npx vitest run src/engine/isomorphism.test.ts`
Expected: PASS — `figma-export.ts has no node-only imports` still green (culori is not a node import).

- [ ] **Step 6: Commit**

```bash
git add src/engine/figma-export.ts src/engine/figma-export.test.ts
git commit -m "feat(engine): buildFigmaVariablePlan + OKLCH→sRGB conversion"
```

---

## Task 4: `serializeConfig` (ThemeInputs → theme.config.ts source)

**Files:**
- Create: `src/engine/config-source.ts`
- Test: `src/engine/config-source.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: `ThemeInputs` from `./types.js`.
- Produces: `serializeConfig(inputs: ThemeInputs): string` — a valid `theme.config.ts` module string with a default export. (The color studio has its own equivalent copy; this is the repo-side one the CLI uses. Deduping across the package boundary is out of scope.)

- [ ] **Step 1: Write the failing test**

Create `src/engine/config-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serializeConfig } from "./config-source.js";
import type { ThemeInputs } from "./types.js";

const INPUTS: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: 0.5,
  accents: { primary: { hue: 151, chroma: 0.19 } },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
};

describe("serializeConfig", () => {
  it("produces a parseable default-export module string", () => {
    const src = serializeConfig(INPUTS);
    expect(src).toContain("const themeInputs: ThemeInputs");
    expect(src).toContain("export default themeInputs;");
    expect(src).toContain('"hue": 151');
  });

  it("round-trips the numbers via the embedded JSON", () => {
    const src = serializeConfig(INPUTS);
    const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    expect(JSON.parse(json)).toEqual(INPUTS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/config-source.test.ts`
Expected: FAIL — cannot find module `./config-source.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/config-source.ts`:

```ts
import type { ThemeInputs } from "./types.js";

/** Emit a valid theme.config.ts source string for the given inputs. */
export function serializeConfig(inputs: ThemeInputs): string {
  const body = JSON.stringify(inputs, null, 2);
  return `type ThemeInputs = import("./src/engine/types.js").ThemeInputs;

const themeInputs: ThemeInputs = ${body};

export default themeInputs;
`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/config-source.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Re-export from the engine index**

In `src/engine/index.ts`, add:

```ts
export * from "./config-source.js";
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/config-source.ts src/engine/config-source.test.ts src/engine/index.ts
git commit -m "feat(engine): serializeConfig (ThemeInputs → theme.config.ts source)"
```

---

## Task 5: `resolveInputs` (merge partial structured inputs over the base config)

**Files:**
- Create: `src/engine/resolve-inputs.ts`
- Test: `src/engine/resolve-inputs.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: `ThemeInputs`, `HueSeed`, `Oklch`, `ContrastInput` from `./types.js`.
- Produces:
  - `type DeepPartialInputs` — a nested-optional view of `ThemeInputs` (see code).
  - `resolveInputs(partial: DeepPartialInputs, base: ThemeInputs): ThemeInputs` — shallow-merges each nested group (`neutral`, `accents`, `status`, `brand`, `darkSurfaces`) of `partial` over `base`; scalars replace; omitted groups keep `base`. Completeness is enforced later by `validateInputs`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/resolve-inputs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveInputs } from "./resolve-inputs.js";
import type { ThemeInputs } from "./types.js";

const BASE: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: "default",
  accents: {
    primary: { hue: 151, chroma: 0.19 },
    secondary: { hue: 70, chroma: 0.135 },
  },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
  darkSurfaces: { base: 0.095, step: 0.034 },
};

describe("resolveInputs", () => {
  it("returns the base unchanged for an empty partial", () => {
    expect(resolveInputs({}, BASE)).toEqual(BASE);
  });

  it("overrides only the supplied accent slot, keeping the rest", () => {
    const out = resolveInputs({ accents: { primary: { hue: 20, chroma: 0.2 } } }, BASE);
    expect(out.accents.primary).toEqual({ hue: 20, chroma: 0.2 });
    expect(out.accents.secondary).toEqual({ hue: 70, chroma: 0.135 });
    expect(out.status).toEqual(BASE.status);
  });

  it("merges a single dark-surface dial over the base", () => {
    const out = resolveInputs({ darkSurfaces: { base: 0.08 } }, BASE);
    expect(out.darkSurfaces).toEqual({ base: 0.08, step: 0.034 });
  });

  it("replaces a scalar (contrast)", () => {
    expect(resolveInputs({ contrast: 0.8 }, BASE).contrast).toBe(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/resolve-inputs.test.ts`
Expected: FAIL — cannot find module `./resolve-inputs.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/resolve-inputs.ts`:

```ts
import type { ThemeInputs, HueSeed, Oklch, ContrastInput } from "./types.js";

type Slots<T> = { primary?: T; secondary?: T; tertiary?: T };

export interface DeepPartialInputs {
  neutral?: Partial<HueSeed>;
  contrast?: ContrastInput;
  accents?: Slots<HueSeed>;
  status?: Partial<{ success: HueSeed; error: HueSeed; warning: HueSeed; info: HueSeed }>;
  brand?: Slots<Oklch>;
  darkSurfaces?: Partial<{ base: number; step: number }>;
  alpha?: boolean;
}

/** Merge a partial set of structured inputs over a complete base ThemeInputs. */
export function resolveInputs(partial: DeepPartialInputs, base: ThemeInputs): ThemeInputs {
  const out: ThemeInputs = {
    ...base,
    ...(partial.contrast !== undefined ? { contrast: partial.contrast } : {}),
    ...(partial.alpha !== undefined ? { alpha: partial.alpha } : {}),
    neutral: { ...base.neutral, ...partial.neutral },
    accents: { ...base.accents, ...partial.accents },
    status: { ...base.status, ...partial.status },
  };
  if (partial.brand || base.brand) out.brand = { ...base.brand, ...partial.brand };
  if (partial.darkSurfaces || base.darkSurfaces) {
    out.darkSurfaces = { ...base.darkSurfaces, ...partial.darkSurfaces } as ThemeInputs["darkSurfaces"];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/resolve-inputs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Re-export from the engine index**

In `src/engine/index.ts`, add:

```ts
export * from "./resolve-inputs.js";
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/resolve-inputs.ts src/engine/resolve-inputs.test.ts src/engine/index.ts
git commit -m "feat(engine): resolveInputs (partial structured inputs over base config)"
```

---

## Task 6: `validateInputs` (fail fast before any write)

**Files:**
- Create: `src/engine/validate-inputs.ts`
- Test: `src/engine/validate-inputs.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: `ThemeInputs` from `./types.js`.
- Produces:
  - `type ValidationResult = { ok: true } | { ok: false; errors: string[] }`
  - `validateInputs(inputs: ThemeInputs): ValidationResult` — verifies required seeds are present, every `hue ∈ [0,360]`, every `chroma ≥ 0`, and `contrast` is a number in `[0,1]` or one of `"low" | "default" | "high"`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/validate-inputs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateInputs } from "./validate-inputs.js";
import type { ThemeInputs } from "./types.js";

const OK: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: "default",
  accents: { primary: { hue: 151, chroma: 0.19 } },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
};

describe("validateInputs", () => {
  it("accepts a complete, in-range input", () => {
    expect(validateInputs(OK)).toEqual({ ok: true });
  });

  it("accepts a numeric contrast in [0,1]", () => {
    expect(validateInputs({ ...OK, contrast: 0.5 })).toEqual({ ok: true });
  });

  it("rejects an out-of-range hue", () => {
    const r = validateInputs({ ...OK, neutral: { hue: 400, chroma: 0.01 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/hue/);
  });

  it("rejects a negative chroma", () => {
    const r = validateInputs({ ...OK, accents: { primary: { hue: 151, chroma: -0.1 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/chroma/);
  });

  it("rejects an out-of-range numeric contrast", () => {
    const r = validateInputs({ ...OK, contrast: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/contrast/);
  });

  it("rejects a missing required status seed", () => {
    const bad = { ...OK, status: { ...OK.status } } as ThemeInputs;
    // @ts-expect-error deliberately drop a required seed
    delete bad.status.error;
    const r = validateInputs(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/error/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/validate-inputs.test.ts`
Expected: FAIL — cannot find module `./validate-inputs.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/validate-inputs.ts`:

```ts
import type { ThemeInputs, HueSeed } from "./types.js";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const CONTRAST_WORDS = new Set(["low", "default", "high"]);

function checkSeed(label: string, seed: HueSeed | undefined, errors: string[]): void {
  if (!seed) {
    errors.push(`${label}: missing`);
    return;
  }
  if (typeof seed.hue !== "number" || seed.hue < 0 || seed.hue > 360) {
    errors.push(`${label}: hue must be a number in [0,360] (got ${seed.hue})`);
  }
  if (typeof seed.chroma !== "number" || seed.chroma < 0) {
    errors.push(`${label}: chroma must be a number >= 0 (got ${seed.chroma})`);
  }
}

/** Validate a fully-resolved ThemeInputs. Returns all problems at once. */
export function validateInputs(inputs: ThemeInputs): ValidationResult {
  const errors: string[] = [];

  checkSeed("neutral", inputs.neutral, errors);
  checkSeed("accents.primary", inputs.accents?.primary, errors);
  for (const slot of ["secondary", "tertiary"] as const) {
    if (inputs.accents?.[slot]) checkSeed(`accents.${slot}`, inputs.accents[slot], errors);
  }
  for (const key of ["success", "error", "warning", "info"] as const) {
    checkSeed(`status.${key}`, inputs.status?.[key], errors);
  }

  const c = inputs.contrast;
  const contrastOk =
    (typeof c === "number" && c >= 0 && c <= 1) ||
    (typeof c === "string" && CONTRAST_WORDS.has(c));
  if (!contrastOk) {
    errors.push(`contrast: must be a number in [0,1] or one of low|default|high (got ${String(c)})`);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/validate-inputs.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Re-export from the engine index**

In `src/engine/index.ts`, add:

```ts
export * from "./validate-inputs.js";
```

- [ ] **Step 6: Full engine test sweep + commit**

Run: `npm test`
Expected: PASS — the whole suite green (all new modules + untouched engine).

```bash
git add src/engine/validate-inputs.ts src/engine/validate-inputs.test.ts src/engine/index.ts
git commit -m "feat(engine): validateInputs (fail fast on out-of-range structured inputs)"
```

---

## Task 7: `scripts/generateTheme.ts` (thin I/O CLI)

**Files:**
- Create: `scripts/generateTheme.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `resolveInputs`, `validateInputs`, `serializeConfig`, `serializeTokenBundle`, `buildFigmaVariablePlan` from `../src/engine/index.js`; `writeGeneratedTokens` from `../src/engine/emit-dtcg.js`; the default export of `../theme.config.js`.
- Produces: a CLI. Reads a partial-`ThemeInputs` JSON from `--input <file>` or stdin (empty ⇒ `{}`), resolves it over `theme.config.ts`, validates, then acts on flags: `--write-config`, `--build`, `--emit-bundle`, `--emit-figma-plan`. Only the `--emit-*` payload goes to stdout; all logs go to stderr. Exits `1` with printed errors on validation failure.

- [ ] **Step 1: Write the implementation**

Create `scripts/generateTheme.ts`:

```ts
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  resolveInputs,
  validateInputs,
  serializeConfig,
  serializeTokenBundle,
  buildFigmaVariablePlan,
  type DeepPartialInputs,
} from "../src/engine/index.js";
import { writeGeneratedTokens } from "../src/engine/emit-dtcg.js";
import baseInputs from "../theme.config.js";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    "write-config": { type: "boolean" },
    build: { type: "boolean" },
    "emit-bundle": { type: "boolean" },
    "emit-figma-plan": { type: "boolean" },
  },
});

function readPartial(): DeepPartialInputs {
  const raw = values.input
    ? readFileSync(values.input, "utf-8")
    : readFileSync(0, "utf-8").trim(); // fd 0 = stdin
  if (!raw) return {};
  return JSON.parse(raw) as DeepPartialInputs;
}

function main(): void {
  const partial = readPartial();
  const resolved = resolveInputs(partial, baseInputs);

  const check = validateInputs(resolved);
  if (!check.ok) {
    console.error("✖ Invalid theme inputs:");
    for (const e of check.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (values["write-config"]) {
    const { writeFileSync } = require("node:fs") as typeof import("node:fs");
    writeFileSync("theme.config.ts", serializeConfig(resolved));
    console.error("✅ wrote theme.config.ts");
  }
  if (values.build) {
    writeGeneratedTokens(resolved, "src/tokens");
    console.error("✅ wrote src/tokens/ (primitives + semantic color)");
  }
  if (values["emit-bundle"]) {
    process.stdout.write(serializeTokenBundle(resolved));
  }
  if (values["emit-figma-plan"]) {
    process.stdout.write(JSON.stringify(buildFigmaVariablePlan(resolved), null, 2));
  }
}

main();
```

> Note: `require` is used for the write path only so that `--emit-*`-only runs never import `node:fs`'s writer implicitly; `readFileSync`/`parseArgs` stay top-level imports. If your ESM config disallows `require`, replace the two lines with a top-level `import { writeFileSync } from "node:fs";` alongside `readFileSync`.

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, add after `build:theme`:

```json
"generate:theme": "npx tsx scripts/generateTheme.ts",
```

- [ ] **Step 3: Verify `--emit-figma-plan` produces a valid plan**

Run:
```bash
echo '{"accents":{"primary":{"hue":149,"chroma":0.17}}}' | npx tsx scripts/generateTheme.ts --emit-figma-plan | npx tsx -e 'const p=JSON.parse(require("node:fs").readFileSync(0,"utf-8")); console.log(p.collection, p.modes.join(","), p.variables.length, p.variables.some(v=>v.tokenKey==="color-accent-500"))'
```
Expected: prints `primitives-color mode-1 <N> true` (N > 0), confirming the collection, mode, non-empty variables, and the retuned accent key are present.

- [ ] **Step 4: Verify `--emit-bundle` equals the engine's `serializeTokenBundle`**

Run:
```bash
echo '{}' | npx tsx scripts/generateTheme.ts --emit-bundle | head -c 40
```
Expected: begins with `{\n  "manifest": {` — the same pretty-printed bundle the studio copies.

- [ ] **Step 5: Verify validation fails fast**

Run:
```bash
echo '{"neutral":{"hue":999,"chroma":0.01}}' | npx tsx scripts/generateTheme.ts --emit-figma-plan; echo "exit=$?"
```
Expected: stderr prints `✖ Invalid theme inputs:` with a `hue` error, no stdout plan, and `exit=1`.

- [ ] **Step 6: Verify the repo write path is idempotent (no drift on a no-op)**

Run:
```bash
echo '{}' | npx tsx scripts/generateTheme.ts --build && git diff --stat src/tokens/
```
Expected: `--build` regenerates from the current config; `git diff --stat` shows no changes (the committed tokens already match `theme.config.ts`). If your working tree had pending token edits this may differ — run on a clean tree.

- [ ] **Step 7: Commit**

```bash
git add scripts/generateTheme.ts package.json
git commit -m "feat(cli): generateTheme — structured inputs → config/tokens/bundle/figma-plan"
```

---

## Task 8: Claude skill `generate-color-theme` (+ `use_figma` preview/apply templates)

**Files:**
- Create: `.claude/skills/generate-color-theme/SKILL.md`

**Interfaces:**
- Consumes: the `generate:theme` CLI (Task 7); the official Figma MCP `use_figma` tool; the mandatory `figma-use` skill.
- Produces: a user-invocable skill that (1) collects structured inputs, (2) resolves + confirms the complete `ThemeInputs`, (3) runs the repo path, and (4) runs the two-phase Figma write (preview → confirm → apply).

- [ ] **Step 1: Write the skill file**

Create `.claude/skills/generate-color-theme/SKILL.md`:

````markdown
---
name: generate-color-theme
description: Generate a color theme from structured inputs (brand hex(es), contrast, neutral tint) using this repo's color engine, then write repo tokens/CSS and/or update the Figma primitives-color variables in place via the Figma MCP. Use when the user wants to retheme, rebrand, or push generated primitive color variables into Figma without the studio UI.
---

# Generate Color Theme

Drives `scripts/generateTheme.ts` (the color engine) from structured inputs and, optionally, writes the generated `primitives-color` variables into a Figma file in place via the official Figma MCP. `theme.config.ts` is the single source of truth; unspecified fields default from it.

## Inputs (structured only — never infer from vibes)

Collect from the user:
- **Brand hex(es):** one per accent slot (`primary`, optional `secondary`, `tertiary`). Each hex becomes both an accent seed (hue + chroma) and a verbatim `brand` color.
- **Contrast:** a number in `[0,1]` or one of `low` | `default` | `high`.
- **Neutral tint (optional):** `{ hue, chroma }` for the gray.
- **Status seeds / dark-surface dials / alpha (optional):** default from `theme.config.ts` if omitted.

Build a **partial** `ThemeInputs` JSON. To turn a brand hex into the two fields, use the engine helpers (run once via `npx tsx -e`), do NOT eyeball values:

```bash
npx tsx -e 'import{hexToHueSeed,hexToOklch}from"./src/engine/index.js";const h=process.argv[1];console.log(JSON.stringify({seed:hexToHueSeed(h),brand:hexToOklch(h)}))' "#16a34a"
```

Assemble e.g.:
```json
{ "accents": { "primary": { "hue": 149.2, "chroma": 0.17 } },
  "brand": { "primary": { "l": 0.627, "c": 0.17, "h": 149.2 } },
  "contrast": "default" }
```

## Step 1 — Confirm the resolved inputs

Resolve + echo the COMPLETE inputs (including every defaulted field) and show them to the user for approval before writing anything:

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-bundle >/dev/null && echo "inputs valid"
```
If validation fails, the CLI prints the errors to stderr and exits 1 — fix the inputs and retry. Present the resolved `ThemeInputs` and wait for a go-ahead.

## Step 2 — Repo path (if the user wants tokens/CSS)

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --write-config --build
npm run build:tokens   # optional: regenerate dist/css
```
Report the changed files. Do not commit unless asked.

## Step 3 — Figma path (if the user wants variables updated)

**MANDATORY:** load the `figma-use` skill BEFORE any `use_figma` call, and adapt the API calls below to whatever the current Plugin API in that skill specifies.

First emit the plan and keep it:
```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-figma-plan > /tmp/figma-plan.json
```

### 3a. PREVIEW (read-only) — via `use_figma`

Inject the plan JSON as `PLAN` and run this **read-only** script; show the returned summary to the user and get confirmation. It writes nothing.

```js
const PLAN = /* paste the FigmaVariablePlan JSON */;
const norm = (n) => n.toLowerCase().replace(/[\s/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const collection = collections.find((c) => c.name === PLAN.collection);
let existingKeys = new Set();
if (collection) {
  const vars = await figma.variables.getLocalVariablesAsync("COLOR");
  existingKeys = new Set(
    vars.filter((v) => v.variableCollectionId === collection.id).map((v) => norm(v.name)),
  );
}
const willCreate = PLAN.variables.filter((e) => !existingKeys.has(e.tokenKey)).map((e) => e.tokenKey);
const willUpdate = PLAN.variables.filter((e) => existingKeys.has(e.tokenKey)).length;
return {
  collectionExists: Boolean(collection),
  update: willUpdate,
  create: willCreate.length,
  wouldCreateNew: willCreate,
};
```

Surface `wouldCreateNew` prominently: any entry there means the variable was NOT matched (likely a Figma-side rename) and will be created fresh rather than updated. Only proceed on explicit approval.

### 3b. APPLY (writes) — via `use_figma`

```js
const PLAN = /* paste the FigmaVariablePlan JSON */;
const norm = (n) => n.toLowerCase().replace(/[\s/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
let collections = await figma.variables.getLocalVariableCollectionsAsync();
let collection = collections.find((c) => c.name === PLAN.collection);
if (!collection) collection = figma.variables.createVariableCollection(PLAN.collection);
const mode = collection.modes.find((m) => m.name === "mode-1") ?? collection.modes[0];
const modeId = mode.modeId;

const allVars = await figma.variables.getLocalVariablesAsync("COLOR");
const byKey = new Map(
  allVars.filter((v) => v.variableCollectionId === collection.id).map((v) => [norm(v.name), v]),
);

let updated = 0, created = 0;
for (const entry of PLAN.variables) {
  let v = byKey.get(entry.tokenKey);
  if (!v) { v = figma.variables.createVariable(entry.tokenKey, collection, "COLOR"); created++; }
  else { updated++; }
  const { r, g, b, a } = entry.valuesByMode["mode-1"];
  v.setValueForMode(modeId, { r, g, b, a });
}
return { updated, created }; // never prunes; semantic `color` collection untouched
```

Report `{ updated, created }` back to the user.

## Guarantees & non-goals
- Writes **only** `primitives-color`; the semantic `color` collection is Figma-owned and never touched.
- **Never prunes** variables absent from the plan.
- OKLCH→sRGB is done in the engine; this skill's Figma scripts carry no color library.
- No natural-language inference; no implicit git commits.
````

- [ ] **Step 2: Verify the skill is discoverable**

Run: `test -f .claude/skills/generate-color-theme/SKILL.md && head -5 .claude/skills/generate-color-theme/SKILL.md`
Expected: prints the YAML frontmatter (`name: generate-color-theme`). In a fresh Claude Code session the skill then appears in the available-skills list.

- [ ] **Step 3: Dry-run the preview logic against the emitted plan (no Figma needed)**

Run:
```bash
echo '{}' | npx tsx scripts/generateTheme.ts --emit-figma-plan > /tmp/figma-plan.json && \
npx tsx -e 'const p=JSON.parse(require("node:fs").readFileSync("/tmp/figma-plan.json","utf-8"));const norm=n=>n.toLowerCase().replace(/[\s/]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");const existing=new Set();const create=p.variables.filter(e=>!existing.has(e.tokenKey)).map(e=>e.tokenKey);console.log("create",create.length,"update",p.variables.length-create.length)'
```
Expected: `create <N> update 0` on a file with no pre-existing variables (empty `existing` set) — confirms the preview arithmetic the `use_figma` script uses. On a real first import every token is a create; on a re-run every token matches and becomes an update.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/generate-color-theme/SKILL.md
git commit -m "feat(skill): generate-color-theme — engine CLI + Figma MCP preview/apply"
```

---

## Self-Review Notes

**Spec coverage:**
- CLI wrapper + operations → Task 7. `buildFigmaVariablePlan` + OKLCH→sRGB in engine → Task 3. Ported name helper → Task 2 (`normalizeName`; `groupedFigmaName` intentionally dropped — see Global Constraints, grouping is display-only and not in this repo). Skill + `figma-use` prerequisite → Task 8. `use_figma` write template with preview→confirm→apply → Task 8 (3a/3b). Structured-input mapping incl. hex → Task 1; defaulting via `resolveInputs` → Task 5; fail-fast validation → Task 6; `serializeConfig` for `--write-config` → Task 4.
- Testing section of the spec: plan invariants + sRGB range → Task 3; name round-trip/normalization → Task 2; `--emit-bundle` equals `serializeTokenBundle` → Task 7 Step 4; `--emit-figma-plan` schema → Task 7 Step 3; `serializeConfig` round-trip → Task 4.
- Stage 3 (MCP server) is explicitly deferred in the spec and correctly has no task.

**Deviations from spec (intentional, within spec intent):** the `FigmaVariablePlan` carries only `tokenKey` (no grouped `figmaName`), because the exporter's `groupedFigmaName` lives in a repo not present here and grouping does not affect name-based in-place matching. Matching normalizes existing Figma names back to the flat key; new variables are created flat. This preserves the spec's update-in-place, name-based-match, never-prune contract.

**Type consistency:** `DeepPartialInputs` (Task 5) is the CLI's input type (Task 7). `FigmaVariablePlan`/`FigmaVariablePlanEntry` (Task 3) are consumed verbatim by the `use_figma` scripts (Task 8). `normalizeName` (Task 2) is duplicated as an inline `norm` in the Figma scripts by necessity (the Plugin sandbox can't import the engine) — kept byte-identical to the engine function.
