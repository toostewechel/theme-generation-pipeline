# Requirements: Design Token Build Pipeline

**Defined:** 2026-02-14
**Core Value:** Reliable, zero-custom-logic token transformation using Style Dictionary and style-dictionary-utils built-ins

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Build Pipeline Core

- [ ] **PIPE-01**: Build script reads manifest.json and discovers all collections and their modes
- [ ] **PIPE-02**: Token references (`{token-name}`) resolve correctly across collections
- [ ] **PIPE-03**: Token names output as kebab-case CSS custom properties (no prefix)
- [ ] **PIPE-04**: All tokens output to single combined file `dist/css/tokens.css`
- [ ] **PIPE-05**: Build runs via `npm run build:tokens` command

### Color

- [ ] **COLR-01**: DTCG sRGB color objects convert to valid CSS color strings
- [ ] **COLR-02**: Primitive color tokens emit as CSS variables under `:root`
- [ ] **COLR-03**: Light color mode tokens emit under `:root` as default
- [ ] **COLR-04**: Light color mode tokens emit under `[data-color-mode='light']`
- [ ] **COLR-05**: Dark color mode tokens emit under `[data-color-mode='dark']`

### Dimensions

- [ ] **DIMS-01**: Dimension tokens with px values convert to rem (16px base)
- [ ] **DIMS-02**: Tokens with `$description: "unitless"` output as raw numbers (no unit)
- [ ] **DIMS-03**: Primitive dimension tokens (space, size) emit as CSS variables under `:root`

### Radius

- [ ] **RADI-01**: Primitive radius tokens emit as CSS variables under `:root`
- [ ] **RADI-02**: Default radius mode tokens emit under `:root` as default
- [ ] **RADI-03**: Default radius mode tokens emit under `[data-radius-mode='default']`
- [ ] **RADI-04**: Sharp radius mode tokens emit under `[data-radius-mode='sharp']`
- [ ] **RADI-05**: Rounded radius mode tokens emit under `[data-radius-mode='rounded']`
- [ ] **RADI-06**: Pill radius mode tokens emit under `[data-radius-mode='pill']`

### Typography

- [ ] **TYPO-01**: Individual typography property tokens emit as CSS variables under `:root`
- [ ] **TYPO-02**: Composite typography styles emit as CSS font shorthand variables under `:root`
- [ ] **TYPO-03**: Primitive font tokens (family, weight, size, line-height) emit as CSS variables under `:root`

### Build Quality

- [ ] **QUAL-01**: CSS selector ordering is correct (`:root` first, `[data-*]` selectors after)
- [ ] **QUAL-02**: No unresolved token references in output (no literal `{token-name}`)
- [ ] **QUAL-03**: Build output is deterministic (same input produces identical output)

## v2 Requirements

### Platform Extensions

- **PLAT-01**: Build pipeline outputs tokens for iOS (Swift)
- **PLAT-02**: Build pipeline outputs tokens for Android (Kotlin)
- **PLAT-03**: TypeScript type definitions generated for token names

### Output Options

- **OUTP-01**: Option to exclude primitive tokens from output (semantic-only mode)
- **OUTP-02**: Option for separate CSS files per collection/mode
- **OUTP-03**: JSON/JS object output format

## Out of Scope

| Feature | Reason |
|---------|--------|
| Runtime JavaScript theme switching | CSS-only pipeline, consumers implement switcher |
| CSS utility class generation | Not a token pipeline concern, use Tailwind if needed |
| Watch mode / dev server | Use external tools (nodemon), keep build script focused |
| Token documentation generation | Separate tooling concern |
| Figma plugin / design tool sync | Separate tooling, tokens exported manually |
| Custom transforms or formats | Explicitly avoided to minimize maintenance burden |
| CSS nesting or layers | Adds complexity without value for variable declarations |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | — | Pending |
| PIPE-02 | — | Pending |
| PIPE-03 | — | Pending |
| PIPE-04 | — | Pending |
| PIPE-05 | — | Pending |
| COLR-01 | — | Pending |
| COLR-02 | — | Pending |
| COLR-03 | — | Pending |
| COLR-04 | — | Pending |
| COLR-05 | — | Pending |
| DIMS-01 | — | Pending |
| DIMS-02 | — | Pending |
| DIMS-03 | — | Pending |
| RADI-01 | — | Pending |
| RADI-02 | — | Pending |
| RADI-03 | — | Pending |
| RADI-04 | — | Pending |
| RADI-05 | — | Pending |
| RADI-06 | — | Pending |
| TYPO-01 | — | Pending |
| TYPO-02 | — | Pending |
| TYPO-03 | — | Pending |
| QUAL-01 | — | Pending |
| QUAL-02 | — | Pending |
| QUAL-03 | — | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
