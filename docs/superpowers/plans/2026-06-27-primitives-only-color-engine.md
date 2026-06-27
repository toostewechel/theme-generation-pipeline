# Primitives-only Color Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the color engine a one-way input generator that emits only primitive color tokens; Figma owns the semantic mapping.

**Architecture:** Hard split. `buildGeneratedFiles`, `buildTokenBundle`, and `writeGeneratedTokens` produce only `primitives-color.mode-1.tokens.json`. The semantic builders (`buildSemanticDtcg`/`resolveSemantics`) stay exported for the live preview but are unwired from file/bundle output. The static prism passthrough (`STATIC_PRISM`) is removed from the engine. Existing semantic + static-prism token files stay on disk as Figma-owned artifacts that `build:tokens` still consumes — no change to the local CSS build.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), Style Dictionary v5, culori, vitest, tsx.

## Global Constraints

- DTCG token format: `$type` + `$value`; references use curly-brace syntax `{token-name}` — copied verbatim from spec.
- Primitive token naming is frozen (`color-neutral-500`, `color-accent-500`, etc.); names must not churn across regenerations (round-trip integrity depends on it).
- ESM imports use `.js` extensions even for `.ts` sources.
- Tests run with `npx vitest run <path>` (or `npm test` for all). No new dependencies.
- Do NOT modify `src/tokens/manifest.json`, `scripts/buildTokens.ts`, or `tools/color-studio/src/ui/preview.ts` — the local CSS build and preview stay on the Figma snapshot.

---

### Task 1: `buildGeneratedFiles` emits only the primitives file

**Files:**
- Modify: `src/engine/dtcg.ts:85-92`
- Test: `src/engine/dtcg.test.ts:1-51`

**Interfaces:**
- Consumes: `buildPrimitivesDtcg(inputs: ThemeInputs)`, `BANNER` (existing, unchanged).
- Produces: `buildGeneratedFiles(inputs: ThemeInputs): Record<string, object>` returning exactly one key, `"primitives-color.mode-1.tokens.json"`. `buildSemanticDtcg(inputs, mode)` remains exported and unchanged (consumed by `emit-dtcg.ts` re-export, the preview, and `emit-dtcg.test.ts`).

- [ ] **Step 1: Update the failing tests in `dtcg.test.ts`**

Change the import on line 2 to drop the now-unused `buildSemanticDtcg`:

```typescript
import { buildGeneratedFiles, buildPrimitivesDtcg, BANNER } from "./dtcg.js";
```

Replace the `buildGeneratedFiles` describe block (lines 22-51) with:

```typescript
describe("buildGeneratedFiles", () => {
  const files = buildGeneratedFiles(INPUTS);

  it("contains exactly the one canonical filename", () => {
    expect(Object.keys(files).sort()).toEqual([
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
  });
});
```

Leave the `alpha-over-white twins` describe block (lines 53-92) unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: FAIL — "contains exactly the one canonical filename" sees three filenames (`color.dark.tokens.json`, `color.light.tokens.json`, `primitives-color.mode-1.tokens.json`).

- [ ] **Step 3: Update `buildGeneratedFiles` in `dtcg.ts`**

Replace the function at `src/engine/dtcg.ts:85-92` with:

```typescript
export function buildGeneratedFiles(inputs: ThemeInputs): Record<string, object> {
  const withBanner = (obj: object) => ({ $description: BANNER, ...obj });
  return {
    "primitives-color.mode-1.tokens.json": withBanner(buildPrimitivesDtcg(inputs)),
  };
}
```

Leave `buildSemanticDtcg` (lines 74-83) and all imports unchanged — `resolveSemantics` is still used by `buildSemanticDtcg`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/dtcg.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/engine/dtcg.ts src/engine/dtcg.test.ts
git commit -m "feat(engine): buildGeneratedFiles emits primitives only

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Figma export bundle is primitives-only; remove `STATIC_PRISM`

**Files:**
- Modify: `src/engine/figma-export.ts:9-71`
- Test: `src/engine/figma-export.test.ts:1-103`

