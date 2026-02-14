# Stack Research

**Domain:** Design Token Build Pipeline (DTCG to CSS)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Style Dictionary | 5.2.0 | Core token transformation engine | Industry standard for design token pipelines. v5 introduces async/ESM architecture, DTCG format support, and transitive transforms. Massive ecosystem, extensible, battle-tested. |
| style-dictionary-utils | 6.0.1 | Pre-built transforms and formats for DTCG tokens | Provides CSS-ready transforms for DTCG color objects (sRGB components), typography composites, dimension values. `css/advanced` format handles multi-mode output with data-attribute selectors. Maintained for SD v5+. |
| tsx | 4.x | TypeScript execution runtime | Zero-config TypeScript runner for build scripts. No compilation step needed. Fast, maintained, standard choice for TS build tooling. |
| Node.js | 22+ | Runtime environment | Style Dictionary v5.2.0 requires Node.js >=22.0.0 (uses native fetch, modern ESM features). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| colorjs.io | 0.5.2 (via SD-utils) | Color space conversions | Automatically included with style-dictionary-utils. Handles sRGB → hex/rgb/hsl conversions. Used by `color/css` transform. |
| color2k | 2.0.3 (via SD-utils) | Lightweight color manipulation | Automatically included. Used internally by SD-utils for color operations. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @types/node | Type definitions for Node.js | Ensure version matches Node.js runtime (v22+) |

## Style Dictionary v5 API Differences from v4

**CRITICAL CHANGES:**

| Area | v4 Pattern | v5 Pattern | Why Changed |
|------|------------|------------|-------------|
| **Module System** | CommonJS (`require()`) | ESM only (`import`) | Modern JS standard, better tree-shaking, async-first |
| **Async Operations** | Synchronous build | `await sd.buildAllPlatforms()` | Supports async transforms, parsers, formats |
| **Instantiation** | `StyleDictionary.extend(config)` | `new StyleDictionary(config)` | More explicit, supports async extend |
| **Config Format** | `.extend()` returns instance | Constructor creates instance, `.extend()` is async | Cleaner separation of concerns |
| **Transforms** | Auto-applied by type | Explicit via `transformGroup` or `transforms` array | More control, no magic behavior |
| **Hooks** | `registerTransform()` before extend | `hooks.transforms` in config object | Co-located configuration |

**v5 API Signature:**
```typescript
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['src/tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css', // or explicit transforms array
      buildPath: 'dist/css/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: { outputReferences: true }
      }]
    }
  },
  hooks: {
    transforms: { /* custom transforms */ },
    formats: { /* custom formats */ }
  }
});

await sd.buildAllPlatforms(); // ASYNC in v5
```

## Built-in Transforms (Style Dictionary v5)

### Color Transforms

| Transform Name | Input | Output | Notes |
|----------------|-------|--------|-------|
| `color/css` | Hex, rgb(), hsl(), DTCG color object | CSS color string (hex default) | **Does NOT handle sRGB component arrays by default**. Use SD-utils version. |

### Dimension Transforms

| Transform Name | Input | Output | Notes |
|----------------|-------|--------|-------|
| `dimension/px` | Number | `{value}px` | Simple number to px conversion |
| `dimension/rem` | Number (assumes px) | `{value/16}rem` | Converts px to rem (16px base) |

### Name Transforms

| Transform Name | Output Format | Example |
|----------------|---------------|---------|
| `name/kebab` | kebab-case | `color-background-primary` |
| `name/camel` | camelCase | `colorBackgroundPrimary` |
| `name/pascal` | PascalCase | `ColorBackgroundPrimary` |

**LIMITATION:** Built-in SD v5 transforms do NOT handle:
- DTCG sRGB color objects with component arrays (requires SD-utils)
- Typography composite tokens (requires SD-utils)
- Dimension objects with `{value, unit}` (requires SD-utils)

## Built-in Transforms (style-dictionary-utils v6)

### Critical Transforms for This Project

| Transform Name | Input Type | Input Format | Output | Confidence |
|----------------|------------|--------------|--------|------------|
| `color/css` | `color` ($type) | `{colorSpace: "srgb", components: [r, g, b], alpha?: n}` | `rgb(r g b / alpha)` or hex | HIGH |
| `typography/css` | `typography` | `{fontFamily, fontSize, fontWeight, lineHeight, letterSpacing}` | CSS `font` shorthand | HIGH |
| `dimension/css` | `dimension` | `{value: number, unit: string}` | `{value}{unit}` (converts px→rem if `basePxFontSize` set) | HIGH |
| `fontFamily/css` | `fontFamily` | `string` or `string[]` | Comma-separated, quoted families | HIGH |
| `fontWeight/number` | `fontWeight` | String ("bold", "normal") or number | Numeric weight (400, 700, etc.) | HIGH |

