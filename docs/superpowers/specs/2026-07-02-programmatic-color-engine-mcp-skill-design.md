# Programmatic Color Engine — CLI, Claude Skill & Figma MCP Write

*Written 2026-07-02. A design for driving the existing color engine programmatically — without the studio UI — from a Claude skill, and closing the manual Figma handoff by writing the generated primitive variables into a Figma file in place via the official Figma MCP.*

## Goal

Make the color engine callable from a prompt. Today the only non-repo way to get a theme into Figma is: open the studio → move sliders → "Copy tokens for Figma" → open the custom import plugin → paste/upload. This design replaces the UI-and-clipboard path with a **structured, scriptable** one:

> Give structured inputs (brand hex(es), contrast level, neutral tint) → the engine generates the theme → repo tokens/CSS rebuild **and** the `primitives-color` variables update in place in a Figma file — no manual paste.

The engine's core is **not** modified. `theme.config.ts` (a `ThemeInputs` object) remains the single source of truth. This is a callable surface wrapped around the untouched, already-isomorphic engine.

## Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rollout | **Staged (Approach 3)**: CLI+skill → Figma MCP write → (deferred) MCP server | Front-load value; defer server infra until a second client justifies it. |
| Skill input | **Structured inputs only** | Deterministic and predictable; no NL inference to debug. Closest to today's `theme.config.ts`. |
| Figma scope | **`primitives-color` only, update in place** | Preserves today's boundary — Figma owns the semantic `color` collection. In-place update keeps variable IDs, so existing bindings pick up new values. |
| Figma write mechanism | **Official Figma MCP `use_figma`** (Plugin-API script) | Fully programmatic — no paste, no plugin UI. The true "via MCP" path. |
| Color math location | **In the engine** (`buildFigmaVariablePlan`), not the `use_figma` script | Centralizes OKLCH→sRGB in one tested place; keeps the Figma script dumb glue with no color-lib dependency in the sandbox. |
| Safety | **Preview counts + confirm before any Figma write** | Prevents surprise writes; surfaces unmatched (would-create-new) tokens before mutating. |
| Relationship to custom plugin | **Additive, not a replacement** | The custom import plugin remains the first-import / fallback / no-Claude path. |

## Non-goals

- **No natural-language theme inference.** Inputs are structured values mapped deterministically to `ThemeInputs`.
- **No semantic collection write.** Only `primitives-color`. The `color` (light/dark semantic) collection stays Figma-owned, exactly as today.
- **No pruning.** Variables present in Figma but absent from the plan are left untouched.
- **No engine-core changes.** Only one additive engine function (`buildFigmaVariablePlan`) plus a ported name helper; the pure ramp/contrast/semantic modules are untouched.
- **No Stage 3 MCP server in this spec.** Its shape is sketched so Stage 1 doesn't foreclose it, but it is not built here.
- **No ID-based Figma matching.** Name-based matching per the import plugin's Approach A (see *Figma matching*).

## Architecture

Three stages over one callable surface. `theme.config.ts` is the single source of truth throughout.

```
Stage 1 — CLI + skill → repo
  structured inputs → engine → theme.config.ts + build:theme → src/tokens → build:tokens → dist/css

Stage 2 — skill → Figma via use_figma
  structured inputs → engine buildFigmaVariablePlan → flat plan JSON
                    → use_figma template (match by name, update in place) → primitives-color variables

Stage 3 — MCP server (DEFERRED, sketched only)
  thin server re-exposes the CLI's operations as MCP tools for other clients
```

## Components

### a. `scripts/generateTheme.ts` — thin I/O wrapper (Stage 1)

The single callable surface around the engine. Pure engine calls + filesystem; it lives in the I/O shell, respecting the engine's isomorphism boundary (the `smoke`/`isomorphism` tests that grep pure modules for `fs`/`path`/`node:` must still pass — this script is allowed to touch I/O, the engine modules are not).

**Input:** a `ThemeInputs`-shaped JSON via `--input <file>` or stdin. Structured only. Validated before any action (see *Validation*).