**Interfaces:**
- Consumes: `buildGeneratedFiles(inputs)` from Task 1 (one-file output).
- Produces: `COLOR_MANIFEST` with a single collection `primitives-color` (mode `mode-1` → `["primitives-color.mode-1.tokens.json"]`), no `color` collection, no static file reference. `buildTokenBundle(inputs)` returns `{ manifest, files }` where `files` equals `buildGeneratedFiles(inputs)`. `STATIC_PRISM` no longer exported.

- [ ] **Step 1: Update the failing tests in `figma-export.test.ts`**

Change the import on line 3 to drop `STATIC_PRISM`:

```typescript
import { buildTokenBundle, serializeTokenBundle, COLOR_MANIFEST } from "./figma-export.js";
```

Replace the entire `describe("buildTokenBundle", …)` body (lines 23-103) with:

```typescript
describe("buildTokenBundle", () => {
  const bundle = buildTokenBundle(INPUTS);

  it("has manifest + files with the single primitives filename", () => {
    expect(bundle.manifest.name).toBe("Design Tokens");
    expect(Object.keys(bundle.files).sort()).toEqual([
      "primitives-color.mode-1.tokens.json",
    ]);
  });

  it("generated files equal buildGeneratedFiles", () => {
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

  it("export manifest intentionally omits the semantic color collection", () => {
    expect(COLOR_MANIFEST.collections).not.toHaveProperty("color");
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

This removes the deleted tests: "generated files equal … static prism carried verbatim", "every semantic {ref} resolves …", "light and dark differ …", and "STATIC_PRISM matches …". Leave the `INPUTS` fixture (lines 7-21) and imports for `readFileSync` / `buildGeneratedFiles` unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/figma-export.test.ts`
Expected: FAIL to compile/run — `STATIC_PRISM` is still exported from `figma-export.ts` so the import line is fine, but `buildTokenBundle` still returns four files, so "single primitives filename" fails.

- [ ] **Step 3: Rewrite `figma-export.ts`**

Replace the file body from line 9 (the `STATIC_PRISM` comment) through line 71 (end of `buildTokenBundle`) with:

```typescript
// The color slice of src/tokens/manifest.json — only the primitive collection
// the studio generates. Semantic mapping (the `color` collection) is owned in
// Figma, so it is intentionally absent here. Drift from the canonical manifest
// is caught by figma-export.test.ts.
export const COLOR_MANIFEST: TokenBundle["manifest"] = {
  name: "Design Tokens",
  collections: {
    "primitives-color": { modes: { "mode-1": [
      "primitives-color.mode-1.tokens.json",
    ] } },
  },
};

export function buildTokenBundle(inputs: ThemeInputs): TokenBundle {
  return {
    manifest: structuredClone(COLOR_MANIFEST),
    files: buildGeneratedFiles(inputs),
  };
}
```

Leave lines 1-7 (imports + `TokenBundle` interface) and `serializeTokenBundle` (lines 73-75) unchanged. The `STATIC_PRISM` constant is now fully removed.

- [ ] **Step 4: Verify nothing else imports `STATIC_PRISM`**

Run: `grep -rn "STATIC_PRISM" src tools scripts`
Expected: no matches (only the now-deleted references existed). If any match appears, that file must be updated before continuing.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/figma-export.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/figma-export.ts src/engine/figma-export.test.ts
git commit -m "feat(engine): Figma export bundle is primitives-only, drop STATIC_PRISM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `writeGeneratedTokens` writes one file; update `build:theme` output

**Files:**
- Modify: `scripts/buildTheme.ts:6-11`
- Test: `src/engine/emit-dtcg.test.ts:1-3` (add imports) and append a new describe block.

**Interfaces:**
- Consumes: `writeGeneratedTokens(inputs: ThemeInputs, tokensDir: string): void` (existing — already iterates `buildGeneratedFiles`, so after Task 1 it writes one file with no code change). `themeInputs` default export from `../../theme.config.js`.
- Produces: no new exports. Locks the one-file behavior with a test and aligns the CLI log with the Figma round-trip.

- [ ] **Step 1: Add the failing test to `emit-dtcg.test.ts`**

