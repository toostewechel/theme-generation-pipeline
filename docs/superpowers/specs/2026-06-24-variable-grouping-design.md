# Variable Grouping — Design Spec

*Written 2026-06-24. Adds group/nesting structure to the variables the Figma token importer writes, so they appear as a navigable hierarchy (`color → fg/bg/border → tokens`) instead of a flat list. Builds on the importer from `2026-06-24-figma-token-import-design.md`.*

## Goal

Today the importer names each Figma variable with the token's literal flat key (`color-fg-muted`, `color-neutral-700`), so the Variables panel is one long flat list (84 semantic + 128 primitive entries). Figma groups variables by `/` in their name; this feature names variables with a slash-path so designers get a tidy hierarchy — a quality-of-life upgrade — while keeping the round-trip with the pipeline lossless.

The change is a **pure, reversible naming transform**: the importer derives the grouped Figma name from the existing flat token key, and that grouped name normalizes straight back to the token key (so matching, aliases, and the round-trip are unaffected).

## Non-goals

- **No new bundle/engine format.** The pipeline keeps emitting flat DTCG keys; the hierarchy is recovered from those names at import. (Nested-DTCG emission was considered and rejected — see Alternatives.)
- **No importer-side name modifiers.** The importer never invents a `-default` suffix. Bare colliding names are skipped with a warning; the real fix is a rename at the source (see Prerequisite).
- **No pruning.** Variables left behind by a rename at the source (e.g. an old flat `color-fg`) are not deleted — consistent with the importer's existing no-prune rule.
- **No matching changes.** Grouped names normalize back to the flat token key via the existing `normalizeName`, so the update/create/skip matching is untouched.

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Grouping rule | Role-based, 2 levels: `color / <role> / <leaf>`, leaf keeps its dashes |
| Scope | Both color collections (`color` and `primitives-color`) — the transform is generic |
| Bare-name collisions | Skip + clear warning; no auto-modifier. Real fix is a source rename |
| Migration of existing flat variables | Rename in place (preserves variable IDs and bindings); idempotent |
| Where the logic lives | Pure helper + planner (Figma-free, unit-tested); importer only applies a precomputed name (Approach A) |

## The grouping rule

`groupedFigmaName(tokenName)` maps a flat token key to a slash-path:

```
segs = tokenName.split("-")
segs.length <= 2  →  segs.join("/")                                   // "color-fg"  -> "color/fg"
else              →  `${segs[0]}/${segs[1]}/${segs.slice(2).join("-")}`
```

Examples (against real token names):

| Token key | Grouped Figma name |
|-----------|--------------------|
| `color-fg-muted` | `color/fg/muted` |
| `color-fg-on-accent-subtle` | `color/fg/on-accent-subtle` |
| `color-bg-accent-subtle` | `color/bg/accent-subtle` |
| `color-control-background-default` | `color/control/background-default` |
| `color-neutral-700` | `color/neutral/700` |
| `color-fg` (bare) | `color/fg` → **collides**, skipped (see below) |

Properties that make it safe:

- **Reversible.** For every non-bare name, `normalizeName(groupedFigmaName(x)) === x` (slashes map back to dashes, lowercased). This is why matching needs no change.
- **Injective.** Two distinct token keys never produce the same grouped name, so renames never collide with each other.
- **2 levels only.** The leaf keeps its remaining dashes, so multi-word leaves (`on-accent-subtle`) don't explode into chains of near-empty single-child groups (the failure mode of a naive split-every-dash rule).

## Bare-name collisions

Figma cannot hold both a variable `color/fg` and a group `color/fg` (needed by `color/fg/muted`). A token collides iff:

- it has exactly **2 segments** (`color-fg`, `color-bg`), AND
- its `seg0/seg1` path is also a **group prefix** — i.e. some token with ≥3 segments shares the same `seg0/seg1`.

Only 2-segment tokens can collide: a ≥3-segment token is always a leaf under `seg0/seg1`, never itself a group. Colliding tokens are classified `skip` with a warning:

> `color-fg` can't be grouped (`color-fg-*` exists) — rename it to `color-fg-default` in the source.

In the current token set, exactly two names are bare and colliding: `color-fg` and `color-bg`.

## Architecture (Approach A)

The naming and collision logic live in the **pure, Figma-free core** (helper + planner). The importer — the only module touching the Figma API and the only one without unit tests — just applies a precomputed string.

### New: `src/helpers/groupName.ts` (pure)

```ts
// Map a flat token key to its grouped Figma variable name (slash-path).
export function groupedFigmaName(tokenName: string): string;
```

### Planner: `src/planner/matchPlan.ts`

Two additions; the existing update/create/skip classification, color conversion, and alias resolution are unchanged.

1. **Attach `figmaName`.** Every `PlanEntry` carries `figmaName = groupedFigmaName(tokenName)`.
2. **Detect bare collisions, per collection.** Build the set of group prefixes (`seg0/seg1`) from every token in the collection that has ≥3 segments. A 2-segment token whose `seg0/seg1` is in that set is classified `skip` (reason: bare-name collision) and adds a warning. This check runs before the existing color/alias handling so a colliding token is never also planned as a write.

