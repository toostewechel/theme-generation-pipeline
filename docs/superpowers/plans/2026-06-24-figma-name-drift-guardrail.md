# Figma Name-Drift Guardrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an advisory CLI that diffs design-token *names* in a Figma export against the names the pipeline emits, to catch accidental renames or newly-added Figma variables.

**Architecture:** A pure core (`src/engine/figma-drift.ts`) exposes a set-difference `diffTokenNames` plus two name extractors (`namesFromBundle` for a Figma DTCG export, `namesFromManifest` for the committed pipeline tokens). A thin tsx CLI (`scripts/checkFigmaDrift.ts`) wires file I/O, an optional ignore list, a human/`--json` report, and exit codes. The core is fs- and process-free so a future live-Figma-MCP adapter reuses it untouched.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, tsx for CLI scripts, Node `fs`/`path`. No new dependencies.

## Global Constraints

- ESM imports use `.js` specifiers even for `.ts` files (e.g. `import { x } from "./figma-drift.js"`) — matches the existing engine.
- Tests live beside source as `*.test.ts`, using `import { describe, it, expect } from "vitest"`.
- CLI scripts live in `scripts/`, run via `npx tsx`, and import engine code as `../src/engine/<name>.js`.
- Comparison is **names only**. Never compare token values.
- Coverage is the `collections` block of `manifest.json` (all collections). The `styles` block is **out of scope** — not read.
- Pipeline token files are flat DTCG (leaf tokens at top level); `$`-prefixed keys (e.g. `$description`) are metadata, not tokens.
- The Figma export input is a DTCG bundle of shape `{ manifest, files }` — reuse the `TokenBundle` type already exported from `src/engine/figma-export.ts`.
- Exit codes: `0` = no drift, `1` = drift found, `2` = bad/missing input.
- Commit after each task. End commit messages with the repo's `Co-Authored-By` trailer.

---

### Task 1: Core diff — `diffTokenNames` + `DriftReport`

**Files:**
- Create: `src/engine/figma-drift.ts`
- Test: `src/engine/figma-drift.test.ts`
- Modify: `src/engine/index.ts` (add re-export)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DriftReport { matched: string[]; missingInPipeline: string[]; extraInPipeline: string[]; ignored: string[]; hasDrift: boolean }`
  - `function diffTokenNames(pipeline: Set<string>, figma: Set<string>, opts?: { ignore?: (string | RegExp)[] }): DriftReport`

- [ ] **Step 1: Write the failing test**

Create `src/engine/figma-drift.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diffTokenNames } from "./figma-drift.js";

