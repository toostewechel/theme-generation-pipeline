# Architecture

**Analysis Date:** 2026-02-14

## Pattern Overview

**Overall:** Token-Driven Design System Pipeline

**Key Characteristics:**
- Declarative token definition using DTCG (Design Tokens Community Group) format
- Layered token abstraction with primitives and semantic tokens
- Multi-mode support for theming (light/dark, design variations)
- Configuration-driven transformation pipeline
- Build-time token resolution and code generation

## Layers

**Token Definition Layer:**
- Purpose: Define design tokens in DTCG format with `$type` and `$value` properties
- Location: `src/tokens/`
- Contains: Token files organized by collection (primitives, semantic variants, mode-specific overrides)
- Depends on: File system storage
- Used by: Manifest layer for token aggregation

**Token Manifest Layer:**
- Purpose: Organize and declare token collections, modes, and groups
- Location: `src/tokens/manifest.json`
- Contains: Collection definitions with mode mappings and style definitions
- Depends on: Token definition files
- Used by: Build pipeline to determine which tokens to process

**Build Pipeline Layer:**
- Purpose: Transform token definitions into platform-specific outputs
- Location: Build scripts (referenced in `package.json` as `npm run build:tokens`)
- Contains: Style Dictionary configuration and transformation logic
- Depends on: Manifest and token files
- Used by: External consumers (CSS output in `dist/css/`)

**Output Layer:**
- Purpose: Platform-specific token representations
- Location: `dist/css/` (generated on build)
- Contains: Compiled CSS variables and other transformed outputs
- Depends on: Build pipeline processing
- Used by: Web applications and other consumers

## Data Flow

**Token Resolution Pipeline:**

1. **Token Definition** - Individual tokens defined in JSON files with DTCG format
2. **Manifest Declaration** - Manifest groups tokens into collections and defines modes
3. **Token Reference Resolution** - Curly brace syntax references (e.g., `{token-name}`) resolved during build
4. **Build Processing** - Style Dictionary reads manifest, loads all referenced token files
5. **Mode Transformation** - Mode-specific files override or supplement primitive tokens
6. **Code Generation** - Transformed tokens output to platform-specific formats (CSS, etc.)
7. **Artifact Output** - Generated files written to `dist/` directory

**Multi-Mode Resolution:**
- Primitive tokens (single mode) provide base values
- Semantic tokens select primitives based on context
- Mode files override parent values when applicable
- Example: `color` collection has `light` and `dark` modes that reference `primitives-color`

**State Management:**
- State is purely declarative in JSON token files
- No runtime state management; all resolution happens at build time
- Token references are immutable once built
- Multiple modes can coexist in same output

## Key Abstractions

**Primitive Tokens:**
- Purpose: Base design values that serve as references for semantic tokens
- Examples: `src/tokens/primitives-color.mode-1.tokens.json`, `src/tokens/primitives-font.mode-1.tokens.json`, `src/tokens/primitives-dimension.mode-1.tokens.json`, `src/tokens/primitives-radius.mode-1.tokens.json`
- Pattern: Direct value assignment (no token references), named by category and scale

**Semantic Tokens:**
- Purpose: Contextual tokens that reference primitives to provide meaning
- Examples: `src/tokens/color.light.tokens.json`, `src/tokens/color.dark.tokens.json`, `src/tokens/dimension.mode-1.tokens.json`
- Pattern: Reference primitives using curly brace syntax (e.g., `"{color-neutral-500}"`), named by category-context-variant

**Mode Tokens:**
- Purpose: Alternative token values for different design contexts (themes, styles)
- Examples: `src/tokens/radius.sharp.tokens.json`, `src/tokens/radius.default.tokens.json`, `src/tokens/radius.rounded.tokens.json`, `src/tokens/radius.pill.tokens.json`
- Pattern: Override or define subset of tokens specific to a mode, organized in manifest

**Composite Tokens:**
- Purpose: Complex token groupings that bundle related primitives (e.g., typography)
- Examples: `src/tokens/typography.mode-1.tokens.json` (font-family, font-weight, font-size, line-height, letter-spacing)
- Pattern: Individual property tokens that are logically grouped by naming convention

## Entry Points

**npm run build:tokens:**
- Location: Script defined in `package.json` running `npx tsx scripts/buildTokens.ts`
- Triggers: Manual build command or CI/CD pipeline
- Responsibilities: Orchestrates entire token transformation pipeline, reads manifest, processes all token files, generates outputs

**Manifest File:**
- Location: `src/tokens/manifest.json`
- Triggers: Referenced by build script
- Responsibilities: Declares which collections and modes to process, defines file mappings for each collection/mode combination

## Error Handling

**Strategy:** Configuration-first validation

**Patterns:**
- Token references must use exact token names (no fuzzy matching)
- Missing token references will cause build failure
- Invalid DTCG format will cause parsing errors
- Circular token references not allowed (built-in to resolution)

## Cross-Cutting Concerns

**Token Naming:** Consistent hierarchical naming using hyphens (primitives: `category-scale`, semantic: `category-context-variant`)

**Color Representation:** sRGB colorSpace with normalized component arrays (0-1 range), optional alpha channel

**Dimension Format:** Object with `value` and `unit` properties (primarily pixel-based with occasional fractional values)

**Typography Grouping:** Composite tokens break typography into individual properties, each with `typography-{style}-{property}` naming

**Token Reference Syntax:** Curly braces for references (e.g., `"{color-neutral-500}"`), resolved at build time

---

*Architecture analysis: 2026-02-14*
