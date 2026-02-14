# Coding Conventions

**Analysis Date:** 2026-02-14

## Naming Patterns

### Files

**Token files:**
- Pattern: `{collection}.{mode}.tokens.json`
- Examples: `color.light.tokens.json`, `primitives-color.mode-1.tokens.json`, `radius.sharp.tokens.json`
- Convention: Hyphenated collection names, dot-separated mode identifiers, `.tokens.json` suffix

**Manifest file:**
- Pattern: `manifest.json`
- Location: `src/tokens/manifest.json`

**Build scripts:**
- Pattern: `{action}{Target}.ts` (camelCase)
- Example: `buildTokens.ts`
- Location: `scripts/buildTokens.ts`

### Token Names

**Primitive tokens:**
- Pattern: `{category}-{scale}` or `{category}-{descriptor}-{value}`
- Examples: `color-neutral-500`, `font-size-1300`, `font-weight-semi-bold`, `space-4`, `radius-cap-lg`
- Convention: Lowercase with hyphens, descriptive scale/value identifiers
- Context-free naming - primitives stand alone without usage context

**Semantic tokens:**
- Pattern: `{category}-{context}-{variant}` or `{category}-{purpose}-{state}`
- Examples: `color-background-surface-default`, `color-text-emphasis`, `spacing-component-gap-xs`, `spacing-layout-section-md`
- Convention: Three or more hyphen-separated segments describing usage context and variant
- Always reference primitives via curly braces: `{color-neutral-500}`

**Special naming:**
- Mode identifiers: `mode-1` for single modes, semantic names for alternatives (e.g., `light`, `dark`, `sharp`, `rounded`, `pill`)
- Grouping: Collection names are lowercase hyphenated (e.g., `primitives-color`, `primitives-font`)

### Token Value References

- Pattern: `{token-name}` (curly braces)
- Used in: Token `$value` fields to reference other tokens
- Example: `"$value": "{color-neutral-0}"` or `"$value": "{font-family-serif}"`
- Scope: Cross-collection references supported (e.g., semantic tokens reference primitives)

## Token Structure (DTCG Format)

**Required properties:**
- `$type`: Token type (e.g., `color`, `dimension`, `fontFamily`, `fontWeight`)
- `$value`: Token value (scalar, reference, or object)

**Color value format (for primitives):**
```json
{
  "colorSpace": "srgb",
  "components": [0.95, 0.94, 0.97],
  "alpha": 1.0  // Optional alpha component
}
```
- Components are normalized 0-1 range
- Represents sRGB color space
- Optional alpha for transparency variants

**Dimension value format (when using units):**
```json
{
  "value": 4,
  "unit": "px"
}
```
- Used for precise pixel dimensions
- Alternative to simple numeric references

**Simple scalar values:**
```json
{
  "$type": "fontWeight",
  "$value": 600
}
```
- Direct values for weights, numbers
- Curly brace references for token-to-token references

## File Organization

**Token directory structure:**
```
src/tokens/
├── manifest.json
├── primitives-color.mode-1.tokens.json
├── primitives-font.mode-1.tokens.json
├── primitives-dimension.mode-1.tokens.json
├── primitives-radius.mode-1.tokens.json
├── color.light.tokens.json
├── color.dark.tokens.json
├── typography.mode-1.tokens.json
├── typography.styles.tokens.json
├── dimension.mode-1.tokens.json
└── radius.{mode}.tokens.json  // sharp, default, rounded, pill
```

**Build script location:**
- `scripts/buildTokens.ts` - Main build orchestration

## Code Style Patterns

### TypeScript Code Style

**Imports:**
- Use ES6 import syntax: `import { StyleDictionary } from "style-dictionary-utils"`
- Order: Standard library first, then third-party packages

**Variable naming:**
```typescript
// camelCase for variables and functions
const basePlatformConfig = { ... }
const lightSd = new StyleDictionary()
const lightBuild = await lightSd.extend({ ... })

// Semantic collection grouping
const primitives = [ ... ]
const semanticSingleMode = [ ... ]
const radiusModes = [ ... ]
```

**Object literals:**
- Multi-line for complex configurations
- Descriptive keys matching Style Dictionary API
- Inline comments for non-obvious logic

**Async/await:**
- Use `await` for SDK build operations: `await lightSd.extend(...)`
- Use `await` for platform builds: `await lightBuild.buildAllPlatforms()`
- Sequential builds within loops for token sets

### Configuration Patterns

**Shared configuration:**
```typescript
const basePlatformConfig = {
  prefix: "",
  buildPath: "./dist/css/",
  transformGroup: "css/extended",
  transforms: ["dimension/css"],
  outputUnit: "rem",
  basePxFontSize: 16,
  colorOutputFormat: "hex",
}
```
- Define once, spread into multiple platform configs
- Use spread operator: `...basePlatformConfig`

**Platform-specific overrides:**
- `files` array defines output destinations
- `format` specifies Style Dictionary output format (e.g., `css/advanced`)
- `options` object for format-specific settings (e.g., CSS selector, reference output)
- `filter` for selective token output (e.g., `isSource` to exclude included tokens)

**Naming convention for build operations:**
- Separate `StyleDictionary()` instances per build: `lightSd`, `darkSd`, `radiusSd`
- Corresponding build results: `lightBuild`, `darkBuild`, `radiusBuild`
- Console output messages: `console.log("✔ Built {filename}")`

## Comments and Documentation

**When to comment:**
- Explain non-obvious `include` vs `source` distinction in Style Dictionary
- Document filtering rationale (e.g., why `isSource` filter is used)
- Clarify multi-mode logic (e.g., radius mode loop)

**Existing pattern:**
```typescript
// Filtering is intentional for token references; only output source tokens, not included primitives
```

**Comment style:**
- Single-line comments for inline explanations
- Section separators: `// ============================================`
- Build phase headers clearly labeled

## Error Handling

**File system operations:**
```typescript
try {
  rmSync("./dist", { recursive: true, force: true })
} catch {
  // Directory doesn't exist, that's fine
}
```
- Silent catch blocks acceptable for non-critical operations
- Comments explain expected error scenarios

**Build operations:**
- No explicit error handling in build phase (assumes valid token structures)
- Console logging provides feedback: `console.log("✔ Built...")`
- Final success message: `console.log("\n✅ All tokens built successfully!")`

## Module Design

**Script entry point:**
- File: `scripts/buildTokens.ts`
- Single responsibility: Orchestrate multi-phase token builds
- Top-level logic flow: Initialize → Build base → Build dark mode → Build radius variants → Report success
- No exported functions - script is self-contained and executable

**Import patterns:**
- Destructure from packages: `import { StyleDictionary } from "style-dictionary-utils"`
- Import built-in modules: `import { rmSync } from "fs"`

**Data organization:**
- Array constants group related file paths: `primitives`, `semanticSingleMode`, `radiusModes`
- Loop over mode definitions for DRY principle in radius builds

---

*Convention analysis: 2026-02-14*