**Operations (composable flags):**
- `--write-config` — serialize inputs to `theme.config.ts` (reuse the studio's `serializeConfig`).
- `--build` — run the existing `writeGeneratedTokens(inputs, "src/tokens")` (i.e. what `build:theme` does).
- `--emit-bundle` — print the existing `{ manifest, files }` bundle (`serializeTokenBundle`) to stdout.
- `--emit-figma-plan` — print the new flat Figma write-plan JSON to stdout (see below).

Flags compose: a typical repo run is `--write-config --build`; the skill's Figma path calls `--emit-figma-plan` and pipes the result into the `use_figma` step.

### b. `buildFigmaVariablePlan(inputs)` — one new engine function (Stage 2)

Added to `src/engine/figma-export.ts`, alongside `buildTokenBundle`. Emits a **flat, Figma-write-ready plan** for the `primitives-color` collection only:

```ts
interface FigmaVariablePlan {
  collection: "primitives-color";
  modes: ["mode-1"];
  variables: Array<{
    tokenKey: string;   // flat engine key, e.g. "color-neutral-700" (the match key)
    figmaName: string;  // grouped slash-path, e.g. "color/neutral/700" (create/rename target)
    type: "COLOR";
    valuesByMode: { "mode-1": { r: number; g: number; b: number; a: number } }; // sRGB 0..1
  }>;
}
```

- **OKLCH→sRGB happens here**, using `culori` (already a dep, values already P3-clamped upstream by the engine). Results are byte-identical to the custom plugin's `colorConverter`, so the MCP path and the plugin path produce the same Figma values.
- Derives directly from `buildPrimitivesDtcg(inputs)` so the set of variables is exactly the primitives the pipeline emits — no separate source of truth.
- `figmaName`/`tokenKey` reversibility is guaranteed by the ported name helper (below).

### c. Ported name helper — `src/engine/figma-names.ts`

`groupedFigmaName(tokenKey)` and `normalizeName(figmaName)` **ported byte-identical from the exporter plugin** (`color-neutral-700` ↔ `color/neutral/700`; `normalizeName` lowercases and maps `/` and whitespace → `-`). This is the same invariant the import plugin's `helpers/name.ts` depends on: `normalizeName(groupedFigmaName(x)) === x`. Ported (not reimplemented) so the MCP write stays the exact inverse of the export naming. Covered by a round-trip test.

### d. Claude skill `generate-color-theme` (markdown)

Orchestration only — no new runtime. Steps:
1. **Collect & validate** structured inputs (brand hex(es) → accent hue/chroma seeds, contrast level, neutral tint, optional status seeds and dark-surface dials), map to `ThemeInputs`. Any `ThemeInputs` field not supplied (e.g. `status`, `darkSurfaces`, `alpha`) falls back to the current `theme.config.ts` values, so a minimal call still produces a complete, valid theme.
2. **Echo the resolved `ThemeInputs`** (including every defaulted field) and get user confirmation before writing anything — the confirmation is where any defaulting becomes visible.
3. **Repo path** (if requested): run `generateTheme.ts --write-config --build`, report the written files; optionally run `build:tokens`.
4. **Figma path** (if requested): load the **mandatory `figma-use` skill first**, run `generateTheme.ts --emit-figma-plan`, then invoke `mcp__claude_ai_Figma__use_figma` with the write template (below), passing the plan.

The skill never commits automatically; committing is a separate explicit step.

### e. The `use_figma` write template (Stage 2)

A stable Plugin-API script that reproduces the import plugin's semantics exactly:
1. Locate the `primitives-color` collection (create if absent) and its `mode-1` mode.
2. Read existing variables; build a match key per existing variable via `normalizeName(name)`.
3. For each plan entry: **match by normalized name → update value in place**; **no match → create** with `figmaName`; **never prune**.
4. Produce a **pre-write summary** (update / create / skip counts + the list of would-create-new names) → **confirm** → **apply**.

The match/plan logic mirrors the import plugin's specced `matchPlan` (Approach A, name-based). Because color math is done in the engine, the template carries no color library — it only sets `{r,g,b,a}` values it's handed.

### f. Stage 3 — MCP server (deferred, sketched)

If another client (Figma-side automation, CI, a second editor) needs the engine, promote the CLI's operations into a thin MCP server exposing e.g. `generate_theme(inputs) → bundle`, `emit_figma_plan(inputs) → plan`, `write_repo_tokens(inputs)`. Because Stage 1 already isolates the callable surface in `generateTheme.ts`, this is a wrapper over existing functions, not a rewrite. Not built in this spec.

## Data flow

```
structured inputs
   → skill: validate → map to ThemeInputs → confirm
   → generateTheme.ts
       ├─ repo:  writeGeneratedTokens → src/tokens → (build:tokens) → dist/css
       └─ figma: buildFigmaVariablePlan → plan JSON
                 → use_figma template: match by normalized name → update in place / create new / never prune
                 → summary → confirm → apply
```

## Validation & error handling

- **Input validation before any write.** Bad/unparseable hex, chroma or contrast out of range, unknown keys, or a malformed `ThemeInputs` shape fail fast in `generateTheme.ts` — nothing is written to the repo or Figma.
- **Figma write is gated.** The `use_figma` template computes and shows the update/create/skip summary and the list of unmatched (would-create-new) tokens, then waits for confirmation. This is the guard against a Figma-side rename silently duplicating a variable instead of updating it.
- **Repo build failures surface** with the underlying Style Dictionary / tsx error; the run stops.
- **No implicit commit.** Repo writes are left in the working tree for review.

## Testing

- **Engine — `buildFigmaVariablePlan` invariants:** every `primitives-color` token is present; every `valuesByMode` component is sRGB in `[0,1]`; `collection`/`modes` match the manifest (`primitives-color` / `mode-1`).
- **Engine — name round-trip:** `normalizeName(groupedFigmaName(k)) === k` for every emitted token key; and the ported helpers match the exporter's outputs on a fixture set.
- **Engine — color parity:** `buildFigmaVariablePlan`'s sRGB values equal the custom plugin's `colorConverter` output for a fixture theme (guards the "byte-identical values" claim).
- **CLI — golden tests:** `--emit-bundle` output equals `serializeTokenBundle(inputs)`; `--emit-figma-plan` output matches the `FigmaVariablePlan` schema; `--write-config` produces a `theme.config.ts` that re-parses to the same inputs.
- **Skill / template:** matching logic is validated by reference to the import plugin's `matchPlan` spec; the markdown skill itself is not unit-tested.

## Pipeline seam (what does and doesn't change)

- **Unchanged:** the engine core, `theme.config.ts` as source of truth, `build:tokens`/Style Dictionary, the semantic `color` collection ownership in Figma, and the custom import plugin.
- **Added:** `scripts/generateTheme.ts`, `buildFigmaVariablePlan` + `FigmaVariablePlan` type in `figma-export.ts`, `src/engine/figma-names.ts` (ported helpers), the `generate-color-theme` skill, and the `use_figma` write template.

## Why it works, in one line

> The engine already emits a Figma-ready result and is already isomorphic; wrapping one CLI and one plan-emitter around it — and doing the color math in the engine, not the Figma script — turns "open the studio and paste" into "structured input in, primitives updated in place," with the exact same values and the same in-place semantics as the existing plugin.
