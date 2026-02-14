# Phase 2 Plan 1: Multi-Mode CSS Output Summary

**One-liner:** Multi-mode CSS architecture with data-attribute selectors for runtime theme switching (light/dark colors, sharp/default/rounded/pill radius modes)

---

## Metadata

```yaml
phase: 02-multi-mode-architecture
plan: 01
subsystem: build-pipeline
tags: [css-output, multi-mode, theming, style-dictionary]
completed: 2026-02-14
duration: 7 min
```

---

## Context & Purpose

Implemented multi-mode architecture to enable runtime theme switching via HTML data-attributes. The build pipeline now generates a single CSS file with multiple selector blocks:
- `:root` establishes defaults (light colors + default radius)
- `[data-color-mode='light']` and `[data-color-mode='dark']` for color themes
- `[data-radius-mode='sharp|default|rounded|pill']` for radius themes

This enables consumers to switch themes by setting data-attributes on HTML elements (e.g., `<html data-color-mode="dark" data-radius-mode="rounded">`), with the CSS cascade applying the appropriate token values.

---

## What Was Built

### Changes Made

**File: `scripts/buildTokens.ts`** (163 insertions, 38 deletions)
- Replaced single-build css/advanced approach with multi-build strategy
- Separate Style Dictionary instances for: :root (base + defaults), light mode, dark mode, 4 radius modes
- Automatic mode detection from manifest.json collections
- Concatenation logic to merge separate builds into single output file
- Collision warning suppression (collisions are intentional across modes)

**File: `dist/css/tokens.css`** (generated, 485 lines)
- Single CSS file with 7 selector blocks in correct cascade order
- 330+ CSS custom properties across all modes
- Primitive tokens (colors, dimensions, typography) in :root
- Light color tokens duplicated in :root (defaults) and [data-color-mode='light']
- Dark color tokens in [data-color-mode='dark'] with different values for same token names
- Radius tokens across 4 mode selectors

---

## Dependency Graph

### Requires
- Phase 1 (Build Pipeline Foundation) - manifest reading, source discovery
- `style-dictionary-utils@6.0.1` - DTCG transforms via css/extended group
- `src/tokens/manifest.json` - collections with mode definitions
- Mode-specific token files: color.{light,dark}, radius.{sharp,default,rounded,pill}

### Provides
- Multi-mode CSS output capability
- Foundation for runtime theme switching
- Single-file CSS distribution (`dist/css/tokens.css`)

### Affects
- Future phases can add new mode collections (e.g., spacing modes)
- Consumers can switch themes via data-attributes without JavaScript bundle changes
- Build complexity increased (multiple SD instances vs single instance)

---

## Technical Implementation

### Architecture Pattern

**Multi-Build Concatenation Approach:**
1. Parse manifest to identify multi-mode vs single-mode collections
2. Create separate Style Dictionary build for each selector block:
   - Root build: primitives + light + default radius
   - Light mode build: primitives + light (filtered to light tokens only)
   - Dark mode build: primitives + dark (filtered to dark tokens only)
   - Each radius mode build: primitives + mode file (filtered)
3. Concatenate outputs preserving selector order (:root first, then data-attributes)
4. Clean up temporary files

**Why not css/advanced with rules?**
Style Dictionary v5 merges all source files into a single token dictionary at parse time. When multiple files define tokens with the same name (e.g., `color-background-surface-default` in both light and dark files), SD treats them as collisions and keeps only one (the last loaded). By the time the `css/advanced` format's `rules` array runs, the dark mode tokens have already been discarded. The multi-build approach loads each mode in isolation to avoid this collision deduplication.

### Key Technical Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Multi-build instead of css/advanced rules | Avoid token name collision/deduplication | More complex build logic, but correct output |
| Concatenate to single file | Simpler consumption, better performance | Build time slightly slower (7 builds vs 1) |
| Filter per build | Only output mode-specific tokens in each selector | Requires baseFiles in every build for reference resolution |
| `log: { warnings: 'disabled' }` | Collision warnings expected/intentional | Less visibility into unexpected collisions |

---

## Tech Stack

### Added
- None (uses existing dependencies)

### Patterns Introduced
- **Multi-instance Style Dictionary pattern**: Running multiple SD builds and concatenating outputs
- **Mode-based filtering pattern**: Using filePath matching in `filter` functions to isolate mode tokens
- **Manifest-driven mode detection**: Dynamically identifying multi-mode collections from manifest structure

---

## Key Files

