# Design Token Build Pipeline

## What This Is

A build pipeline that transforms DTCG-format design tokens into CSS custom properties using Style Dictionary v5 and style-dictionary-utils. It reads a manifest-driven token architecture (primitives, semantic tokens, multi-mode collections) and outputs a single combined CSS file with data-attribute selectors for theming. The primary consumer is web projects; app platform support is a future goal.

## Core Value

Reliable, zero-custom-logic token transformation — leverage Style Dictionary and style-dictionary-utils built-in functionality to minimize maintenance burden while producing correct, consumable CSS variables.

## Requirements

### Validated

- Token files exist in DTCG format with `$type`/`$value` properties — existing
- Manifest structure defines collections, modes, and file mappings — existing
- Primitive token collections: color, font, dimension, radius — existing
- Semantic token collections: color (light/dark), dimension, radius (4 modes), typography — existing
- Composite typography styles with individual property tokens — existing
- `$description: "unitless"` metadata convention for dimension tokens that stay as numbers — existing

### Active

- [ ] Build script (`buildTokens.ts`) reads manifest.json and processes all collections
- [ ] Primitive tokens emitted as CSS variables under `:root`
- [ ] Color semantic tokens output under `[data-color-mode='light']` and `[data-color-mode='dark']`
- [ ] Light color mode also output under `:root` as default
- [ ] Radius semantic tokens output under `[data-radius-mode='sharp|default|rounded|pill']`
- [ ] Default radius mode also output under `:root` as default
- [ ] Dimension tokens transformed from px to rem
- [ ] Tokens with `$description: "unitless"` skip rem conversion and output as raw numbers
- [ ] Typography composite tokens output as CSS font shorthand variables
- [ ] Typography individual property tokens output as separate CSS variables
- [ ] Single combined CSS output file (`dist/css/tokens.css`)
- [ ] Correct handling of same-named tokens across modes (no collisions)
- [ ] No custom transform/format logic — use Style Dictionary + style-dictionary-utils built-ins only

### Out of Scope

- App platform output (iOS, Android) — future milestone, not v1
- Runtime token switching (CSS-only, no JS runtime) — not needed
- Custom transforms or formats — explicitly avoided to reduce maintenance
- Token validation or linting — separate concern
- Design tool sync (Figma plugin, etc.) — separate tooling

## Context

- Tokens exported from a design tool in DTCG format with sRGB color objects (normalized 0-1 components)
- Style Dictionary v5.2.0 and style-dictionary-utils v6.0.1 already installed
- The `scripts/buildTokens.ts` file was previously deleted and needs to be rebuilt
- Radius uses a multiplier pattern: `radius-intensity` (unitless, varies per mode) combined with `radius-scale-*` and `radius-cap-*` primitives
- Color primitives use the DTCG color object format `{ colorSpace, components, alpha? }` which style-dictionary-utils handles natively
- Typography is split into individual property tokens (`typography-heading-lg-font-size`) and composite style tokens (`display-lg` with `$type: "typography"`)

## Constraints

- **Tech stack**: Style Dictionary v5 + style-dictionary-utils — already installed, must use these
- **No custom logic**: All transforms and formats must come from SD or SD-utils built-ins
- **Node version**: Requires Node.js v22.0.0+ (Style Dictionary v5 requirement)
- **Module system**: ESM (`"type": "module"` in package.json)
- **Output format**: CSS custom properties only (web-first)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single combined CSS file | Better performance than multiple files, simpler to consume | — Pending |
| `$description: "unitless"` for px-to-rem exceptions | Co-located with token definition, no separate config to maintain | — Pending |
| Separate data-attributes per collection (`data-color-mode`, `data-radius-mode`) | Independent mode switching, no coupling between color and radius themes | — Pending |
| Default modes in `:root` | Works without any data-attributes set, progressive enhancement | — Pending |
| No prefix on CSS variables | Shorter names, cleaner DX (`--color-background-surface-default`) | — Pending |
| Primitives emitted as CSS vars | Useful for debugging/prototyping, low cost to include | — Pending |

---
*Last updated: 2026-02-14 after initialization*
