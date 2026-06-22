# Figma Token Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Copy tokens for Figma" button to the color studio that copies the generated tokens to the clipboard as a single JSON bundle mirroring the project's native DTCG + manifest format.

**Architecture:** Extract the pure DTCG token assembly out of the Node-only `emit-dtcg.ts` into a new pure module `dtcg.ts` (shared by the disk writer and the browser). Add a pure `figma-export.ts` that wraps the assembled files in a manifest-shaped bundle. Wire a studio button that serializes the bundle and writes it to the clipboard. oklch values are emitted verbatim; oklch→sRGB conversion is the importer's job and is not built here.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, culori, Vite (studio).

## Global Constraints

- **Engine purity:** new engine modules (`dtcg.ts`, `figma-export.ts`) MUST NOT import `node:*`, `fs`, or `path`. They must be added to the `PURE` list in `src/engine/isomorphism.test.ts`.
- **Import specifiers:** intra-engine imports use explicit `.js` extensions (e.g. `from "./dtcg.js"`).
- **Test runner:** `npm test` runs `vitest run`. Engine tests are colocated as `src/engine/<name>.test.ts` and import via relative `./` paths.
- **No behavior change to existing output:** `writeGeneratedTokens` must still produce byte-identical files (same `$description` banner, same key order, trailing `\n`).
- **Studio engine import:** the studio imports the engine via the Vite alias `@project` → repo root (e.g. `@project/src/engine/index.js`). The `@project` alias is NOT available under root `vitest`, so do not add a vitest test that imports through it.
- **Color values stay oklch:** the exporter performs no hex/sRGB conversion.

---

### Task 1: Extract pure DTCG assembly + `buildGeneratedFiles`

Move the pure token-assembly functions out of the Node-only `emit-dtcg.ts` into a new pure `dtcg.ts`, add `buildGeneratedFiles` (which owns the `$description` banner), and reimplement `writeGeneratedTokens` to consume it. `emit-dtcg.ts` re-exports the moved functions so existing imports keep working.

**Files:**
- Create: `src/engine/dtcg.ts`
- Modify: `src/engine/emit-dtcg.ts` (replace its body)
- Modify: `src/engine/index.ts` (add `export * from "./dtcg.js";`)
- Modify: `src/engine/isomorphism.test.ts:5-8` (add `"dtcg.ts"` to `PURE`)
- Test: `src/engine/dtcg.test.ts` (new — covers `buildGeneratedFiles`)
- Untouched but must still pass: `src/engine/emit-dtcg.test.ts`, `src/engine/build-theme.test.ts`

**Interfaces:**
- Consumes: `buildRamps` (`./ramps.js`), `buildAlphas` (`./derived.js`), `resolveSemantics` (`./semantics.js`), `BRAND_DEFAULT_L` (`./steps.js`), types `Oklch`, `HueSeed`, `ThemeInputs` (`./types.js`).
- Produces (from `./dtcg.js`):
  - `BANNER: string`
  - `oklchToDtcg(c: Oklch): object`
  - `buildPrimitivesDtcg(inputs: ThemeInputs): Record<string, object>`
  - `buildSemanticDtcg(inputs: ThemeInputs, mode: "light" | "dark"): Record<string, any>`
  - `buildGeneratedFiles(inputs: ThemeInputs): Record<string, object>` — keys are the three canonical filenames; each value includes a `$description` banner property.
  - `emit-dtcg.js` re-exports all of the above plus keeps `writeGeneratedTokens(inputs, tokensDir): void`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/dtcg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildGeneratedFiles, buildPrimitivesDtcg, buildSemanticDtcg, BANNER } from "./dtcg.js";
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

