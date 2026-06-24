# Token Name-Drift Guard — Design Spec

*Written 2026-06-24. A git-based guard that flags design-token variable **names** that disappeared between two git states — catching renames and removals (which break consumers) while ignoring additions (which don't). Source-agnostic: it works whether tokens are engine-generated or hand-authored in Figma.*

*Supersedes `2026-06-24-figma-name-drift-guardrail-design.md`. That spec compared a Figma export bundle against the committed pipeline tokens (a spatial diff). This one compares the token files across git revisions (a temporal diff). See "Why the rethink" below.*

## Goal

Designers author variables in Figma and export them as the token files in `src/tokens/`, overwriting what's there. Names change — sometimes by design, sometimes accidentally. A renamed or removed variable **breaks consumers** (code, components, downstream token references, the Figma round-trip). This guard flags those breaking name changes so a human consciously accepts them (by committing) or fixes the mistake.

Concretely: compare the set of token names at a **base** git state against a **head** state, and report names that **disappeared** (`removed` — renames-away + deletions, breaking) versus names that **appeared** (`added` — additions + renames-to, safe).

## Why the rethink (what changed from the superseded spec)

The first design compared a Figma *export* against the *current* `src/tokens`. Three problems surfaced:

1. **Renames/removals are changes over time, not space.** Catching them requires comparing against a *previous* baseline of names, not against the current pipeline state.
2. **The pipeline isn't always the authority.** Some themes are fully hand-authored in Figma; the color engine is an add-on, not a universal source of truth. So "diff Figma against the engine's expected names" doesn't generalize.
3. **The export lands as the `src/tokens/*.json` files themselves** (multiple files, overwritten in place) — not a separate bundle. Git already versions those files, so git history *is* the baseline store. No snapshot file, no export-format coupling.

The temporal, git-based model dissolves all three: it compares token names across git revisions of the same files, is agnostic to who produced them, and rides the existing "overwrite the tokens folder" workflow.

## Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Comparison model | **Temporal (git states), not spatial** | Renames/removals are diffs over time. Baseline = a prior git state of the token files. |
| What to flag | **`removed` = breaking; `added` = safe** | A disappeared name breaks consumers (rename-away or deletion). An appeared name does not. Only `removed` sets the failure flag. |
| Rename vs removal precision | **Name-based now, ID-ready later** | The export carries no Figma variable IDs (the exporter drops metadata). Without IDs a rename = one `removed` + one `added`; the `removed` half is the breaking signal we flag. ID-based pairing is a documented future extension. |
| Baseline store | **Git history of `src/tokens/*.json`** | The files are already committed and overwritten in place. No new snapshot file or export format. Git log of the token files is the audit trail. |
| Comparison endpoints | **Local default + CI mode** | Default `base=HEAD`, `head=worktree` (overwrite-then-check before committing). Optional `--base/--head` refs for CI (`main...HEAD`: does this branch rename/remove tokens?). |
| Reading names at a revision | **`git show <ref>:<path>`** | Non-destructive, no deps, builds exact full name sets at each side. |
| Coverage | **All collections in `manifest.json`** | Source-agnostic; every variable collection is watched. The `styles` block is not read (styles are not variables). |
| False-positive control | **Committed ignore list** | `scripts/token-drift.ignore.json` (strings/regex), defaults empty. Strips known-intentional churn from both buckets. |
| v1 code | **Revise in place** | v1 is unmerged. Keep `collectTokenNames`; drop `namesFromBundle` and the spatial framing; rename module/command `figma-drift` → `token-drift`. |

## Non-goals

- **No value comparison.** Names only. (Renames/removals are name events.)
- **No ID-based rename pairing in v1.** Documented future extension once the exporter embeds variable IDs.
- **No styles.** The `styles` block of `manifest.json` is out of scope (not variables).
- **No auto-fix / write-back.** The guard reports and sets an exit code; humans reconcile.
- **No engine/Figma authority arbitration.** The guard flags name disappearances regardless of source; it does not decide who wins.
- **No blocking git hook in v1.** Advisory CLI. Exit codes make a pre-commit hook or CI gate easy to add later, but installing one is out of scope.

## Architecture

Revises the v1 module; mirrors existing engine/script/test conventions.

```
src/engine/token-drift.ts        # pure core: collectTokenNames (walker), diffNames, namesAt (reader-injected)
src/engine/token-drift.test.ts   # unit tests (fake FileReader — no fs/git)
scripts/checkTokenDrift.ts       # CLI: git-backed FileReader, arg parsing, report, exit codes
scripts/token-drift.ignore.json  # committed ignore list; starts []
package.json                     # "check:token-drift": "npx tsx scripts/checkTokenDrift.ts"
src/engine/index.ts              # re-export ./token-drift.js (replacing ./figma-drift.js)
```

Removed in this revision: `src/engine/figma-drift.ts`, `src/engine/figma-drift.test.ts`, `scripts/checkFigmaDrift.ts`, `scripts/figma-drift.ignore.json`, and the `check:figma-drift` script.

The core (`token-drift.ts`) does no I/O — `namesAt` takes an injected `FileReader`. All git/fs lives in the CLI. This keeps the core trivially testable and lets a future ID-based classifier wrap it without touching it.

## Core API

```ts
/** A DTCG token node carries `$value` or `$type`. (unchanged from v1) */
export function collectTokenNames(node: Record<string, unknown>, into: Set<string>, prefix?: string): void;

export interface NameDiff {
  removed: string[];     // in before, not after — renames-away + removals (BREAKING)
  added: string[];       // in after, not before — additions + renames-to (safe)
  unchanged: number;     // count present in both
  ignored: string[];     // matched an ignore pattern; excluded from removed/added
  hasBreaking: boolean;  // removed.length > 0 (after ignores)
}

export function diffNames(
  before: Set<string>,
  after: Set<string>,
  opts?: { ignore?: (string | RegExp)[] },
): NameDiff;
```

`diffNames` strips ignored names from both sets first, then computes `removed = before − after`, `added = after − before`, `unchanged = |before ∩ after|`. Only `removed` (post-ignore) sets `hasBreaking`. All arrays sorted.

## Git-aware name reading

```ts
export type NameSource = { ref: string } | { worktree: true };

/** Returns file content at the source, or null if the file does not exist there. */
export type FileReader = (source: NameSource, relPath: string) => string | null;

/**
 * Reads manifest.json at `source`, walks each file under manifest.collections,
 * and unions all token names. A null from the reader (file absent at that
 * source) contributes nothing — so its names correctly count as added/removed.
 * Returns an empty set if no manifest exists at the source.
 */
export function namesAt(source: NameSource, read: FileReader): Set<string>;
```

`relPath` is relative to the tokens directory; the CLI's reader resolves it (and prefixes the repo-relative path for `git show`). `namesAt` reads the manifest **at its own source**, so files added or removed between revisions are handled correctly.

## CLI

`npm run check:token-drift [--base <ref>] [--head <ref>] [--json]`

- **Default (local):** base = `HEAD`, head = working tree (head defaults to the working tree when `--head` is omitted). The overwrite-then-check loop, before committing.
- **CI / PR:** `--base main --head HEAD` — flags renames/removals a branch introduces vs `main`. Passing `--head <ref>` switches head from the working tree to that ref.
- `--json` prints the raw `NameDiff`.

The CLI builds a git-backed `FileReader`:
- `{ worktree: true }` → `existsSync` + `readFileSync` of `src/tokens/<relPath>`, else `null`.
- `{ ref }` → `git show <ref>:src/tokens/<relPath>`, returning `null` on non-zero exit (file absent at that ref).

It reads names at base and head via `namesAt`, loads `scripts/token-drift.ignore.json`, calls `diffNames`, prints:

```
Token name-drift  (base: HEAD → head: working tree)
  ✓ 520 unchanged
  ⚠ 2 removed (renames-away or removals — break consumers):
      color-fg
      color-neutral-25
  + 1 added (safe):
      color-fg-default
  · 0 ignored
```

Exit codes: `1` if `hasBreaking`, `0` if clean, `2` on bad input (unknown ref, `git` unavailable, or no `manifest.json` at the head source).

## Default semantics

Drift = **unaccepted name disappearances in the working tree**; **committing = accepting**. After you commit the overwritten tokens, `HEAD` advances and a re-run is clean. The CI mode (`main...HEAD`) answers the orthogonal question "does this branch, as a whole, drop or rename any token vs main?"

**Union-across-modes semantics.** `namesAt` unions names across *all* of a collection's mode files (e.g. `color.light` + `color.dark`). A name is therefore reported as `removed` only when it disappears from **every** file that held it. This is correct for real authoring: a Figma variable's name is mode-agnostic, so a genuine rename propagates to all its mode files and is always caught. The one edge case it cannot see is a name that exists in some mode files but not its siblings — there, a single-file rename would be masked. The current token files are key-symmetric across modes, so this is inert today; ID-based matching (the future extension) removes the ambiguity entirely.

## Testing

- **`diffNames`** (fake data): removed-only flags breaking; added-only does not; unchanged counted; ignore (string + regex) strips from both buckets and clears `hasBreaking` when only ignored names differ; arrays sorted.
- **`collectTokenNames`**: retain v1 tests (flat keys, `$`-metadata skipped, nested groups joined with `-`).
- **`namesAt`** (fake `FileReader`): manifest references multiple files → names unioned across them; a file returning `null` at one source → its names appear as removed/added in a subsequent diff; no manifest at a source → empty set; the `styles` block is never read.
- **CLI smoke** (in the implementation plan): clean working tree → exit 0; after simulating a removed token name in the working tree → exit 1 with the name under `removed`.

## Future extensions (logged, not built)

- **ID-based rename pairing** — once the exporter embeds Figma variable IDs, a layer can pair a `removed`+`added` with the same ID into a precise "renamed X→Y" before/around `diffNames`, with no change to the core.
- **Pre-commit hook / CI gate** — wire the existing exit codes into a git hook or CI job to make the advisory check blocking.
- **Per-collection reporting** — group `removed`/`added` by collection if the flat list grows unwieldy.
