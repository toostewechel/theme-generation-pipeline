# Token Name-Drift Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the spatial Figma-vs-pipeline drift tool (v1) with a git-based guard that flags design-token names that *disappeared* (renames/removals) between two git states, ignoring additions.

**Architecture:** A pure core (`src/engine/token-drift.ts`) carries over the v1 DTCG walker `collectTokenNames`, adds `diffNames` (before/after set diff → removed/added/unchanged) and `namesAt(source, read)` (reads token names at a git source via an injected `FileReader`, so the core has no I/O). A tsx CLI (`scripts/checkTokenDrift.ts`) supplies a git-backed `FileReader` (`git show <ref>:path` / working-tree fs read), parses `--base`/`--head`/`--json`, prints a removed/added report, and exits 1/0/2. This revision retires all v1 `figma-drift` artifacts.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, tsx for CLI scripts, Node `fs`/`path`/`child_process`, git. No new dependencies.

## Global Constraints

- ESM imports use `.js` specifiers even for `.ts` files (e.g. `import { diffNames } from "./token-drift.js"`).
- Tests live beside source as `*.test.ts` using `import { describe, it, expect } from "vitest"`.
- The core `token-drift.ts` performs **no** I/O — `namesAt` takes an injected `FileReader`; all fs/git lives in the CLI.
- Comparison is **names only**. Never compare token values.
- `removed` (names in before, not after) is the breaking signal and the ONLY thing that sets `hasBreaking`. `added` is safe and never fails the check.
- Coverage = the `collections` block of `manifest.json`. The `styles` block is **not read**.
- Token files are flat DTCG; `$`-prefixed keys (e.g. `$description`) are metadata, skipped. Nested groups (if ever present) join with `-`.
- Exit codes: `0` = clean (no breaking), `1` = breaking (removed names), `2` = bad input (unknown ref / git unavailable / no manifest at either source).
- `git show <ref>:<repoPath>` needs the repo-root-relative path; the tokens dir is `src/tokens`. The CLI runs from repo root (`npm run`).
- npm passes CLI flags only after a `--` separator: `npm run check:token-drift -- --base main --head HEAD`. The no-arg default `npm run check:token-drift` needs no separator.
- This revision deletes all v1 `figma-drift` artifacts (module, test, CLI, ignore file, npm script, index re-export). `src/engine/figma-export.ts` is unrelated and stays.
- Commit after each task. End commit messages with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Pure core `token-drift.ts` (+ retire v1 figma-drift)

**Files:**
- Create: `src/engine/token-drift.ts`
- Create: `src/engine/token-drift.test.ts`
- Delete: `src/engine/figma-drift.ts`, `src/engine/figma-drift.test.ts`, `scripts/checkFigmaDrift.ts`, `scripts/figma-drift.ignore.json`
- Modify: `src/engine/index.ts` (swap re-export), `package.json` (remove the `check:figma-drift` script)

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `function collectTokenNames(node: Record<string, unknown>, into: Set<string>, prefix?: string): void`
  - `interface NameDiff { removed: string[]; added: string[]; unchanged: number; ignored: string[]; hasBreaking: boolean }`
  - `function diffNames(before: Set<string>, after: Set<string>, opts?: { ignore?: (string | RegExp)[] }): NameDiff`
  - `type NameSource = { ref: string } | { worktree: true }`
  - `type FileReader = (source: NameSource, relPath: string) => string | null`
  - `function namesAt(source: NameSource, read: FileReader): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `src/engine/token-drift.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  collectTokenNames,
  diffNames,
  namesAt,
  type FileReader,
  type NameSource,
} from "./token-drift.js";

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