### Additional Available Transforms

| Transform Name | Purpose | When to Use |
|----------------|---------|-------------|
| `name/pathToDotNotation` | Convert token path to dot notation | JS/JSON output formats |
| `name/pathToCamelCase` | Convert token path to camelCase | JS object keys |
| `name/pathToPascalCase` | Convert token path to PascalCase | TypeScript types |
| `gradient/css` | Convert gradient tokens to CSS | If project adds gradients |
| `shadow/css` | Convert shadow tokens to CSS box-shadow | If project adds shadows |
| `cubicBezier/css` | Convert timing tokens to CSS | If project adds animations |
| `clamp/css` | Convert clamp tokens to CSS clamp() | Fluid typography/spacing |

## Built-in Formats

### Style Dictionary v5 Formats

| Format Name | Output | Use Case |
|-------------|--------|----------|
| `css/variables` | `:root { --token: value; }` | Simple CSS variables, no selector customization |
| `scss/variables` | `$token: value;` | Sass variables |
| `json/nested` | Nested JSON object | Token inspection, documentation |

### style-dictionary-utils Formats

| Format Name | Output | Options | Use Case | Confidence |
|-------------|--------|---------|----------|------------|
| `css/advanced` | CSS custom properties with configurable selectors and media queries | `selector`, `rules`, `outputReferences` | **Primary format for this project**. Handles multi-mode tokens (light/dark, radius variants) with data-attribute selectors. | HIGH |
| `javascript/esm` | `export default { tokens }` | - | JS consumption | MEDIUM |
| `typescript/esm-declarations` | `.d.ts` type declarations | - | TypeScript autocomplete | MEDIUM |
| `javascript/commonJs` | `module.exports = { tokens }` | - | Legacy JS | LOW |

## css/advanced Format (Primary Format)

**Why this format:**
- Supports wrapping CSS variables in custom selectors (e.g., `[data-theme="dark"]`)
- Supports `rules` array for multiple output blocks (e.g., media queries for responsive tokens)
- Supports `outputReferences: true` to preserve token references in output
- Handles mode-based token files (light/dark, radius variants)

**Configuration Pattern:**
```typescript
{
  destination: 'tokens.css',
  format: 'css/advanced',
  options: {
    selector: '[data-theme="light"]', // Wraps all variables; use false to disable
    outputReferences: true, // Preserves {token} references as var(--token)
    rules: [
      {
        selector: '[data-theme="dark"]',
        matcher: (token) => token.filePath.includes('dark') // Filter tokens for this rule
      },
      {
        atRule: '@media (min-width: 768px)',
        selector: '[data-radius="rounded"]',
        matcher: (token) => token.filePath.includes('radius.rounded')
      }
    ]
  }
}
```

**Output Example:**
```css
[data-theme="light"] {
  --color-background-primary: #ffffff;
}
[data-theme="dark"] {
  --color-background-primary: #0a0a0a;
}
@media (min-width: 768px) {
  [data-radius="rounded"] {
    --border-radius-default: 8px;
  }
}
```

## Handling Multi-Mode Tokens

**Problem:** Tokens have same name but different values per mode (e.g., `color.light.json` and `color.dark.json` both define `color-background-primary`).

**Solution Pattern (per mode file):**

```typescript
// Build config with separate files per mode
platforms: {
  css: {
    transforms: ['color/css', 'dimension/css', 'typography/css', 'name/kebab'],
    buildPath: 'dist/css/',
    files: [
      {
        destination: 'tokens.light.css',
        filter: (token) => token.filePath.includes('light'),
        format: 'css/advanced',
        options: {
          selector: '[data-theme="light"]',
          outputReferences: true
        }
      },
      {
        destination: 'tokens.dark.css',
        filter: (token) => token.filePath.includes('dark'),
        format: 'css/advanced',
        options: {
          selector: '[data-theme="dark"]',
          outputReferences: true
        }
      }
    ]
  }
}
```

**Alternative: Single File with Rules:**

