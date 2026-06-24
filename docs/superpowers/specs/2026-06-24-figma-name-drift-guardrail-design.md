# Figma Name-Drift Guardrail — Design Spec

*Written 2026-06-24. A lightweight, advisory CLI that compares the set of design-token **names** in a Figma export against the names the pipeline emits, and reports divergence. Its purpose is to catch accidental renames or newly-added Figma variables that the pipeline doesn't know about — a handy guardrail while Figma remains the authoring tool, before any future move to engine-as-source-of-truth.*

## Goal

Make name divergence between Figma and the pipeline **visible**. Figma is currently where the design agency authors token structure (which variables exist and what they're called). The pipeline encodes that structure in code (`src/engine/semantics.ts` for semantic tokens; static token files for radius/dimension/typography; the engine for primitive ramps). When a designer renames or adds a variable in Figma, nothing today tells the pipeline. This guardrail closes that blind spot by diffing the two name sets and printing an actionable report.

It does **not** decide who wins. It surfaces drift so a human decides whether to reflect a Figma change in the engine/token files, or fix an accidental rename.

## Non-goals

- **No value comparison.** Names only. The engine deliberately retunes color *values*, so diffing values would be pure noise.
- **No structure/membership comparison.** A token moving between collections or modes is not flagged in v1 — only the flat union of names is compared.
- **No styles.** Figma text/effect styles (the `styles` block in `manifest.json`) are not variables and are out of scope. One-line extension later if wanted.
- **No live Figma access in v1.** The core is source-agnostic; v1 ships a file-based source only. A live Figma-MCP adapter is a documented future extension (see Approach 1 / §3).
- **No CI gate, no committed snapshot.** Advisory CLI only. It exits non-zero on drift so it *can* be wired into CI later, but nothing forces that today.
- **No auto-fix / write-back.** The tool reports; humans act.

## Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Figma data source | **Both / pluggable, file-based first** | Core takes a `Set<string>` from any source. v1 wires a file source (CI-friendly, offline, no auth). Live MCP adapter slots in later without touching the core. |
| What to compare | **Names only** | Catches renames/additions/removals. Engine retunes values by design, so value drift would be noise. |
| Coverage scope | **All collections** | Every collection in `manifest.json` — color (engine-generated), radius/dimension/typography (static files). Broadest safety net. `styles` excluded (not variables). |
| Run mode | **Advisory CLI** | `npm run check:figma-drift <export.json>`, prints a grouped report, exits non-zero on drift. No committed snapshot. Run on demand against a fresh export. |
| File input format | **Approach 1 — symmetric DTCG diff** | Input is the existing exporter plugin's DTCG `{ manifest, files }` bundle. Its keys are already pipeline-normalized, so the diff is exact and trivial; no fuzzy matching. |
| False-positive control | **Committed ignore list** | `scripts/figma-drift.ignore.json` (strings/regex sources). Keeps an advisory tool trustworthy instead of nagged-into-irrelevance. Defaults to empty. |

## Approach — symmetric DTCG diff (chosen) and the alternatives

**Approach 1 (chosen):** the file fed to the CLI is the existing exporter plugin's output — a DTCG `{ manifest, files }` bundle (same shape `buildTokenBundle` produces in `src/engine/figma-export.ts`). The exporter normalizes Figma names to pipeline format (`color/neutral/700` → `color-neutral-700`) at export time, so both sides are already in the same key space. The diff reduces to a set difference.

- ✅ Reuses a format that already exists in the ecosystem; keys are pre-normalized → no fuzzy matching.
- ✅ The future live-MCP adapter normalizes raw Figma names into the same key format and hands the core a `Set<string>` — core and CLI stay untouched.
- ⚠️ Requires the designer to export via the existing plugin (which they already do for the round-trip).

**Approach 2 — raw Figma variables diff (rejected):** feed a raw hierarchical-name dump and normalize on our side. Closer to "pull variable names" literally and shares the normalizer with the future MCP path, but it's a *different* export than the existing plugin, adding an authoring step.

**Approach 3 — format-sniffing hybrid (rejected for v1):** accept either shape. Most flexible, most code; YAGNI until a second format actually shows up.

## Architecture

Mirrors existing conventions (`figma-export.ts` core + `scripts/buildTheme.ts` CLI + `*.test.ts`):

```
src/engine/figma-drift.ts        # pure core: types, diff, name extractors (no fs, no process)
src/engine/figma-drift.test.ts   # unit tests with fixtures
scripts/checkFigmaDrift.ts       # CLI wrapper (tsx): reads files, calls core, prints, sets exit code
scripts/figma-drift.ignore.json  # committed ignore list (array of string/regex sources); starts []
package.json                     # + "check:figma-drift": "npx tsx scripts/checkFigmaDrift.ts"
```

The core is pure so it is trivially testable and the future MCP adapter reuses it verbatim.

## Core API

```ts
export interface DriftReport {
  matched: string[];           // in both — fine
  missingInPipeline: string[]; // in Figma, not in pipeline → new/renamed in Figma; reflect in engine/token files
  extraInPipeline: string[];   // in pipeline, not in Figma → removed/renamed in Figma?
  ignored: string[];           // matched an ignore pattern; excluded from the above
  hasDrift: boolean;           // missingInPipeline.length + extraInPipeline.length > 0
}

export function diffTokenNames(
  pipeline: Set<string>,
  figma: Set<string>,
  opts?: { ignore?: (string | RegExp)[] },
): DriftReport;
```

Pure set difference. Names matching any `ignore` entry are removed from both sets first and collected into `ignored`. All output arrays are sorted for stable, diffable reports.

## Name extraction — two adapters, both → `Set<string>`

- **Pipeline side** — `namesFromManifest(tokensDir: string): Set<string>`: read `manifest.json`; for every file under `collections.*.modes.*`, read the JSON and collect each token key. A token key is one whose value is an object containing `$value` or `$type`; `$`-prefixed metadata keys (e.g. `$description`) are skipped. Token files are flat (leaf tokens at top level), so keys *are* names. Union across all collections and modes. The `styles` block is **not** read.
- **Figma side** — `namesFromBundle(bundle: TokenBundle): Set<string>`: flatten token keys across `bundle.files`, same key-detection rule. Reuses the `TokenBundle` type exported from `figma-export.ts`.
- **Future (not in v1)** — `namesFromFigmaVariables(defs): Set<string>`: apply the exporter's `normalizeName` (`/`→`-`, whitespace→`-`, lowercase) to raw Figma variable names. Lets a live Figma-MCP fetch feed the same core.

Both v1 adapters tolerate nested groups defensively (walk objects, collect leaf tokens) even though current files are flat, so a future nested file doesn't silently miss tokens.

## CLI behavior

`npm run check:figma-drift <path-to-figma-export.json> [--json]`

1. Read the export JSON → `namesFromBundle`.
2. Read committed tokens → `namesFromManifest("src/tokens")`.
3. Load `scripts/figma-drift.ignore.json` (if present) → `opts.ignore`.
4. `diffTokenNames(...)` → print a grouped report:

```
Figma name-drift report
  ✓ 312 names matched
  ⚠ 2 in Figma but missing from pipeline (add to engine/semantics or token files):
      color-fg-brand-hover
      color-neutral-25
  ⚠ 1 in pipeline but missing from Figma (renamed/removed in Figma?):
      color-bg
  · 4 ignored
```

Exit `1` if `hasDrift`, else `0`. `--json` prints the raw `DriftReport` instead of the human report, for scripting. Missing/invalid input file → clear error message, exit `2`.

## Testing

`figma-drift.test.ts` covers the core with small inline fixtures:

- Identical name sets → `hasDrift === false`, empty diff arrays.
- A name present only on the Figma side → appears in `missingInPipeline`.
- A name present only on the pipeline side → appears in `extraInPipeline`.
- An `ignore` pattern (string and regex) → matched names land in `ignored`, excluded from drift; `hasDrift` reflects the remainder.
- `namesFromManifest` against a fixture token dir → skips `$description`, reads a multi-file collection (mirroring `primitives-color` mode-1's two files), and unions across modes.
- `namesFromBundle` against a fixture bundle → flattens keys across `files`.

Output arrays are asserted sorted so reports stay stable.

## Future extensions (logged, not built)

- **Live Figma-MCP source** via `namesFromFigmaVariables` + a `--figma <fileUrl>` CLI path.
- **Styles coverage** (text/effect styles) by reading the `manifest.json` `styles` block.
- **Structure/membership drift** (collection/mode changes), if name-only proves too coarse.
- **Engine-as-source-of-truth** — once authoring moves into the engine, this guardrail can invert (or be retired) since divergence would be resolved upstream.