### Types: `src/types/plan.ts`

`PlanEntry` gains:

```ts
figmaName?: string; // grouped Figma variable name (slash-path); falls back to tokenName
```

### Importer: `src/importers/variableImporter.ts`

Two changes, both in pass 1 (variable creation/resolution), inside the existing per-entry `try/catch`:

- **Create** with the grouped name:
  `figma.variables.createVariable(entry.figmaName ?? entry.tokenName, collection, "COLOR")`.
- **Update/migrate** renames in place:
  `if (entry.figmaName && variable.name !== entry.figmaName) variable.name = entry.figmaName;`
  Figma preserves the variable ID across a rename, so all existing bindings stay intact. Idempotent — an already-grouped name is a no-op.

The `varMap` stays keyed by `normalizeName(tokenName)`, so pass-2 value writes and cross-collection alias wiring are unaffected (the grouped name normalizes to the same key).

## Data flow (unchanged shape, one new field)

```
parseBundle → ParsedBundle
  → buildPlan: per entry attach figmaName; flag bare collisions as skip   [pure, tested]
  → PLAN_READY summary (skips now include bare collisions + warnings)
  → applyPlan pass 1: create(figmaName) / rename matched var to figmaName  [Figma API]
  → applyPlan pass 2: values + aliases (unchanged)
```

## Edge cases & error handling

- **Bare colliding token already present flat in Figma** (current `color-fg`): skipped — left flat and ungrouped, not renamed into a collision, not pruned. After the source rename it imports cleanly as `color/fg/default`; the stale flat `color-fg` lingers until manually deleted (no-prune is by design). Surfaced via the skip warning.
- **Rename failure at apply** (unexpected, e.g. a transient Figma collision): caught per-entry and reported in the result's `failed[]`, never aborts the batch.
- **Single-segment names** (length ≤ 1): returned unchanged by `groupedFigmaName` (no grouping).

## Prerequisite (separate, `theme-generation-pipeline` repo) — DONE 2026-06-24

**Status: completed.** `color-fg` → `color-fg-default` and `color-bg` → `color-bg-default` were renamed in the pipeline. Fresh bundles no longer contain bare colliding names, so they group cleanly as `color/fg/default` and `color/bg/default`. The importer's bare-collision skip+warn remains as defense against older/hand-made bundles.

The original prerequisite, for reference — rename the two bare semantic tokens at the source so they're never bare:

1. In `src/engine/semantics.ts`, rename `color-fg` → `color-fg-default` and `color-bg` → `color-bg-default`.
2. Regenerate: `npm run build:theme` then `npm run build:tokens`.
3. Update consumers of the renamed CSS variables (`--color-fg` → `--color-fg-default`, `--color-bg` → `--color-bg-default`) across the repo and any dependent code.

This is **consumer-facing** (the generated CSS variable names change) but small — exactly two tokens. It is sequenced independently of the importer change: until it lands, the importer safely **skips + warns** on the two bare names, so nothing breaks in the meantime. This spec's implementation plan covers the importer; the source rename is a small coordinated follow-up.

## Testing

Vitest, pure core (the importer's create/rename is verified manually in Figma — its testable inputs, the names and skip decisions, are covered in the planner tests):

- `groupName.test.ts` — `groupedFigmaName` across bare (`color-fg` → `color/fg`), 3-segment (`color-fg-muted` → `color/fg/muted`), 4+-segment (`color-fg-on-accent-subtle` → `color/fg/on-accent-subtle`), and primitive (`color-neutral-700` → `color/neutral/700`) cases; plus the reversibility invariant `normalizeName(groupedFigmaName(x)) === x` for non-bare names.
- `matchPlan.test.ts` — entries carry the expected `figmaName`; a bare token with children (`color-fg` alongside `color-fg-muted`) is classified `skip` with a warning; a bare token *without* children is **not** skipped and is named as a plain leaf; `figmaName` is correct for cross-collection aliases (the leaf still resolves).

## Alternatives considered

- **Importer-side `-default` modifier** (auto-rename bare names): rejected. It makes the Figma name (`color/fg/default`) no longer normalize back to the token key (`color-fg`), which forces special-case matching and creates a permanent asymmetry with the exporter plugin. Fixing at the source keeps the transform reversible.
- **Split every dash → slash** (full structural nesting): rejected. Over-nests multi-word leaves (`color-fg-on-accent-subtle` → four levels of single-child groups).
- **Emit nested DTCG groups from the engine**: rejected for now. Most "correct" long-term, but changes the engine, exporter, bundle format, parser, and round-trip simultaneously; the structural rule recovers the same hierarchy from existing flat names with zero pipeline-format change.

## Future extensions (out of scope)

- Deeper, role-aware sub-grouping (e.g. `control → background/border`) driven by a maintained role map.
- Optional pruning of variables orphaned by a source rename (behind an explicit confirm).
- Nested-DTCG emission from the engine, if the pipeline ever wants structure as the source of truth.