### Created
- `dist/css/tokens.css` (generated, gitignored)

### Modified
- `scripts/buildTokens.ts` - Complete refactor from single-build to multi-build concatenation approach

---

## Verification Results

All success criteria met:

✅ `npm run build:tokens` succeeds
✅ dist/css/tokens.css has :root with light color + default radius defaults
✅ dist/css/tokens.css has [data-color-mode='light'] and [data-color-mode='dark'] selectors
✅ dist/css/tokens.css has [data-radius-mode='sharp|default|rounded|pill'] selectors
✅ :root before [data-*] in file order (line 5 vs 346+)
✅ Token var() chains preserved (outputReferences working)
✅ Same token names appear in multiple selectors:
- `--color-background-surface-default` in :root (light), [data-color-mode='light'] (light), [data-color-mode='dark'] (dark)
- Different values: `var(--color-neutral-0)` vs `var(--color-neutral-dark-surface-2)`
✅ Build is deterministic (two runs produce identical output)

**Sample output structure:**
```css
:root {
  --color-neutral-0: #fff;
  --color-neutral-dark-surface-1: #0a0a0a;
  /* ...primitives... */
  --color-background-surface-default: var(--color-neutral-0); /* light default */
  --radius-intensity: 1px; /* default radius */
}
[data-color-mode='light'] {
  --color-background-surface-default: var(--color-neutral-0);
  /* ...light semantic tokens... */
}
[data-color-mode='dark'] {
  --color-background-surface-default: var(--color-neutral-dark-surface-2);
  /* ...dark semantic tokens... */
}
[data-radius-mode='sharp'] { --radius-intensity: 0px; }
[data-radius-mode='default'] { --radius-intensity: 1px; }
[data-radius-mode='rounded'] { --radius-intensity: 2.5px; }
[data-radius-mode='pill'] { --radius-intensity: 9999px; }
```

---

## Deviations from Plan

### Implemented Deviations

**1. [Rule 3 - Blocking Issue] Multi-build concatenation instead of css/advanced format with rules array**
- **Found during:** Task 1 implementation
- **Issue:** Style Dictionary v5 deduplicates tokens with same names during source file parsing, before css/advanced rules can run. This caused dark color mode and non-default radius modes to be lost (23 token collisions detected). The css/advanced format's `rules` array operates on already-merged tokens, so by the time matchers run, duplicate tokens have already been discarded.
- **Fix:** Refactored to run 7 separate Style Dictionary builds (root defaults, light, dark, 4 radius modes), each loading only the source files needed for that selector. Each build filters to only output tokens from its mode file. Outputs are concatenated in correct cascade order.
- **Files modified:** scripts/buildTokens.ts (complete refactor)
- **Commit:** 231a4f9
- **Why blocking:** Could not generate correct multi-mode CSS output without resolving token collision issue. Plan's approach (css/advanced with rules) was theoretically correct but incompatible with SD's parse-time deduplication behavior.

---

## Lessons Learned

### What Went Well
- Manifest-driven mode detection works cleanly
- Multi-build approach generates correct output with proper cascade order
- Filter functions by filePath isolate mode tokens effectively
- Build remains deterministic despite multiple SD instances

### What Was Challenging
- Discovering that Style Dictionary deduplicates tokens before format rules run
- Debugging token collision issue (required adding logging to matchers to see which tokens were present)
- Understanding that css/advanced with rules is designed for single token set with metadata-based routing, not multi-file collision scenarios

### Recommendations
- Document this pattern for future multi-mode collections
- Consider contributing to Style Dictionary docs to clarify parse-time collision behavior
- If SD adds a "preserve duplicates" mode or per-rule source loading in future, revisit css/advanced approach

---

## Performance Impact

- Build time: ~7 seconds (vs ~2 seconds in Phase 1 single-build)
- Output size: 485 lines, ~18KB (vs ~135 lines Phase 1)
- 7 SD instances created (temporary memory overhead, cleaned up after build)
- Generated file size acceptable for single HTTP request

---

## Next Steps

Phase 2 complete. This output enables:
- Phase 3: Testing & validation of multi-mode output
- Phase 4: CI/CD integration with generated CSS
- Future: Adding new mode collections (e.g., spacing modes) follows same pattern

No follow-up tasks required. Build pipeline fully functional for multi-mode CSS generation.

---

## Self-Check: PASSED

✓ scripts/buildTokens.ts exists
✓ dist/css/tokens.css exists (generated)
✓ Commit 231a4f9 exists