```typescript
{
  destination: 'tokens.css',
  format: 'css/advanced',
  options: {
    selector: false, // No default wrapper
    rules: [
      {
        selector: '[data-theme="light"]',
        matcher: (token) => token.filePath.includes('light')
      },
      {
        selector: '[data-theme="dark"]',
        matcher: (token) => token.filePath.includes('dark')
      },
      {
        selector: '[data-radius="sharp"]',
        matcher: (token) => token.filePath.includes('radius.sharp')
      },
      // ... etc for all modes
    ]
  }
}
```

**Recommendation:** Single file with rules. Easier to manage, single HTTP request, atomic theme switching.

## $description Field Usage

**Question:** Can `$description` be used for filtering in transforms?

**Answer:** NO (MEDIUM confidence).

`$description` is a DTCG metadata field. Style Dictionary exposes it on `token.$description`, but:
- Built-in transforms do NOT read `$description` for filtering
- `$description` is for documentation/tooling, not build logic
- Filtering should use `token.$type`, `token.path`, `token.filePath`, or custom attributes

**Example (from token file):**
```json
{
  "color-state-disabled-opacity": {
    "$description": "unitless",
    "$type": "dimension",
    "$value": { "value": 0.5, "unit": "px" }
  }
}
```

**Transform Filter Pattern:**
```typescript
{
  name: 'dimension/unitless',
  type: 'value',
  filter: (token) => {
    // DO NOT use token.$description - unreliable for build logic
    // Instead: use $type, path, or custom attributes
    return token.$type === 'dimension' && token.path.includes('opacity');
  },
  transform: (token) => token.$value.value // Strip unit
}
```

**Why "unitless" tokens use dimension type with "px" unit:** Likely a tokens-studio or design tool export quirk. Handle with custom transform if needed, but filter by path/name, not `$description`.

## Installation

```bash
# Already installed in this project
npm install -D style-dictionary@^5.2.0 style-dictionary-utils@^6.0.1 tsx@^4.0.0 @types/node@^25.0.10
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| style-dictionary-utils | Custom transforms | If you need transforms SD-utils doesn't provide (rare). SD-utils covers 90% of use cases. |
| Style Dictionary | Theo (Salesforce) | Never. Theo is deprecated, last updated 2019. |
| Style Dictionary | Cobalt-UI | If you need Figma API integration or real-time sync. Cobalt has tighter Figma integration but smaller ecosystem. |
| css/advanced format | css/variables + post-processing | If you need custom output format SD-utils doesn't support. Post-processing with PostCSS adds complexity. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Style Dictionary v4 API | Breaking changes in v5 (ESM, async, config format) | v5 API patterns (see above) |
| Built-in `color/css` for DTCG sRGB objects | Doesn't parse `{colorSpace, components}` format | `color/css` from style-dictionary-utils |
| Synchronous `buildAllPlatforms()` | v5 is async-first, returns Promise | `await sd.buildAllPlatforms()` |
| `StyleDictionary.extend(config)` | v4 pattern, still works but deprecated | `new StyleDictionary(config)` then `await sd.extend()` if needed |
| Manual color conversion logic | Reinventing the wheel, color math is complex | style-dictionary-utils `color/css` transform |
| Separate build per token file | Massive config duplication, slow builds | Filter/matcher functions to route tokens to appropriate outputs |

## Stack Patterns by Variant

**If building for a single mode (no theming):**
- Use single output file
- Use `css/variables` format or `css/advanced` with `selector: ':root'`
- Simpler config, no filtering needed

**If building for multiple themes (light/dark):**
- Use `css/advanced` format with `rules` array
- One rule per theme mode with `matcher` function
- Single output file for atomic theme application

**If building for multiple platforms (CSS + JS):**
- Define multiple platforms in config
- CSS platform: `css/advanced` format, `color/css`, `dimension/css` transforms
- JS platform: `javascript/esm` format, `name/pathToCamelCase` transform
- Share source tokens, diverge at platform level

**If tokens have circular references:**
- Use `transitive: true` on transforms
- Enable `outputReferences: true` in formats
- SD v5 resolves references in multiple passes

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| style-dictionary@5.2.0 | Node.js >=22.0.0 | Hard requirement in package.json engines field |
| style-dictionary-utils@6.0.1 | style-dictionary@^5 | Peer dependency, will not work with SD v4 |
| tsx@4.x | Node.js 18+ | Works with Node 22+, no compatibility issues |
| @types/node@25.x | Node.js 22+ | Match types to runtime version |

**Breaking:** style-dictionary-utils v6 requires Style Dictionary v5. If locked to SD v4, use style-dictionary-utils v2.4.1 (not recommended, outdated).

## Configuration Best Practices

### Transform Order Matters

Transforms are applied in order. For DTCG tokens:

1. **Reference resolution** (automatic in SD v5)
2. **Value transforms** (`color/css`, `dimension/css`, `typography/css`)
3. **Name transforms** (`name/kebab`)

**Correct Order:**
```typescript
transforms: [
  'color/css',       // Transform color objects FIRST
  'dimension/css',   // Transform dimension objects
  'typography/css',  // Transform typography composites
  'fontFamily/css',  // Transform font families
  'fontWeight/number', // Transform font weights
  'name/kebab'       // Transform names LAST
]
```

**Wrong Order:**
```typescript
transforms: [
  'name/kebab',      // ❌ Name transform first
  'color/css',       // Now token.name is already transformed, can break matchers
]
```

### Transitive Transforms for References

If tokens reference other tokens, transforms must be `transitive: true`:

```typescript
hooks: {
  transforms: {
    'color/css': {
      ...existingTransform,
      transitive: true // Required for tokens that reference other tokens
    }
  }
}
```

**When needed:**
- Semantic tokens that reference primitives (e.g., `{color-neutral-500}`)
- Composite tokens that reference dimension tokens
- Any token with `$value: "{reference}"`

### Platform Options

```typescript
platforms: {
  css: {
    transformGroup: 'css', // OR explicit transforms array (more control)
    buildPath: 'dist/css/',
    options: {
      basePxFontSize: 16, // Used by dimension/css for px→rem conversion
      outputReferences: true, // Preserve references in output
      colorOutputFormat: 'hex' // 'hex', 'rgb', or 'hsl' for color/css transform
    },
    files: [/* ... */]
  }
}
```

## Token File Loading Pattern

**Manifest-based loading (this project):**

```typescript
import manifest from './src/tokens/manifest.json' assert { type: 'json' };

