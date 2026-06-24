# Figma Token Import — Design Spec

*Written 2026-06-24. A first-party Figma plugin that reads the theme-generation pipeline's token bundle and writes the updated values back into a Figma file. It is the documented-but-unbuilt "future import plugin" referenced by the pipeline's `2026-06-22-figma-token-export-design.md` spec, and the inverse of the existing token **exporter** plugin.*

## Goal

Close the round-trip. The pipeline exports Figma variables → DTCG tokens, the color engine retunes them, and the color studio's **"Copy tokens for Figma"** button serializes the result into a `{ manifest, files }` bundle. This plugin consumes that bundle and pushes the updated color values back into Figma, **updating existing variables in place** so every component and style already bound to those variables picks up the new values automatically.

The plugin mirrors the exporter plugin's stack and conventions, inverted: where the exporter reads Figma and emits JSON, this reads JSON and writes Figma.

## Source material

- **Exporter plugin** (`figma-design-token-importer`) — code-convention reference: TypeScript, Webpack 5 dual-bundle, React + `@emotion/css` UI, `processors/` + `converters/` + `helpers/` + `types/` layout, `postMessage` protocol, path aliases, ESLint + Prettier, no test runner.
- **Pipeline** (`theme-generation-pipeline`) — produces the bundle. `src/engine/figma-export.ts` builds it; the color studio copies it to the clipboard. Bundle shape: `{ manifest, files }`, color values as `{ colorSpace: "oklch", components: [l,c,h], alpha? }` objects, semantic values as `"{reference}"` strings.
- **Export spec** — `theme-generation-pipeline/docs/superpowers/specs/2026-06-22-figma-token-export-design.md`. Documents the bundle format and an importer ingestion mapping. This spec builds the importer that mapping anticipated.

## Non-goals

- **No ID-based matching in v1.** Matching is name-based (see Approach A below). ID-based matching is a documented future extension.
- **No non-color collections.** Radius, dimension, typography variables and text/effect/paint styles are out of scope. The architecture leaves room to add them (one converter/importer per type, mirroring the exporter).
- **No pruning.** Variables that exist in Figma but not in the bundle are left untouched (not deleted).
- **No write-back into the pipeline repo.** The bundle is already the pipeline's own format; this plugin only writes Figma.
- **No P3-preserving variables.** Figma color variables are sRGB; P3→sRGB clipping happens at import, by design (see trade-offs).
- **No network access.** `manifest.json` declares `networkAccess: none`; everything is local.

## Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Round-trip model | **Update existing in place** | Preserves variable IDs, so existing component/style bindings update automatically. Create only what is genuinely new; never prune. |
| Input method | **File upload (primary) + paste (convenience)** | Upload is robust and works without the studio (can upload repo `tokens/*.json`). Paste matches the studio's clipboard workflow. Both share one parser. |
| Scope | **Color only, extensible** | That is what the engine generates and what the bundle carries today. Converter/importer architecture mirrors the exporter so non-color types slot in later. |
| Pre-write preview | **Summary counts + confirm** | Cheap to build, prevents surprise writes, surfaces unmatched tokens before anything is written. |
| Matching strategy | **Approach A — name-based** | Works today against the existing bundle with no exporter/pipeline changes; engine token names are deterministic. Trade-offs logged below. |

## Approach A — name-based matching (chosen) and the alternatives

**Approach A (chosen):** match each token to a Figma variable by **collection name + mode name + normalized variable name**. Token key `color-neutral-700` matches Figma variable `color/neutral/700` by applying the exporter's `normalizeName()` (`/`→`-`, whitespace→`-`, lowercase) to each existing variable's name and comparing.

- ✅ Works today with the existing bundle — zero changes to exporter or pipeline.
- ✅ Deterministic: the engine produces stable token names by construction.
- ✅ Doubles as a clean first-import path (empty file → everything is "create").
- ⚠️ **Trade-off:** breaks if a designer renames or reorganizes variables in Figma after the original export — those tokens fall through to "create as new" instead of "update." Mitigated by the preview screen, which lists unmatched tokens before any write.

**Approach B — ID-based via embedded metadata (rejected for v1):** enhance the exporter to embed `$extensions.figma.variableId` (+ collection/mode IDs), thread it through the (generative) engine, and match on exact ID. Survives renames, but requires coordinated changes across **three** repos and the engine currently drops all Figma metadata. IDs are also per-file, so a bundle imported into a *different* Figma file won't match.

**Approach C — hybrid (rejected for v1):** prefer embedded ID, fall back to name. Best precision, most work; only worth it once B exists.

**Logged for the future:** the converter/planner architecture isolates matching in `planner/matchPlan.ts`, so adding ID-then-name matching later is a localized change, not a rewrite.

## Architecture

Standalone plugin in the `design-token-importer` repo, reusing the exporter's stack:

- **TypeScript**, **Webpack 5** dual-bundle (`plugin.ts` sandbox + `ui.tsx` React iframe), `@emotion/css`, `@figma/plugin-typings`, ESLint (`@typescript-eslint` + `@figma/eslint-plugin-figma-plugins`) + Prettier, same `tsconfig.json` path aliases and `npm run start` / `build` / `lint` scripts.
- **New dependency vs. the exporter: `culori`** — OKLCH→sRGB conversion at import. Bundles into `plugin.js` cleanly; it is the same library the engine uses, so conversions stay consistent with the studio preview.
- `manifest.json`: `networkAccess: none`. UI default size ~460×600 to fit upload + summary.

### Sandbox vs UI split (the exporter's boundary, inverted)

- **UI thread** (`ui.tsx`): file upload + paste textarea, JSON parsing & bundle validation, renders the preview summary and result report. No Figma API.
- **Sandbox thread** (`plugin.ts`): all Figma Variable reads (to match existing) and writes (to apply). Receives the parsed bundle, builds the plan, applies on confirm.

### Module structure (inverting the exporter's folders)

```
src/
  plugin.ts                      # sandbox entry: onmessage → plan / apply
  ui/ ui.tsx, ui.html, css/      # React UI: upload, paste, preview, report
  parsers/
    bundleParser.ts              # accepts studio bundle OR loose files; validates → ParsedBundle
    manifestReader.ts            # manifest → collection/mode/file resolution
  converters/                    # inverse of exporter's converters (JSON value → Figma value)
    colorConverter.ts            # OKLCH/sRGB object → Figma RGBA {r,g,b,a} (0–1) via culori
    aliasConverter.ts            # "{token-name}" → target Figma variable id
  importers/                     # inverse of exporter's processors (per Figma asset type)
    variableImporter.ts          # create/locate collections+modes; match; set values & aliases
  planner/
    matchPlan.ts                 # build update/create/skip plan + diff summary (no writes)
  helpers/
    name.ts                      # SAME normalization as exporter (match keys ↔ figma names)
    color.ts                     # culori wrappers, gamut handling
  types/
    messageType.ts               # plugin ↔ UI protocol (mirrors exporter's enum)
    bundle.ts, plan.ts, color.ts # shared interfaces
```

`helpers/name.ts` **must be byte-identical to the exporter's normalization** — it is what makes name-based matching the exact inverse of the export naming. Copy it verbatim rather than reimplement.

## Data flow — parse → plan → preview → apply

Two-phase, because an accurate preview requires reading the *existing* Figma variables (sandbox-only) while parsing/conversion lives in the UI:

```
UI thread                         Sandbox thread (Figma API)
─────────                         ──────────────────────────
1. user uploads/pastes JSON
2. bundleParser validates → ParsedBundle
3. postMessage PLAN_REQUEST  ───▶ 4. read existing collections/variables
   (parsed bundle)                   matchPlan: per token, match by
                                      collection+mode+normalized name →
                                      classify update | create | skip,
                                      convert OKLCH→sRGB, resolve aliases
5. render summary  ◀───────────── 6. postMessage PLAN_READY (counts + warnings)
   [Cancel] [Apply]
7. user clicks Apply
8. postMessage APPLY_REQUEST ───▶ 9. variableImporter executes the cached plan
10. render report  ◀───────────── 11. postMessage APPLY_DONE (updated/created/skipped/failed)
```

Message enum (mirrors the exporter's `MessageType`): `PlanRequest`, `PlanReady`, `ApplyRequest`, `ApplyDone`, `Error`. The **plan is computed once and cached in the sandbox** between `PLAN_READY` and `APPLY_REQUEST`, so Apply executes exactly what was previewed (no recompute drift). A new upload invalidates the cache.

## Core logic — matching, conversion, alias wiring

**Matching (Approach A):** for each token in a file, resolve its target via `manifest → collection name → mode name`, then match the token key against existing variables in that collection by applying `normalizeName()` to each existing variable's name. Outcomes:
- **update** — match found → overwrite that mode's value, keep the variable ID.
- **create** — no match → new variable.
- **skip** — unsupported/malformed/type-conflict → warn, write nothing.

**Two-pass ordering (required for aliases):**
1. **Pass 1** — create/locate every collection, mode, and variable across the whole bundle, so every token name has a resolvable Figma variable ID.
2. **Pass 2** — set values and wire aliases.

This guarantees cross-collection aliases resolve: semantic `color.light`'s `{color-accent-500}` points into the `primitives-color` collection, which only works if primitives exist first. (This is the export spec's "wire aliases after both collections exist" step.)

