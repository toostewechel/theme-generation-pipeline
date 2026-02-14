# Design Token Build Pipeline

## What This Is

A build pipeline that transforms DTCG-format design tokens into a single CSS file with multi-mode theming support. Reads a manifest-driven token architecture (primitives, semantic tokens, multi-mode collections) and outputs CSS custom properties with `[data-color-mode]` and `[data-radius-mode]` selectors for runtime theme switching. Built on Style Dictionary v5 and style-dictionary-utils.

## Core Value

Reliable, zero-custom-logic token transformation — leverage Style Dictionary and style-dictionary-utils built-in functionality to minimize maintenance burden while producing correct, consumable CSS variables.

## Requirements

### Validated

- ✓ Build script reads manifest.json and discovers all collections and their modes — v1.0
- ✓ Primitive tokens emitted as CSS variables under `:root` — v1.0
- ✓ Color semantic tokens output under `[data-color-mode='light']` and `[data-color-mode='dark']` — v1.0
- ✓ Light color mode also output under `:root` as default — v1.0
- ✓ Radius semantic tokens output under `[data-radius-mode='sharp|default|rounded|pill']` — v1.0
- ✓ Default radius mode also output under `:root` as default — v1.0
- ✓ Dimension tokens transformed from px to rem (16px base) — v1.0
- ✓ Tokens with `$description: "unitless"` skip rem conversion and output as raw numbers — v1.0
- ✓ Typography composite tokens output as CSS font shorthand variables — v1.0
- ✓ Typography individual property tokens output as separate CSS variables — v1.0
- ✓ Single combined CSS output file (`dist/css/tokens.css`) — v1.0
- ✓ Correct handling of same-named tokens across modes (no collisions) — v1.0
- ✓ Token references resolve correctly across collections — v1.0
- ✓ CSS selector ordering correct (`:root` first, `[data-*]` after) — v1.0
- ✓ Build output is deterministic — v1.0
- ✓ Token files exist in DTCG format with `$type`/`$value` properties — existing
- ✓ Manifest structure defines collections, modes, and file mappings — existing

### Active

(None — next milestone will define new requirements)

### Out of Scope

- App platform output (iOS, Android) — future milestone, not v1
- Runtime JavaScript theme switching — CSS-only pipeline, consumers implement switcher
- Custom transforms or formats — explicitly avoided to reduce maintenance
- Token validation or linting — separate concern
- Design tool sync (Figma plugin, etc.) — separate tooling
- CSS utility class generation — not a token pipeline concern
- Watch mode / dev server — use external tools, keep build script focused

## Context

Shipped v1.0 with 300 LOC TypeScript (buildTokens.ts).
Tech stack: Style Dictionary v5.2.0, style-dictionary-utils v6.0.1, Node.js v22+, ESM.
Output: single `dist/css/tokens.css` with 485 lines, ~18KB.
Token architecture: 13 DTCG token files across 8 collections with 6 mode variants.
Build time: ~7 seconds (7 separate SD instances for multi-mode output).

## Constraints

- **Tech stack**: Style Dictionary v5 + style-dictionary-utils — already installed, must use these
- **Minimal custom logic**: One custom transform (dimension/unitless) kept to minimum; all other transforms from SD/SD-utils built-ins
- **Node version**: Requires Node.js v22.0.0+ (Style Dictionary v5 requirement)
- **Module system**: ESM (`"type": "module"` in package.json)
- **Output format**: CSS custom properties only (web-first)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single combined CSS file | Better performance than multiple files, simpler to consume | ✓ Good — 18KB single file, easy to import |
| `$description: "unitless"` for px-to-rem exceptions | Co-located with token definition, no separate config to maintain | ✓ Good — clean metadata pattern |
| Separate data-attributes per collection | Independent mode switching, no coupling between color and radius themes | ✓ Good — flexible theming |
| Default modes in `:root` | Works without any data-attributes set, progressive enhancement | ✓ Good — zero-config defaults |
| No prefix on CSS variables | Shorter names, cleaner DX | ✓ Good — `--color-background-surface-default` |
| Primitives emitted as CSS vars | Useful for debugging/prototyping, low cost to include | ✓ Good |
| css/extended transform group (style-dictionary-utils) | Built-in css transforms don't handle DTCG format | ✓ Good — handles sRGB, dimensions, typography correctly |
| Multi-build concatenation for modes | SD merges/deduplicates same-named tokens at parse time; css/advanced rules can't access deduplicated tokens | ✓ Good — correct output, acceptable build time |
| Explicit transforms array over transformGroup | Can't mix transformGroup with custom transforms | ✓ Good — required for dimension/unitless |
| Transform ordering: dimension/unitless before dimension/css | dimension/css adds px units; unitless must strip first | ✓ Good — correct output |

---
*Last updated: 2026-02-14 after v1.0 milestone*