describe("diffNames", () => {
  it("flags removed names as breaking, additions as safe", () => {
    const diff = diffNames(new Set(["a", "b", "c"]), new Set(["a", "b", "d"]));
    expect(diff.removed).toEqual(["c"]);
    expect(diff.added).toEqual(["d"]);
    expect(diff.unchanged).toBe(2);
    expect(diff.hasBreaking).toBe(true);
  });

  it("does not flag breaking when only additions occur", () => {
    const diff = diffNames(new Set(["a"]), new Set(["a", "b"]));
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual(["b"]);
    expect(diff.hasBreaking).toBe(false);
  });

  it("reports no change for identical sets", () => {
    const s = new Set(["a", "b"]);
    const diff = diffNames(s, new Set(s));
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.unchanged).toBe(2);
    expect(diff.hasBreaking).toBe(false);
  });

  it("excludes ignored names (string and regex) and clears hasBreaking", () => {
    const diff = diffNames(
      new Set(["color-fg", "color-prism-old"]),
      new Set(["color-fg-default"]),
      { ignore: ["color-fg", /^color-prism-/] },
    );
    expect(diff.ignored).toEqual(["color-fg", "color-prism-old"]);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual(["color-fg-default"]);
    expect(diff.hasBreaking).toBe(false);
  });

  it("returns sorted arrays", () => {
    const diff = diffNames(new Set(["b", "a"]), new Set(["d", "c"]));
    expect(diff.removed).toEqual(["a", "b"]);
    expect(diff.added).toEqual(["c", "d"]);
  });
});

