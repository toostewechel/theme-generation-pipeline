# Roadmap: Design Token Build Pipeline

## Overview

Transform DTCG design tokens into CSS custom properties through four focused phases: establish build pipeline foundation with manifest processing and reference resolution, implement multi-mode architecture with data-attribute selectors for theming, add token value transformations for colors and dimensions, and complete with typography composite handling.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Build Pipeline Foundation** - Manifest processing and basic CSS output with reference resolution
- [ ] **Phase 2: Multi-Mode Architecture** - Data-attribute selectors for theme switching in single CSS file
- [ ] **Phase 3: Value Transformations** - Color, dimension, and radius token transformations
- [ ] **Phase 4: Typography** - Composite typography token handling

## Phase Details

### Phase 1: Build Pipeline Foundation
**Goal**: Build script processes manifest.json and outputs CSS with resolved token references
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Running `npm run build:tokens` successfully creates `dist/css/tokens.css`
  2. Token references like `{color-neutral-500}` resolve to actual values in output
  3. All collections from manifest.json are processed and included in output
  4. Build runs deterministically (same input produces identical output every time)
**Plans**: TBD

Plans:
- [ ] 01-01: [TBD during planning]

### Phase 2: Multi-Mode Architecture
**Goal**: Single CSS file with data-attribute selectors for light/dark colors and radius modes
**Depends on**: Phase 1
**Requirements**: COLR-03, COLR-04, COLR-05, RADI-02, RADI-03, RADI-04, RADI-05, RADI-06, QUAL-01
**Success Criteria** (what must be TRUE):
  1. CSS output includes `:root` selector with default mode values (light colors, default radius)
  2. CSS output includes `[data-color-mode='light']` and `[data-color-mode='dark']` selectors with mode-specific color tokens
  3. CSS output includes `[data-radius-mode='sharp']`, `[data-radius-mode='default']`, `[data-radius-mode='rounded']`, and `[data-radius-mode='pill']` selectors
  4. Selectors appear in correct specificity order (`:root` first, then `[data-*]` overrides)
  5. Same semantic token name (e.g., `--color-background-surface-default`) appears in multiple mode selectors without collision
**Plans**: TBD

Plans:
- [ ] 02-01: [TBD during planning]

### Phase 3: Value Transformations
**Goal**: Token values transform correctly from DTCG format to CSS-ready output
**Depends on**: Phase 2
**Requirements**: COLR-01, COLR-02, DIMS-01, DIMS-02, DIMS-03, RADI-01
**Success Criteria** (what must be TRUE):
  1. DTCG sRGB color objects (with colorSpace/components) convert to valid CSS color values (rgb or hex)
  2. Primitive color, dimension, and radius tokens appear as CSS variables under `:root`
  3. Dimension tokens with px values convert to rem units using 16px base
  4. Dimension tokens with `$description: "unitless"` output as raw numbers without units
**Plans**: TBD

Plans:
- [ ] 03-01: [TBD during planning]

### Phase 4: Typography
**Goal**: Typography tokens output with CSS font shorthand and individual properties
**Depends on**: Phase 3
**Requirements**: TYPO-01, TYPO-02, TYPO-03
**Success Criteria** (what must be TRUE):
  1. Individual typography property tokens (font-size, font-weight, line-height, font-family) appear as separate CSS variables
  2. Composite typography style tokens appear as CSS font shorthand variables
  3. Primitive font tokens appear as CSS variables under `:root`
**Plans**: TBD

Plans:
- [ ] 04-01: [TBD during planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build Pipeline Foundation | 0/TBD | Not started | - |
| 2. Multi-Mode Architecture | 0/TBD | Not started | - |
| 3. Value Transformations | 0/TBD | Not started | - |
| 4. Typography | 0/TBD | Not started | - |