// Build source array from manifest
const sources = [];
for (const [collectionName, collection] of Object.entries(manifest.collections)) {
  for (const [modeName, files] of Object.entries(collection.modes)) {
    sources.push(...files.map(f => `src/tokens/${f}`));
  }
}

const sd = new StyleDictionary({
  source: sources,
  // ... rest of config
});
```

**Glob-based loading (simpler, but less control):**

```typescript
const sd = new StyleDictionary({
  source: ['src/tokens/**/*.tokens.json'],
  // ... rest of config
});
```

**Recommendation:** Manifest-based for this project. Already have manifest.json, provides explicit control over what's included.

## Sources

**Local Files (HIGH confidence):**
- `/node_modules/style-dictionary/package.json` — Version 5.2.0 confirmed, Node.js >=22 requirement verified
- `/node_modules/style-dictionary/examples/advanced/variables-in-outputs/sd.config.js` — v5 API patterns (ESM imports, async, hooks)
- `/node_modules/style-dictionary/examples/advanced/transitive-transforms/sd.config.js` — Transitive transform usage, v5 config format
- `/node_modules/style-dictionary-utils/package.json` — Version 6.0.1 confirmed, peer dependency on SD v5 verified
- `/node_modules/style-dictionary-utils/README.md` — Format/transform documentation, usage patterns
- `/node_modules/style-dictionary-utils/dist/transformer/*.d.ts` — TypeScript definitions for transforms (input/output types)
- `/node_modules/style-dictionary-utils/dist/format/*.d.ts` — TypeScript definitions for formats

**Training Data (MEDIUM confidence):**
- Style Dictionary v5 API patterns (async, ESM, hooks) — Verified with local examples
- DTCG format structure — Verified with existing token files in `src/tokens/`
- css/advanced format capabilities — Verified with README and type definitions

**Known Gaps (LOW confidence / flagged for validation):**
- Exact `$description` field behavior in SD v5 (stated it's not used for filtering, but not verified in official docs)
- Complete list of built-in SD v5 transforms (provided common ones from training data, not exhaustive)
- Platform options for color output format (assumed `colorOutputFormat` based on SD-utils types, not verified in SD v5 docs)

---
*Stack research for: Design Token Build Pipeline*
*Researched: 2026-02-14*
*Confidence: MEDIUM (verified versions and local examples, but missing official docs validation due to WebFetch/WebSearch restrictions)*