describe("diffTokenNames", () => {
  it("reports no drift when name sets are identical", () => {
    const a = new Set(["color-fg-default", "color-bg-default"]);
    const report = diffTokenNames(a, new Set(a));
    expect(report.hasDrift).toBe(false);
    expect(report.matched).toEqual(["color-bg-default", "color-fg-default"]);
    expect(report.missingInPipeline).toEqual([]);
    expect(report.extraInPipeline).toEqual([]);
  });

  it("flags names present only in Figma as missingInPipeline", () => {
    const pipeline = new Set(["color-bg-default"]);
    const figma = new Set(["color-bg-default", "color-neutral-25"]);
    const report = diffTokenNames(pipeline, figma);
    expect(report.missingInPipeline).toEqual(["color-neutral-25"]);
    expect(report.hasDrift).toBe(true);
  });

  it("flags names present only in pipeline as extraInPipeline", () => {
    const pipeline = new Set(["color-bg-default", "color-bg"]);
    const figma = new Set(["color-bg-default"]);
    const report = diffTokenNames(pipeline, figma);
    expect(report.extraInPipeline).toEqual(["color-bg"]);
    expect(report.hasDrift).toBe(true);
  });

  it("excludes ignored names (string and regex) from drift", () => {
    const pipeline = new Set(["color-bg-default", "color-state-disabled-opacity"]);
    const figma = new Set(["color-bg-default", "color-prism-neon"]);
    const report = diffTokenNames(pipeline, figma, {
      ignore: ["color-state-disabled-opacity", /^color-prism-/],
    });
    expect(report.ignored).toEqual(["color-prism-neon", "color-state-disabled-opacity"]);
    expect(report.missingInPipeline).toEqual([]);
    expect(report.extraInPipeline).toEqual([]);
    expect(report.hasDrift).toBe(false);
  });

  it("returns sorted arrays", () => {
    const report = diffTokenNames(new Set(["b", "a"]), new Set(["b", "a"]));
    expect(report.matched).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/figma-drift.test.ts`
Expected: FAIL — cannot resolve `./figma-drift.js` / `diffTokenNames is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/figma-drift.ts`:

```ts
export interface DriftReport {
  /** Names present in both Figma and the pipeline. */
  matched: string[];
  /** In Figma, not in the pipeline — new/renamed in Figma; reflect in engine or token files. */
  missingInPipeline: string[];
  /** In the pipeline, not in Figma — removed/renamed in Figma? */
  extraInPipeline: string[];
  /** Matched an ignore pattern; excluded from the drift buckets. */
  ignored: string[];
  /** True when missingInPipeline or extraInPipeline is non-empty. */
  hasDrift: boolean;
}

export function diffTokenNames(
  pipeline: Set<string>,
  figma: Set<string>,
  opts: { ignore?: (string | RegExp)[] } = {},
): DriftReport {
  const ignore = opts.ignore ?? [];
  const isIgnored = (name: string) =>
    ignore.some((p) => (typeof p === "string" ? p === name : p.test(name)));

  const matched: string[] = [];
  const missingInPipeline: string[] = [];
  const extraInPipeline: string[] = [];
  const ignored: string[] = [];

  for (const name of new Set([...pipeline, ...figma])) {
    if (isIgnored(name)) {
      ignored.push(name);
      continue;
    }
    const inPipeline = pipeline.has(name);
    const inFigma = figma.has(name);
    if (inPipeline && inFigma) matched.push(name);
    else if (inFigma) missingInPipeline.push(name);
    else extraInPipeline.push(name);
  }

  for (const arr of [matched, missingInPipeline, extraInPipeline, ignored]) arr.sort();

  return {
    matched,
    missingInPipeline,
    extraInPipeline,
    ignored,
    hasDrift: missingInPipeline.length + extraInPipeline.length > 0,
  };
}
```

- [ ] **Step 4: Add the re-export**

In `src/engine/index.ts`, append after the existing exports:

```ts
export * from "./figma-drift.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/figma-drift.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/figma-drift.ts src/engine/figma-drift.test.ts src/engine/index.ts
git commit -m "$(cat <<'EOF'
feat(engine): add diffTokenNames core for figma name-drift

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Name extractors — `collectTokenNames`, `namesFromBundle`, `namesFromManifest`

**Files:**
- Modify: `src/engine/figma-drift.ts` (add extractors)
- Modify: `src/engine/figma-drift.test.ts` (add extractor tests)

**Interfaces:**
- Consumes: `TokenBundle` from `src/engine/figma-export.ts`.
- Produces:
  - `function collectTokenNames(node: Record<string, unknown>, into: Set<string>, prefix?: string): void`
  - `function namesFromBundle(bundle: TokenBundle): Set<string>`
  - `function namesFromManifest(tokensDir: string): Set<string>`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/figma-drift.test.ts`:

```ts
import { collectTokenNames, namesFromBundle, namesFromManifest } from "./figma-drift.js";
import type { TokenBundle } from "./figma-export.js";

describe("collectTokenNames", () => {
  it("collects flat token keys and skips $-metadata", () => {
    const names = new Set<string>();
    collectTokenNames(
      {
        $description: "auto-generated",
        "color-neutral-0": { $type: "color", $value: {} },
        "color-bg-default": { $value: "{color-neutral-0}" },
      },
      names,
    );
    expect([...names].sort()).toEqual(["color-bg-default", "color-neutral-0"]);
  });

  it("joins nested group paths with a hyphen (defensive)", () => {
    const names = new Set<string>();
    collectTokenNames({ color: { neutral: { "700": { $value: {} } } } }, names);
    expect([...names]).toEqual(["color-neutral-700"]);
  });
});

describe("namesFromBundle", () => {
  it("unions token names across all files", () => {
    const bundle: TokenBundle = {
      manifest: { name: "x", collections: {} },
      files: {
        "a.json": { "color-bg-default": { $value: {} } },
        "b.json": { $description: "meta", "radius-intensity": { $type: "dimension", $value: {} } },
      },
    };
    expect([...namesFromBundle(bundle)].sort()).toEqual(["color-bg-default", "radius-intensity"]);
  });
});

describe("namesFromManifest (real committed tokens)", () => {
  const names = namesFromManifest("src/tokens");

  it("includes semantic, primitive, and non-color collection names", () => {
    expect(names.has("color-bg-default")).toBe(true);
    expect(names.has("color-neutral-0")).toBe(true);
    expect(names.has("radius-intensity")).toBe(true);
  });

  it("excludes $-metadata keys", () => {
    expect(names.has("$description")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/figma-drift.test.ts`
Expected: FAIL — `collectTokenNames is not a function` (and the new suites error).

- [ ] **Step 3: Write the implementation**

Append to `src/engine/figma-drift.ts` (add the imports at the top of the file):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokenBundle } from "./figma-export.js";

/** A DTCG token node carries `$value` or `$type`. */
function isTokenNode(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && ("$value" in value || "$type" in value);
}

/**
 * Walk a DTCG file object, collecting leaf token names into `into`.
 * Files are flat in this repo, so names equal top-level keys; nested groups
 * (if ever present) are joined with "-" to match the flat naming convention.
 * `$`-prefixed metadata keys are skipped.
 */
export function collectTokenNames(
  node: Record<string, unknown>,
  into: Set<string>,
  prefix = "",
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const name = prefix ? `${prefix}-${key}` : key;
    if (isTokenNode(value)) into.add(name);
    else if (typeof value === "object" && value !== null)
      collectTokenNames(value as Record<string, unknown>, into, name);
  }
}

/** Names across every file of a Figma DTCG export bundle. */
export function namesFromBundle(bundle: TokenBundle): Set<string> {
  const names = new Set<string>();
  for (const file of Object.values(bundle.files)) {
    collectTokenNames(file as Record<string, unknown>, names);
  }
  return names;
}

interface Manifest {
  collections: Record<string, { modes: Record<string, string[]> }>;
}

/**
 * Names the pipeline emits, read from the committed token files referenced by
 * `manifest.json`'s `collections` block. The `styles` block is intentionally
 * not read (styles are not variables).
 */
export function namesFromManifest(tokensDir: string): Set<string> {
  const manifest = JSON.parse(readFileSync(join(tokensDir, "manifest.json"), "utf-8")) as Manifest;
  const names = new Set<string>();
  for (const collection of Object.values(manifest.collections)) {
    for (const files of Object.values(collection.modes)) {
      for (const filename of files) {
        const file = JSON.parse(readFileSync(join(tokensDir, filename), "utf-8"));
        collectTokenNames(file, names);
      }
    }
  }
  return names;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/figma-drift.test.ts`
Expected: PASS (all suites — diff + extractors).

- [ ] **Step 5: Commit**

```bash
git add src/engine/figma-drift.ts src/engine/figma-drift.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): add name extractors for figma drift (bundle + manifest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: CLI — `checkFigmaDrift.ts` + ignore file + npm script

**Files:**
- Create: `scripts/checkFigmaDrift.ts`
- Create: `scripts/figma-drift.ignore.json`
- Modify: `package.json` (add `check:figma-drift` script)

**Interfaces:**
- Consumes: `diffTokenNames`, `namesFromBundle`, `namesFromManifest` from `../src/engine/figma-drift.js`; `TokenBundle` from `../src/engine/figma-export.js`.
- Produces: a runnable command `npm run check:figma-drift <export.json> [--json]`.

- [ ] **Step 1: Create the ignore file**

Create `scripts/figma-drift.ignore.json` (empty to start; entries are exact names, or `/regex/` strings wrapped in slashes):

```json
[]
```

- [ ] **Step 2: Add the npm script**

In `package.json`, inside `"scripts"`, add after `"build:theme"`:

```json
    "check:figma-drift": "npx tsx scripts/checkFigmaDrift.ts",
```

(Ensure the preceding line keeps its trailing comma and JSON stays valid.)

- [ ] **Step 3: Write the CLI**

Create `scripts/checkFigmaDrift.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diffTokenNames,
  namesFromBundle,
  namesFromManifest,
} from "../src/engine/figma-drift.js";
import type { TokenBundle } from "../src/engine/figma-export.js";

function loadIgnore(path: string): (string | RegExp)[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8")) as string[];
  return raw.map((entry) =>
    entry.startsWith("/") && entry.endsWith("/") && entry.length > 2
      ? new RegExp(entry.slice(1, -1))
      : entry,
  );
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const exportPath = args.find((a) => !a.startsWith("--"));

  if (!exportPath) {
    console.error("Usage: npm run check:figma-drift <figma-export.json> [--json]");
    process.exit(2);
  }
  if (!existsSync(exportPath)) {
    console.error(`Export file not found: ${exportPath}`);
    process.exit(2);
  }

  let bundle: TokenBundle;
  try {
    bundle = JSON.parse(readFileSync(exportPath, "utf-8")) as TokenBundle;
  } catch (e) {
    console.error(`Could not parse JSON: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!bundle.files || typeof bundle.files !== "object") {
    console.error("Export JSON has no `files` object — expected a DTCG bundle { manifest, files }.");
    process.exit(2);
  }

  const figma = namesFromBundle(bundle);
  const pipeline = namesFromManifest("src/tokens");
  const ignore = loadIgnore(join("scripts", "figma-drift.ignore.json"));
  const report = diffTokenNames(pipeline, figma, { ignore });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.hasDrift ? 1 : 0);
  }

  console.log("Figma name-drift report");
  console.log(`  ✓ ${report.matched.length} names matched`);
  if (report.missingInPipeline.length) {
    console.log(
      `  ⚠ ${report.missingInPipeline.length} in Figma but missing from pipeline (add to engine/semantics or token files):`,
    );
    for (const n of report.missingInPipeline) console.log(`      ${n}`);
  }
  if (report.extraInPipeline.length) {
    console.log(
      `  ⚠ ${report.extraInPipeline.length} in pipeline but missing from Figma (renamed/removed in Figma?):`,
    );
    for (const n of report.extraInPipeline) console.log(`      ${n}`);
  }
  if (report.ignored.length) console.log(`  · ${report.ignored.length} ignored`);

  process.exit(report.hasDrift ? 1 : 0);
}

main();
```

- [ ] **Step 4: Smoke-test the no-drift path (exit 0)**

Build a self-consistent export from the committed tokens, then run the CLI against it:

```bash
npx tsx -e '
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const dir = "src/tokens";
const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
const files = {};
for (const c of Object.values(m.collections))
  for (const fs of Object.values(c.modes))
    for (const f of fs) files[f] = JSON.parse(readFileSync(join(dir, f), "utf-8"));
writeFileSync("/tmp/figma-export-nodrift.json", JSON.stringify({ manifest: m, files }));
'
npm run check:figma-drift /tmp/figma-export-nodrift.json; echo "exit=$?"
```

Expected: report shows matched count > 0, no ⚠ lines, and `exit=0`.

- [ ] **Step 5: Smoke-test the drift path (exit 1)**

```bash
npx tsx -e '
import { readFileSync, writeFileSync } from "node:fs";
const b = JSON.parse(readFileSync("/tmp/figma-export-nodrift.json", "utf-8"));
b.files["color.light.tokens.json"]["color-neutral-25"] = { $type: "color", $value: {} };
delete b.files["color.light.tokens.json"]["color-fg-default"];
writeFileSync("/tmp/figma-export-drift.json", JSON.stringify(b));
'
npm run check:figma-drift /tmp/figma-export-drift.json; echo "exit=$?"
```

Expected: `⚠ ... missing from pipeline` lists `color-neutral-25`; output also notes a pipeline-only name; `exit=1`. (Note: `color-fg-default` still exists in `color.dark.tokens.json`, so deleting it from the light file alone may not make it pipeline-only — the key assertion is `color-neutral-25` appears under "missing from pipeline" and exit is 1.)

- [ ] **Step 6: Verify the full test suite still passes**

Run: `npm test`
Expected: all suites pass (existing 96 + the new figma-drift tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/checkFigmaDrift.ts scripts/figma-drift.ignore.json package.json
git commit -m "$(cat <<'EOF'
feat(scripts): add check:figma-drift advisory CLI

Diffs token names in a Figma DTCG export against the committed pipeline
tokens; prints a grouped report and exits 1 on drift, 2 on bad input.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Module layout (`figma-drift.ts`, `figma-drift.test.ts`, `checkFigmaDrift.ts`, ignore json, package script) → Tasks 1–3. ✓
- Core API `DriftReport` + `diffTokenNames` with ignore → Task 1. ✓
- Extractors `namesFromBundle` + `namesFromManifest` (+ shared walker), styles excluded → Task 2. ✓
- CLI report format, `--json`, exit codes 0/1/2 → Task 3. ✓
- Ignore list as committed JSON (string + regex), defaults empty → Task 3 Step 1 + Task 1 ignore logic. ✓
- Testing scope (identical/added/removed/ignored, manifest skips `$description` + multi-file collection) → Tasks 1–2 tests. ✓
- Future MCP adapter left unbuilt; core is pure (fs only in extractors/CLI) → consistent with the pure `diffTokenNames`. ✓

**Placeholder scan:** No TBD/TODO; every code and command step shows full content. ✓

**Type consistency:** `DriftReport` fields, `diffTokenNames`, `collectTokenNames`, `namesFromBundle`, `namesFromManifest`, and `TokenBundle` are used with identical names/signatures across tasks and the CLI. ✓