describe("namesAt", () => {
  function fakeReader(files: Record<string, Record<string, string>>): FileReader {
    const key = (s: NameSource) => ("worktree" in s ? "worktree" : s.ref);
    return (source, relPath) => files[key(source)]?.[relPath] ?? null;
  }

  const manifest = JSON.stringify({
    collections: {
      color: { modes: { light: ["color.light.tokens.json"], dark: ["color.dark.tokens.json"] } },
      radius: { modes: { default: ["radius.default.tokens.json"] } },
    },
  });

  it("unions token names across all collection files", () => {
    const read = fakeReader({
      worktree: {
        "manifest.json": manifest,
        "color.light.tokens.json": JSON.stringify({ "color-fg-default": { $value: {} } }),
        "color.dark.tokens.json": JSON.stringify({ "color-bg-default": { $value: {} } }),
        "radius.default.tokens.json": JSON.stringify({ "radius-intensity": { $type: "dimension", $value: {} } }),
      },
    });
    expect([...namesAt({ worktree: true }, read)].sort()).toEqual([
      "color-bg-default",
      "color-fg-default",
      "radius-intensity",
    ]);
  });

  it("treats a file absent at the source (null) as contributing nothing", () => {
    const read = fakeReader({
      HEAD: {
        "manifest.json": manifest,
        "color.light.tokens.json": JSON.stringify({ "color-fg-default": { $value: {} } }),
      },
    });
    expect([...namesAt({ ref: "HEAD" }, read)]).toEqual(["color-fg-default"]);
  });

  it("returns an empty set when no manifest exists at the source", () => {
    expect(namesAt({ ref: "HEAD" }, fakeReader({})).size).toBe(0);
  });

  it("never reads the styles block", () => {
    const manifestWithStyles = JSON.stringify({
      collections: { color: { modes: { light: ["color.light.tokens.json"] } } },
      styles: { typography: ["typography.styles.tokens.json"] },
    });
    const read = fakeReader({
      worktree: {
        "manifest.json": manifestWithStyles,
        "color.light.tokens.json": JSON.stringify({ "color-fg-default": { $value: {} } }),
        "typography.styles.tokens.json": JSON.stringify({ "text-style-should-not-appear": { $type: "typography", $value: {} } }),
      },
    });
    const names = namesAt({ worktree: true }, read);
    expect(names.has("text-style-should-not-appear")).toBe(false);
    expect(names.has("color-fg-default")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/token-drift.test.ts`
Expected: FAIL — cannot resolve `./token-drift.js`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/token-drift.ts`:

```ts
// ─── DTCG name walker (carried over from the retired figma-drift module) ───

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

// ─── Name diff (temporal: before → after) ──────────────────────────────────

export interface NameDiff {
  /** In before, not after — renames-away + removals (BREAKING). */
  removed: string[];
  /** In after, not before — additions + renames-to (safe). */
  added: string[];
  /** Count of names present in both. */
  unchanged: number;
  /** Matched an ignore pattern; excluded from removed/added. */
  ignored: string[];
  /** True when removed is non-empty after ignores. */
  hasBreaking: boolean;
}

export function diffNames(
  before: Set<string>,
  after: Set<string>,
  opts: { ignore?: (string | RegExp)[] } = {},
): NameDiff {
  const ignore = opts.ignore ?? [];
  const isIgnored = (name: string) =>
    ignore.some((p) => (typeof p === "string" ? p === name : p.test(name)));

  const removed: string[] = [];
  const added: string[] = [];
  const ignored: string[] = [];
  let unchanged = 0;

  for (const name of new Set([...before, ...after])) {
    if (isIgnored(name)) {
      ignored.push(name);
      continue;
    }
    const inBefore = before.has(name);
    const inAfter = after.has(name);
    if (inBefore && inAfter) unchanged++;
    else if (inBefore) removed.push(name);
    else added.push(name);
  }

  for (const arr of [removed, added, ignored]) arr.sort();

  return { removed, added, unchanged, ignored, hasBreaking: removed.length > 0 };
}

// ─── Name reading at a git source (reader injected; core stays pure) ────────

export type NameSource = { ref: string } | { worktree: true };

/** Returns file content at the source, or null if the file does not exist there. */
export type FileReader = (source: NameSource, relPath: string) => string | null;

interface Manifest {
  collections: Record<string, { modes: Record<string, string[]> }>;
}

/**
 * Reads manifest.json at `source`, walks each file under manifest.collections,
 * and unions all token names. A null from the reader (file absent at that
 * source) contributes nothing. Returns an empty set if no manifest exists at
 * the source. The `styles` block is intentionally not read.
 */
export function namesAt(source: NameSource, read: FileReader): Set<string> {
  const names = new Set<string>();
  const manifestRaw = read(source, "manifest.json");
  if (manifestRaw === null) return names;
  const manifest = JSON.parse(manifestRaw) as Manifest;
  for (const collection of Object.values(manifest.collections)) {
    for (const files of Object.values(collection.modes)) {
      for (const filename of files) {
        const raw = read(source, filename);
        if (raw !== null) collectTokenNames(JSON.parse(raw) as Record<string, unknown>, names);
      }
    }
  }
  return names;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/token-drift.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Retire v1 figma-drift artifacts**

Delete the four v1 files:

```bash
git rm src/engine/figma-drift.ts src/engine/figma-drift.test.ts scripts/checkFigmaDrift.ts scripts/figma-drift.ignore.json
```

In `src/engine/index.ts`, replace the line `export * from "./figma-drift.js";` with:

```ts
export * from "./token-drift.js";
```

In `package.json`, remove the `check:figma-drift` script line entirely:

```
    "check:figma-drift": "npx tsx scripts/checkFigmaDrift.ts",
```

(Leave the JSON valid — the line above it keeps its trailing comma as appropriate. The replacement `check:token-drift` script is added in Task 2.)

- [ ] **Step 6: Run the full suite to confirm no dangling references**

Run: `npm test`
Expected: PASS. The figma-drift tests are gone; token-drift tests pass; all other suites unaffected. (Vitest does not import `scripts/`, so removing the CLI does not affect the suite.)

- [ ] **Step 7: Commit**

```bash
git add src/engine/token-drift.ts src/engine/token-drift.test.ts src/engine/index.ts package.json
git commit -m "$(cat <<'EOF'
feat(engine): git-based token-drift core; retire figma-drift v1

Replace the spatial Figma-vs-pipeline diff with diffNames (before→after
name sets) + namesAt (reader-injected, git-source aware). Keeps the DTCG
walker. Deletes the figma-drift module, CLI, ignore file, and npm script.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Git-backed CLI `checkTokenDrift.ts`

**Files:**
- Create: `scripts/checkTokenDrift.ts`
- Create: `scripts/token-drift.ignore.json`
- Modify: `package.json` (add the `check:token-drift` script)

**Interfaces:**
- Consumes: `diffNames`, `namesAt`, `type FileReader`, `type NameSource` from `../src/engine/token-drift.js`.
- Produces: a runnable command `npm run check:token-drift [-- --base <ref>] [--head <ref>] [--json]`.

- [ ] **Step 1: Create the ignore file**

Create `scripts/token-drift.ignore.json` (empty; entries are exact names or `/regex/` strings wrapped in slashes):

```json
[]
```

- [ ] **Step 2: Add the npm script**

In `package.json`, inside `"scripts"`, add after `"build:theme"`:

```json
    "check:token-drift": "npx tsx scripts/checkTokenDrift.ts",
```

(Ensure the preceding line keeps its trailing comma and the JSON stays valid.)

- [ ] **Step 3: Write the CLI**

Create `scripts/checkTokenDrift.ts`:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diffNames,
  namesAt,
  type FileReader,
  type NameSource,
} from "../src/engine/token-drift.js";

const TOKENS_DIR = "src/tokens";

function loadIgnore(path: string): (string | RegExp)[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8")) as string[];
  return raw.map((entry) =>
    entry.startsWith("/") && entry.endsWith("/") && entry.length > 2
      ? new RegExp(entry.slice(1, -1))
      : entry,
  );
}

const reader: FileReader = (source, relPath) => {
  const repoPath = join(TOKENS_DIR, relPath);
  if ("worktree" in source) {
    return existsSync(repoPath) ? readFileSync(repoPath, "utf-8") : null;
  }
  try {
    return execFileSync("git", ["show", `${source.ref}:${repoPath}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // file absent at this ref
  }
};

function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function describeSource(s: NameSource): string {
  return "worktree" in s ? "working tree" : s.ref;
}

function verifyRef(ref: string): void {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
  } catch {
    console.error(`Cannot resolve ref "${ref}" (is this a git repo, with git installed?).`);
    process.exit(2);
  }
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const baseRef = getFlag(args, "--base") ?? "HEAD";
  const headRef = getFlag(args, "--head"); // undefined → working tree

  verifyRef(baseRef);
  if (headRef) verifyRef(headRef);

  const base: NameSource = { ref: baseRef };
  const head: NameSource = headRef ? { ref: headRef } : { worktree: true };

  const before = namesAt(base, reader);
  const after = namesAt(head, reader);

  if (before.size === 0 && after.size === 0) {
    console.error(
      `No tokens found at base (${describeSource(base)}) or head (${describeSource(head)}) — is ${TOKENS_DIR}/manifest.json present?`,
    );
    process.exit(2);
  }

  const ignore = loadIgnore(join("scripts", "token-drift.ignore.json"));
  const diff = diffNames(before, after, { ignore });

  if (json) {
    console.log(JSON.stringify(diff, null, 2));
    process.exit(diff.hasBreaking ? 1 : 0);
  }

  console.log(`Token name-drift  (base: ${describeSource(base)} → head: ${describeSource(head)})`);
  console.log(`  ✓ ${diff.unchanged} unchanged`);
  if (diff.removed.length) {
    console.log(`  ⚠ ${diff.removed.length} removed (renames-away or removals — break consumers):`);
    for (const n of diff.removed) console.log(`      ${n}`);
  }
  if (diff.added.length) {
    console.log(`  + ${diff.added.length} added (safe):`);
    for (const n of diff.added) console.log(`      ${n}`);
  }
  if (diff.ignored.length) console.log(`  · ${diff.ignored.length} ignored`);

  process.exit(diff.hasBreaking ? 1 : 0);
}

main();
```

- [ ] **Step 4: Smoke-test the clean path (exit 0)**

With a clean `src/tokens` working tree (the implementation did not touch token files), HEAD and the working tree match:

```bash
npm run check:token-drift; echo "exit=$?"
```

Expected: report shows `unchanged` > 0, no `⚠ removed` line, and `exit=0`.

- [ ] **Step 5: Smoke-test the breaking path (exit 1), then restore**

Simulate a rename in the working tree, run, then restore the files. Note: `color-fg-default` exists in **both** `color.light` and `color.dark` (names union across mode files), so the rename must be applied to both files for the name to disappear from the union — this mirrors a real Figma variable rename, which is mode-agnostic:

```bash
npx tsx -e '
import { readFileSync, writeFileSync } from "node:fs";
for (const p of ["src/tokens/color.light.tokens.json", "src/tokens/color.dark.tokens.json"]) {
  const j = JSON.parse(readFileSync(p, "utf-8"));
  j["color-fg-RENAMED"] = j["color-fg-default"]; delete j["color-fg-default"];
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
'
npm run check:token-drift; echo "exit=$?"
git checkout -- src/tokens/color.light.tokens.json src/tokens/color.dark.tokens.json
```

Expected: `color-fg-default` listed under `removed`, `color-fg-RENAMED` under `added`, and `exit=1`. After `git checkout`, both files are restored. Confirm `git status` is clean before continuing.

- [ ] **Step 6: Smoke-test the CI ref mode (exit 0)**

Compare HEAD against itself to exercise the `--head <ref>` path and the `--` separator:

```bash
npm run check:token-drift -- --base HEAD --head HEAD; echo "exit=$?"
```

Expected: `0 removed`, `0 added`, `exit=0`.

- [ ] **Step 7: Verify the full suite still passes**

Run: `npm test`
Expected: all suites pass (token-drift core + existing engine suites).

- [ ] **Step 8: Commit**

```bash
git add scripts/checkTokenDrift.ts scripts/token-drift.ignore.json package.json
git commit -m "$(cat <<'EOF'
feat(scripts): add check:token-drift git-based CLI

Compares token names between two git states (default HEAD→worktree;
--base/--head for CI). Flags removed names (renames/removals) as
breaking, exits 1; additions are safe. Exit 2 on bad input.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Reframe + module rename + revise-in-place (retire v1) → Task 1 (deletes figma-drift module/test/CLI/ignore/script/export; adds token-drift). ✓
- Core API `collectTokenNames` (kept), `NameDiff`, `diffNames` (removed sets hasBreaking; added safe) → Task 1. ✓
- Git-aware reading `NameSource`, `FileReader`, `namesAt` (manifest-at-source, null→nothing, empty when no manifest, styles excluded) → Task 1 + tests. ✓
- CLI: default HEAD→worktree, `--base/--head` refs, `--json`, exit 0/1/2, git-backed reader (`git show`/fs), ignore list → Task 2. ✓
- `--` separator for npm flags → Global Constraints + Task 2 Step 6. ✓
- Ignore list as committed JSON (string + regex), defaults empty → Task 2 Step 1 + Task 1 diff logic. ✓
- Testing (diffNames cases, collectTokenNames, namesAt incl. styles-exclusion, CLI smoke clean/breaking/CI) → Tasks 1–2. ✓
- ID-ready future left unbuilt; core operates on name sets only → consistent. ✓

**Placeholder scan:** No TBD/TODO; every code and command step is complete. ✓

**Type consistency:** `NameDiff` fields, `diffNames`, `collectTokenNames`, `NameSource`, `FileReader`, `namesAt` are used with identical names/signatures across the core, tests, and CLI. The CLI imports exactly the symbols Task 1 exports. ✓