**Color conversion:** OKLCH object `{ colorSpace:"oklch", components:[l,c,h], alpha? }` → culori → Figma `RGBA { r,g,b,a }` floats in 0–1. sRGB-object values pass straight through. P3→sRGB clipping at import is **by design and accepted** (see trade-offs).

**Alias conversion:** `"{token-name}"` → look up the Figma variable created/located for `token-name` in pass 1 → `setValueForMode(modeId, figma.variables.createVariableAlias(targetVar))`.

**Modes:** a collection's modes come from the manifest (`color` → `light`/`dark`; `primitives-color` → `mode-1`). On a freshly created collection, Figma auto-creates one default mode — rename it to the first manifest mode, then add the rest, avoiding orphan "Mode 1" leftovers.

**Variable type:** v1 handles `$type: color`. Non-color tokens present in the color files (e.g. `color-state-*-intensity` dimension/number tokens) are **skipped with a warning**, not failed.

## Edge cases & error handling

- **Invalid / non-bundle JSON** — `bundleParser` validates shape (`{manifest, files}` *or* loose `manifest.json` + `*.tokens.json`). On failure: clear UI error, no sandbox round-trip, no writes.
- **Manifest ↔ files mismatch** — manifest references a missing file (or vice-versa): warn in preview; import what is present.
- **Unresolvable alias** — `{token-name}` with no matching token in the bundle: skip that mode's value, warn. Never fabricate a value.
- **Unmatched tokens** (Approach A's main risk) — counted and listed in the preview as "will be created as new," so rename-induced duplicates are caught visually before Apply.
- **Type conflict** — token is `color` but an existing same-named variable is `FLOAT`/`STRING`: skip + warn. Never coerce/retype a bound variable.
- **Empty Figma file / first import** — everything classifies as "create"; collections/modes built from scratch. Works as a clean importer, not only an updater.
- **Partial apply failure** — per-variable writes are wrapped; one failure does not abort the batch. Failures are itemized in the final report.
- **Async APIs** — all reads/writes use `*Async` variable APIs (`getLocalVariableCollectionsAsync`, `getVariableByIdAsync`, `setValueForMode`), matching the exporter's async patterns.

## Testing

The exporter ships no test runner, but the conversion/matching/planning logic here is pure and high-risk. Add **Vitest** (consistent with the pipeline repo) for Figma-API-free logic:

- `colorConverter` — OKLCH→sRGB RGBA correctness, alpha handling, gamut clamp, sRGB passthrough.
- `helpers/name.ts` — normalization parity with the exporter; round-trip invariant `normalize(figmaName) === tokenKey`.
- `bundleParser` — accepts both studio-bundle and loose-files shapes; rejects malformed input.
- `matchPlan` — given a mocked "existing variables" snapshot + a bundle, produces correct update/create/skip classification and alias resolution. Figma API is mocked at the snapshot boundary.

Sandbox write code (`variableImporter`) is validated manually in Figma against a real export — same as the exporter's manual workflow.

## Trade-offs (logged)

- **Name-based matching breaks on renames.** Accepted for v1; surfaced in the preview; ID-based matching (B/C) is a localized future change isolated in `matchPlan.ts`.
- **P3→sRGB clipping at import.** The studio's P3 `oklch()` preview can read marginally more vivid than the Figma result. Accepted; a future version could carry P3.
- **No pruning.** Stale Figma variables are left untouched, so a file can accumulate variables no longer in the system. Accepted: deletion is destructive to bindings and is opt-in future work.
- **Adding `culori` to the plugin bundle.** Slightly larger `plugin.js`; justified because it keeps import conversions identical to the engine/studio.

## Future extensions (out of scope)

- ID-based / hybrid matching (Approach B/C), once the exporter embeds Figma metadata.
- Non-color collections (radius, dimension, typography) and text/effect/paint styles — same converter/importer pattern.
- Optional pruning of stale variables (behind an explicit confirm).
- Direct studio→plugin transport (e.g. a shared local handoff) to skip the manual copy/paste/upload step.
- **Agent-driven import via the Figma MCP.** Instead of the plugin sandbox, an agent could run the same ingestion against a live Figma file using the Figma MCP's `use_figma` (JS execution in the file context) — reading existing variables, building the plan, and writing values/aliases. This skips the manual copy/paste/upload entirely: the workflow is kicked off by an agent that takes the studio bundle (or runs the engine directly) and applies it. This is feasible **because the conversion/matching/planning logic (`parsers/`, `converters/`, `planner/matchPlan.ts`, `helpers/`) is deliberately Figma-API-free and decoupled from the `postMessage` protocol** — the only Figma-touching layer is `importers/variableImporter.ts`. To make both consumers (plugin sandbox + MCP agent) share one engine, keep that pure core importable as a standalone module (no `figma.*` calls, no UI imports), so the MCP path re-implements only the thin "read existing / write" boundary. Same two-pass ordering and alias-wiring rules apply.