describe("buildGeneratedFiles", () => {
  const files = buildGeneratedFiles(INPUTS);

  it("contains exactly the three canonical filenames", () => {
    expect(Object.keys(files).sort()).toEqual([
      "color.dark.tokens.json",
      "color.light.tokens.json",
      "primitives-color.mode-1.tokens.json",
    ]);
  });

  it("each file carries the $description banner", () => {
    for (const content of Object.values(files)) {
      expect((content as any).$description).toBe(BANNER);
    }
  });

  it("file contents equal the per-builder output (minus the banner)", () => {
    const strip = (o: Record<string, unknown>) => {
      const { $description, ...rest } = o;
      return rest;
    };
    expect(strip(files["primitives-color.mode-1.tokens.json"] as any))
      .toEqual(buildPrimitivesDtcg(INPUTS));
    expect(strip(files["color.light.tokens.json"] as any))
      .toEqual(buildSemanticDtcg(INPUTS, "light"));
    expect(strip(files["color.dark.tokens.json"] as any))
      .toEqual(buildSemanticDtcg(INPUTS, "dark"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dtcg`
Expected: FAIL — cannot resolve `./dtcg.js` (module does not exist yet).

- [ ] **Step 3: Create `src/engine/dtcg.ts`**

Move the pure functions verbatim from the current `emit-dtcg.ts` and add `buildGeneratedFiles`:

```ts
import type { HueSeed, Oklch, ThemeInputs } from "./types.js";
import { buildRamps } from "./ramps.js";
import { buildAlphas } from "./derived.js";
import { resolveSemantics } from "./semantics.js";
import { BRAND_DEFAULT_L } from "./steps.js";

export const BANNER = "auto-generated by build:theme — do not edit";

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
  secondary: "color-secondary",
  tertiary: "color-tertiary",
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

  for (const [step, color] of Object.entries(ramps.darkSurface)) {
    out[`color-neutral-dark-surface-${step}`] = oklchToDtcg(color);
  }

  const slots: ["primary" | "secondary" | "tertiary", HueSeed][] = [
    ["primary", inputs.accents.primary],
    ["secondary", inputs.accents.secondary],
    ["tertiary", inputs.accents.tertiary],
  ];
  for (const [slot, seed] of slots) {
    const brand = inputs.brand?.[slot] ?? { l: BRAND_DEFAULT_L, c: seed.chroma, h: seed.hue };
    out[`color-brand-${slot}`] = oklchToDtcg(brand);
  }
  return out;
}

export function buildSemanticDtcg(inputs: ThemeInputs, mode: "light" | "dark"): Record<string, any> {
  const ramps = buildRamps(inputs);
  const resolved = resolveSemantics(ramps, inputs, mode);
  const out: Record<string, any> = {};
  for (const [name, token] of Object.entries(resolved)) {
    if ("ref" in token) out[name] = { $type: "color", $value: `{${token.ref}}` };
    else out[name] = token.raw;
  }
  return out;
}

export function buildGeneratedFiles(inputs: ThemeInputs): Record<string, object> {
  const withBanner = (obj: object) => ({ $description: BANNER, ...obj });
  return {
    "primitives-color.mode-1.tokens.json": withBanner(buildPrimitivesDtcg(inputs)),
    "color.light.tokens.json": withBanner(buildSemanticDtcg(inputs, "light")),
    "color.dark.tokens.json": withBanner(buildSemanticDtcg(inputs, "dark")),
  };
}
```

- [ ] **Step 4: Replace the body of `src/engine/emit-dtcg.ts`**

Keep only the Node-only file writer; re-export the pure functions so existing importers (`emit-dtcg.test.ts`) keep resolving:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles } from "./dtcg.js";

export { oklchToDtcg, buildPrimitivesDtcg, buildSemanticDtcg, buildGeneratedFiles, BANNER } from "./dtcg.js";

export function writeGeneratedTokens(inputs: ThemeInputs, tokensDir: string): void {
  mkdirSync(tokensDir, { recursive: true });
  for (const [filename, content] of Object.entries(buildGeneratedFiles(inputs))) {
    writeFileSync(join(tokensDir, filename), JSON.stringify(content, null, 2) + "\n");
  }
}
```

- [ ] **Step 5: Add `dtcg.js` to the engine barrel**

In `src/engine/index.ts`, add after the existing exports:

```ts
export * from "./dtcg.js";
```

- [ ] **Step 6: Add `dtcg.ts` to the isomorphism guard**

In `src/engine/isomorphism.test.ts`, update the `PURE` array to include the new module:

```ts
const PURE = [
  "types.ts", "contrast-input.ts", "steps.ts", "ramps.ts",
  "contrast.ts", "derived.ts", "semantics.ts", "index.ts",
  "dtcg.ts",
];
```

- [ ] **Step 7: Run the full engine test suite**

Run: `npm test`
Expected: PASS — `dtcg.test.ts` passes; `emit-dtcg.test.ts`, `build-theme.test.ts`, and `isomorphism.test.ts` still pass (no regressions).

- [ ] **Step 8: Verify byte-identical token output**

Run: `npm run build:theme && git diff --stat src/tokens/`
Expected: no changes to `src/tokens/*.tokens.json` (the refactor preserves output exactly). If `git diff` shows changes, the refactor altered output — fix before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/engine/dtcg.ts src/engine/dtcg.test.ts src/engine/emit-dtcg.ts src/engine/index.ts src/engine/isomorphism.test.ts
git commit -m "refactor(engine): extract pure DTCG assembly into dtcg.ts with buildGeneratedFiles"
```

---

### Task 2: `figma-export.ts` — manifest-shaped token bundle

Add a pure module that wraps `buildGeneratedFiles` output in a manifest-shaped bundle and serializes it.

**Files:**
- Create: `src/engine/figma-export.ts`
- Modify: `src/engine/index.ts` (add `export * from "./figma-export.js";`)
- Modify: `src/engine/isomorphism.test.ts` (add `"figma-export.ts"` to `PURE`)
- Test: `src/engine/figma-export.test.ts`

**Interfaces:**
- Consumes: `buildGeneratedFiles` (`./dtcg.js`), type `ThemeInputs` (`./types.js`).
- Produces (from `./figma-export.js`):
  - `interface TokenBundle { manifest: { name: string; collections: Record<string, { modes: Record<string, string[]> }> }; files: Record<string, object> }`
  - `const COLOR_MANIFEST` — the color slice of the manifest.
  - `buildTokenBundle(inputs: ThemeInputs): TokenBundle`
  - `serializeTokenBundle(inputs: ThemeInputs): string` — `JSON.stringify(bundle, null, 2)`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/figma-export.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildTokenBundle, serializeTokenBundle, COLOR_MANIFEST } from "./figma-export.js";
import { buildGeneratedFiles } from "./dtcg.js";
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

describe("buildTokenBundle", () => {
  const bundle = buildTokenBundle(INPUTS);

  it("has manifest + files with the three canonical filenames", () => {
    expect(bundle.manifest.name).toBe("Design Tokens");
    expect(Object.keys(bundle.files).sort()).toEqual([
      "color.dark.tokens.json",
      "color.light.tokens.json",
      "primitives-color.mode-1.tokens.json",
    ]);
  });

  it("files equal buildGeneratedFiles (drift guard)", () => {
    expect(bundle.files).toEqual(buildGeneratedFiles(INPUTS));
  });

  it("manifest is a subset of the canonical src/tokens/manifest.json (drift guard)", () => {
    const canonical = JSON.parse(
      readFileSync(new URL("../tokens/manifest.json", import.meta.url), "utf-8"),
    );
    for (const [coll, def] of Object.entries(COLOR_MANIFEST.collections)) {
      const canonColl = canonical.collections[coll];
      expect(canonColl, `collection ${coll} missing from manifest.json`).toBeDefined();
      for (const [modeName, fileList] of Object.entries(def.modes)) {
        const canonFiles: string[] = canonColl.modes[modeName];
        expect(canonFiles, `mode ${coll}/${modeName} missing`).toBeDefined();
        for (const f of fileList) expect(canonFiles).toContain(f);
      }
    }
  });

  it("every semantic {ref} resolves to a primitive in the bundle", () => {
    const prims = bundle.files["primitives-color.mode-1.tokens.json"] as Record<string, any>;
    const primNames = new Set(Object.keys(prims).filter((k) => k !== "$description"));
    for (const fname of ["color.light.tokens.json", "color.dark.tokens.json"]) {
      const file = bundle.files[fname] as Record<string, any>;
      for (const [name, token] of Object.entries(file)) {
        if (name === "$description") continue;
        const v = token.$value;
        if (typeof v === "string" && v.startsWith("{")) {
          const ref = v.slice(1, -1);
          expect(primNames.has(ref), `${fname} ${name} -> {${ref}} unresolved`).toBe(true);
        }
      }
    }
  });

  it("light and dark differ for at least one semantic token", () => {
    const light = bundle.files["color.light.tokens.json"] as Record<string, any>;
    const dark = bundle.files["color.dark.tokens.json"] as Record<string, any>;
    const differs = Object.keys(light).some(
      (k) => k !== "$description" && JSON.stringify(light[k]) !== JSON.stringify(dark[k]),
    );
    expect(differs).toBe(true);
  });

  it("no color value in any file is a hex string (exporter does no conversion)", () => {
    for (const file of Object.values(bundle.files)) {
      for (const [name, token] of Object.entries(file as Record<string, any>)) {
        if (name === "$description") continue;
        expect(typeof token.$value === "string" && token.$value.startsWith("#")).toBe(false);
      }
    }
  });

  it("serializeTokenBundle returns pretty-printed JSON of the bundle", () => {
    expect(serializeTokenBundle(INPUTS)).toBe(JSON.stringify(bundle, null, 2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- figma-export`
Expected: FAIL — cannot resolve `./figma-export.js`.

- [ ] **Step 3: Create `src/engine/figma-export.ts`**

```ts
import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles } from "./dtcg.js";

export interface TokenBundle {
  manifest: { name: string; collections: Record<string, { modes: Record<string, string[]> }> };
  files: Record<string, object>;
}

// The color slice of src/tokens/manifest.json — only the collections the studio
// generates. Drift from the canonical manifest is caught by figma-export.test.ts.
export const COLOR_MANIFEST: TokenBundle["manifest"] = {
  name: "Design Tokens",
  collections: {
    "primitives-color": { modes: { "mode-1": ["primitives-color.mode-1.tokens.json"] } },
    color: { modes: { light: ["color.light.tokens.json"], dark: ["color.dark.tokens.json"] } },
  },
};

export function buildTokenBundle(inputs: ThemeInputs): TokenBundle {
  return {
    manifest: structuredClone(COLOR_MANIFEST),
    files: buildGeneratedFiles(inputs),
  };
}

export function serializeTokenBundle(inputs: ThemeInputs): string {
  return JSON.stringify(buildTokenBundle(inputs), null, 2);
}
```

- [ ] **Step 4: Add `figma-export.js` to the engine barrel and the isomorphism guard**

In `src/engine/index.ts` add:

```ts
export * from "./figma-export.js";
```

In `src/engine/isomorphism.test.ts` update `PURE`:

```ts
const PURE = [
  "types.ts", "contrast-input.ts", "steps.ts", "ramps.ts",
  "contrast.ts", "derived.ts", "semantics.ts", "index.ts",
  "dtcg.ts", "figma-export.ts",
];
```

- [ ] **Step 5: Run tests**

Run: `npm test -- figma-export isomorphism`
Expected: PASS — all `figma-export.test.ts` cases pass; isomorphism guard passes for the two new modules.

- [ ] **Step 6: Commit**

```bash
git add src/engine/figma-export.ts src/engine/figma-export.test.ts src/engine/index.ts src/engine/isomorphism.test.ts
git commit -m "feat(engine): add figma-export token bundle (manifest + files)"
```

---

### Task 3: Studio "Copy tokens for Figma" button

Add the button to the studio and wire it to copy the serialized bundle to the clipboard, with transient feedback mirroring the Save button.

**Files:**
- Modify: `tools/color-studio/index.html` (add button to `#sidebar-foot`)
- Create: `tools/color-studio/src/export-figma.ts`
- Modify: `tools/color-studio/src/main.ts` (import helper, wire button)

**Interfaces:**
- Consumes: `serializeTokenBundle` (`@project/src/engine/index.js`), type `ThemeInputs` (`@project/src/engine/index.js`).
- Produces: `copyTokensForFigma(state: ThemeInputs): Promise<boolean>` in `export-figma.ts` — serializes the bundle, writes it to `navigator.clipboard`, resolves `true` on success and `false` on failure.

> No vitest test: this path crosses the DOM and the `@project` alias, neither available under root vitest. The data path (`serializeTokenBundle`) is fully covered by Task 2. Verification here is a build + manual click-through (Steps 4–5).

- [ ] **Step 1: Add the button to `tools/color-studio/index.html`**

In `#sidebar-foot`, add a third button after `#save-btn`:

```html
        <footer id="sidebar-foot">
          <button id="mode-toggle" class="btn" type="button">☀ Light</button>
          <button id="save-btn" class="btn btn--primary" type="button">Save to config</button>
          <button id="export-figma-btn" class="btn" type="button">Copy for Figma</button>
        </footer>
```

- [ ] **Step 2: Create `tools/color-studio/src/export-figma.ts`**

```ts
import { serializeTokenBundle } from "@project/src/engine/index.js";
import type { ThemeInputs } from "@project/src/engine/index.js";

/** Serialize the token bundle for the current state and copy it to the clipboard.
 *  Returns true on success, false if serialization or the clipboard write fails. */
export async function copyTokensForFigma(state: ThemeInputs): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serializeTokenBundle(state));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Wire the button in `tools/color-studio/src/main.ts`**

Add the import near the other imports (after the `serializeConfig` import on line 6):

```ts
import { copyTokensForFigma } from "./export-figma.js";
```

Add the handler after the existing `saveBtn` handler block (after line 55):

```ts
const exportBtn = document.getElementById("export-figma-btn")!;
exportBtn.addEventListener("click", async () => {
  exportBtn.textContent = "Copying…";
  const ok = await copyTokensForFigma(state);
  exportBtn.classList.toggle("btn--ok", ok);
  exportBtn.textContent = ok ? "Copied ✓" : "Copy failed";
  setTimeout(() => {
    exportBtn.classList.remove("btn--ok");
    exportBtn.textContent = "Copy for Figma";
  }, 1600);
});
```

- [ ] **Step 4: Verify the studio builds and type-checks**

Run: `cd tools/color-studio && npx vite build`
Expected: build succeeds with no TypeScript/resolve errors (confirms the `@project` import and DOM wiring compile, and no `node:` leaked into the browser bundle).

- [ ] **Step 5: Manual click-through**

Run: `npm run preview:studio` (opens the studio in the browser).
Do:
1. Click **Copy for Figma** — the button should flash `Copied ✓`, then revert to `Copy for Figma` after ~1.6s.
2. Paste the clipboard into a scratch file/editor.
Expected: valid JSON with a top-level `manifest` (collections `primitives-color`, `color`) and `files` containing `primitives-color.mode-1.tokens.json`, `color.light.tokens.json`, `color.dark.tokens.json`; primitive values are `{ "colorSpace": "oklch", "components": [...] }`; semantic values are `"{color-...}"` references.
3. Tune a slider, click again — the pasted JSON reflects the new values (export tracks live state, not saved config).

- [ ] **Step 6: Commit**

```bash
git add tools/color-studio/index.html tools/color-studio/src/export-figma.ts tools/color-studio/src/main.ts
git commit -m "feat(color-studio): add Copy for Figma token export button"
```

---

## Notes for the implementer

- **Importer is out of scope.** The bundle is consumed later by the Figma MCP or a future plugin, which converts oklch→sRGB hex (`culori.formatHex`/`formatHex8`, colors are already P3-clamped) and wires `{ref}` values as Figma variable aliases. Do not build that here.
- **Static prism palette and non-color collections** (radius/dimension/typography) are intentionally excluded; `COLOR_MANIFEST` covers only generated color. The manifest-parity test uses subset (not deep-equal) semantics precisely because the canonical manifest also lists the excluded static file under `primitives-color/mode-1`.