Add these imports after line 3:

```typescript
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGeneratedTokens } from "./emit-dtcg.js";
```

Append this describe block at the end of the file:

```typescript
describe("writeGeneratedTokens", () => {
  it("writes only the primitives file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tokens-"));
    try {
      writeGeneratedTokens(themeInputs, dir);
      expect(readdirSync(dir).sort()).toEqual([
        "primitives-color.mode-1.tokens.json",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

Leave the existing `oklchToDtcg`, `buildPrimitivesDtcg`, and `buildSemanticDtcg` describe blocks unchanged.

- [ ] **Step 2: Run the test to verify it passes (Task 1 already made it green)**

Run: `npx vitest run src/engine/emit-dtcg.test.ts`
Expected: PASS — confirms `writeGeneratedTokens` emits exactly one file. (If it FAILS with multiple files, Task 1 was not applied.)

- [ ] **Step 3: Update the CLI logging in `buildTheme.ts`**

Replace lines 6-11 of `scripts/buildTheme.ts`:

```typescript
    console.log("🎨 Generating primitive color tokens from theme.config.ts…");
    writeGeneratedTokens(themeInputs, "src/tokens");
    console.log("✅ src/tokens/primitives-color.mode-1.tokens.json");
    console.log("\nNext: paste this file into Figma to seed the primitive color");
    console.log("variables, then export from Figma to update src/tokens/.");
```

Leave the rest of the file (try/catch, `main()` call) unchanged.

- [ ] **Step 4: Run `build:theme` to verify output**

Run: `npm run build:theme`
Expected: logs "✅ src/tokens/primitives-color.mode-1.tokens.json" and the Figma next-step message; exits 0. `git status` shows at most `src/tokens/primitives-color.mode-1.tokens.json` changed (regenerated), and `color.light/dark.tokens.json` are NOT rewritten.

- [ ] **Step 5: Commit**

```bash
git add scripts/buildTheme.ts src/engine/emit-dtcg.test.ts src/tokens/primitives-color.mode-1.tokens.json
git commit -m "feat(engine): writeGeneratedTokens emits one file; build:theme logs Figma round-trip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Re-banner the Figma-owned semantic files

**Files:**
- Modify: `src/tokens/color.light.tokens.json:2`
- Modify: `src/tokens/color.dark.tokens.json:2`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. One-time data edit so the file banners stop claiming engine ownership. No test (these are data files; `build:tokens` treats `$description` only as a comment, and `token-drift` compares names not descriptions).

- [ ] **Step 1: Update the banner in `color.light.tokens.json`**

Replace line 2:

```json
  "$description": "Semantic mapping owned in Figma — sync manually",
```

- [ ] **Step 2: Update the banner in `color.dark.tokens.json`**

Replace line 2 with the identical string:

```json
  "$description": "Semantic mapping owned in Figma — sync manually",
```

- [ ] **Step 3: Verify the local CSS build still works**

Run: `npm run build:tokens`
Expected: exits 0; logs "✅ dist/css/tokens.css". Confirms the semantic files still parse and the `:root` / `[data-color-mode='dark']` blocks still build from the Figma-owned files.

- [ ] **Step 4: Commit**

```bash
git add src/tokens/color.light.tokens.json src/tokens/color.dark.tokens.json
git commit -m "chore(tokens): mark semantic color files as Figma-owned

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full-suite verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: confidence that the whole engine + build pipeline is green.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all engine tests green, including unchanged `semantics.test.ts` and `token-drift.test.ts`.

- [ ] **Step 2: Confirm the Figma export is primitives-only (manual sanity check)**

Run: `npx tsx -e "import('./src/engine/index.js').then(m => console.log(Object.keys(JSON.parse(m.serializeTokenBundle((await import('./theme.config.js')).default)).files)))"`
Expected: prints `[ 'primitives-color.mode-1.tokens.json' ]` — no semantic or static-prism files in the clipboard bundle.

- [ ] **Step 3: Confirm no uncommitted drift**

Run: `git status`
Expected: clean working tree (all task commits landed).
