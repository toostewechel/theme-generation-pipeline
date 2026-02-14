# Architecture Research: Style Dictionary v5 Multi-Mode Build Pipeline

**Domain:** Design token transformation pipeline
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Build Orchestrator                         │
│  (buildTokens.ts - loops collections/modes from manifest)       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   SD Instance│  │   SD Instance│  │   SD Instance│          │
│  │  (primitives)│  │  (color.light│  │  (color.dark)│  ...     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                  │
├─────────┴─────────────────┴─────────────────┴──────────────────┤
│                   Style Dictionary v5 Core                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Transform  │  │   Resolve   │  │   Format    │             │
│  │   Pipeline  │→ │  References │→ │   Output    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                      Output Combiner                            │
│  (merges partial CSS with selector wrappers into one file)      │
├─────────────────────────────────────────────────────────────────┤
│                      File System                                │
│  ┌─────────────────────────────────────────────────────┐        │
│  │           dist/css/tokens.css                        │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Build Orchestrator** | Read manifest, loop collections/modes, instantiate SD, merge outputs | TypeScript script reading manifest.json |
| **SD Instance** | Transform tokens for one collection+mode combination | `new StyleDictionary(config)` per collection/mode |
| **Transform Pipeline** | Apply value transformations (color format, px→rem, etc.) | Built-in SD transform groups (`css`, `js`) |
| **Reference Resolver** | Resolve `{token-name}` references across files | Built-in SD resolver (runs during transform) |
| **Format Output** | Convert transformed tokens to CSS syntax | Built-in `css/variables` format or custom |
| **Output Combiner** | Wrap CSS in selectors (`:root`, `[data-*]`), merge into one file | Custom post-processing or format with options |

## Recommended Project Structure

```
theme-generation-pipeline/
├── src/
│   └── tokens/                    # DTCG token files
│       ├── manifest.json          # Collection/mode definitions
│       ├── primitives-color.mode-1.tokens.json
│       ├── color.light.tokens.json
│       ├── color.dark.tokens.json
│       ├── primitives-font.mode-1.tokens.json
│       ├── typography.mode-1.tokens.json
│       └── ...
├── scripts/
│   └── buildTokens.ts             # Build orchestrator
├── dist/
│   └── css/
│       └── tokens.css             # Single combined output
├── package.json                   # "type": "module"
└── tsconfig.json
```

### Structure Rationale

- **src/tokens/:** DTCG source files, one file per collection+mode as defined in manifest
- **scripts/:** Build logic separate from source tokens (TypeScript for type safety)
- **dist/css/:** Output directory for generated CSS (gitignored, build artifact)
- **manifest.json:** Single source of truth for collections, modes, file mappings

## Architectural Patterns

### Pattern 1: Multiple SD Instances (One Per Collection+Mode)

**What:** Create a new `StyleDictionary` instance for each collection+mode combination defined in the manifest.

**When to use:** When you have multi-mode tokens (light/dark, different radius modes) or need different selectors per collection.

**Trade-offs:**
- **Pro:** Each instance has isolated config (source, include, output), clean separation
- **Pro:** Easier to control which tokens go in which selector
- **Pro:** Reference resolution works naturally within each instance
- **Con:** More instances = more processing time (though SD v5 is fast)
- **Con:** More complex orchestration logic

**Example:**
```typescript
import StyleDictionary from 'style-dictionary';

// Loop collections from manifest
for (const [collectionName, collection] of Object.entries(manifest.collections)) {
  for (const [modeName, modeFiles] of Object.entries(collection.modes)) {

    const sd = new StyleDictionary({
      source: modeFiles.map(f => `src/tokens/${f}`),
      include: getPrimitiveFiles(collectionName), // Include primitives for reference resolution
      platforms: {
        css: {
          transformGroup: 'css',
          buildPath: 'dist/css/temp/',
          files: [{
            destination: `${collectionName}-${modeName}.css`,
            format: 'css/variables'
          }]
        }
      }
    });

    await sd.buildPlatform('css');
  }
}
```

### Pattern 2: Source vs Include for Reference Resolution

**What:** Use `source` for the primary tokens to output, `include` for dependency tokens (primitives) needed for reference resolution but not necessarily output.

**When to use:** Semantic tokens reference primitives. You want primitives available for resolution but control whether they appear in output.

**Trade-offs:**
- **Pro:** Clean separation of "tokens to output" vs "tokens to reference"
- **Pro:** `source` tokens overwrite `include` tokens if same name
- **Pro:** Prevents duplicate primitive definitions across modes
- **Con:** Both `source` and `include` tokens are output by default in SD v5 (use filters to control)

**Example:**
```typescript
{
  source: ['src/tokens/color.light.tokens.json'],       // Semantic tokens for light mode
  include: ['src/tokens/primitives-color.mode-1.tokens.json'], // Primitives for {references}
  platforms: {
    css: {
      files: [{
        destination: 'color-light.css',
        format: 'css/variables',
        filter: (token) => !token.filePath.includes('primitives') // Optional: exclude primitives
      }]
    }
  }
}
```

### Pattern 3: Custom Format for Selector Wrapping

**What:** Use Style Dictionary's `registerFormat` to create a custom format that wraps CSS variables in the appropriate selector (`:root`, `[data-color-mode='light']`, etc.).

**When to use:** When built-in formats don't support the selector structure you need.

**Trade-offs:**
- **Pro:** Full control over output structure
- **Pro:** Can include file headers, comments, selector nesting
- **Con:** More code to maintain (violates project constraint of "no custom logic" if possible)
- **Alternative:** Use built-in `css/variables` format + post-process files to wrap in selectors

**Example:**
```typescript
StyleDictionary.registerFormat({
  name: 'css/variables-with-selector',
  format: ({ dictionary, options }) => {
    const selector = options.selector || ':root';
    const vars = dictionary.allTokens
      .map(token => `  --${token.name}: ${token.value};`)
      .join('\n');

    return `${selector} {\n${vars}\n}\n`;
  }
});
```

### Pattern 4: Post-Processing for Output Merging

**What:** Each SD instance outputs a partial CSS file, then a post-processing step merges them into a single file with correct selectors.

**When to use:** When you need a single combined CSS file from multiple SD instances.

**Trade-offs:**
- **Pro:** Simpler SD configs (standard format), merging logic separate
- **Pro:** Easier to debug (inspect individual outputs before merge)
- **Con:** Extra file I/O (write partials, read, merge, write final)
- **Con:** Need to manage temp directory cleanup

**Example:**
```typescript
import fs from 'fs/promises';

// After all SD instances build
const outputs = [
  { file: 'primitives-color.css', selector: ':root' },
  { file: 'color-light.css', selector: ':root' }, // Default mode
  { file: 'color-light.css', selector: '[data-color-mode="light"]' },
  { file: 'color-dark.css', selector: '[data-color-mode="dark"]' }
];

let combined = '';
for (const { file, selector } of outputs) {
  const content = await fs.readFile(`dist/css/temp/${file}`, 'utf-8');
  const vars = content.match(/--[^:]+:[^;]+;/g).join('\n  ');
  combined += `${selector} {\n  ${vars}\n}\n\n`;
}

await fs.writeFile('dist/css/tokens.css', combined);
```

## Data Flow

### Build Process Flow

```
[manifest.json]
    ↓
[Build Orchestrator]
    ↓
[For each collection+mode]
    ↓
[Create SD Config]
    ├─ source: mode token files
    ├─ include: primitive token files (for references)
    └─ platform: CSS with transformGroup
    ↓
[new StyleDictionary(config)]
    ↓
[SD Transform Pipeline]
    ├─ Parse token files (JSON)
    ├─ Merge source + include
    ├─ Apply transforms (color/css, size/rem, name/kebab)
    ├─ Resolve references {token-name}
    └─ Filter tokens (optional)
    ↓
[SD Format]
    ├─ Generate CSS variable syntax
    └─ Write to temp file
    ↓
[All modes processed]
    ↓
[Output Combiner]
    ├─ Read temp CSS files
    ├─ Wrap in appropriate selectors
    ├─ Merge into single file
    └─ Write dist/css/tokens.css
    ↓
[Build Complete]
```

### Reference Resolution Flow

```
[Token with reference]
  "$value": "{color-neutral-500}"
    ↓
[SD loads all source + include files]
    ↓
[SD builds token map]
  color-neutral-500 → { value: { colorSpace: 'srgb', components: [...] } }
    ↓
[SD resolves reference during transform]
  {color-neutral-500} → actual color value
    ↓
[Transform applied to resolved value]
  color/css → "rgb(165, 166, 171)"
    ↓
[Output]
  --color-text-muted: rgb(165, 166, 171);
```

### Key Data Flows

1. **Manifest → Config Generation:** Build script reads manifest to determine which token files to process and how to group them.
2. **Token Files → SD Instance:** Each collection+mode gets its own SD instance with appropriate source/include files.
3. **SD Transform → Output:** SD applies transforms, resolves references, generates CSS, writes to temp location.
4. **Temp Files → Final CSS:** Orchestrator merges temp outputs with selectors into single file.

## Build Order & Dependencies

### Collection Processing Order

**Dependency Chain:**
```
primitives-* (no dependencies)
    ↓
semantic tokens (reference primitives)
    ↓
composite tokens (reference semantic or primitives)
```

**Build Order Strategy:**

**Option A: Dependency-Aware Sequencing**
```typescript
// Process in order: primitives first, then semantic
const buildOrder = [
  'primitives-color',
  'primitives-font',
  'primitives-dimension',
  'primitives-radius',
  'color',           // References primitives-color
  'dimension',       // References primitives-dimension
  'radius',          // References primitives-radius
  'typography'       // References primitives-font, primitives-dimension
];
```
**Pros:** Predictable, easy to debug
**Cons:** Manual ordering, doesn't scale if dependency graph gets complex

**Option B: Include Primitives in Each Build**
```typescript
// Each semantic collection includes relevant primitives
{
  source: ['color.light.tokens.json'],
  include: ['primitives-color.mode-1.tokens.json'],  // Always included
  // ...
}
```
**Pros:** No build order dependency, each SD instance is self-contained
**Cons:** Primitives re-processed multiple times (minor performance hit)

**Recommendation:** **Option B** — Include primitives via `include` in each semantic collection's config. SD v5 is fast enough that re-processing primitives is negligible, and it eliminates build order concerns.

### Cross-File Reference Resolution

**How SD v5 Resolves References:**

1. Loads all files in `source` and `include`
2. Merges into single token object (source overwrites include)
3. Builds token map for lookups
4. During transform, replaces `{token-name}` with resolved value

**Implications:**
- References work across files if both files are in `source` or `include`
- Primitives must be in `include` or `source` for semantic tokens to resolve
- No need for manual dependency ordering within a single SD instance

**Cross-Instance References (NOT SUPPORTED):**
- Collection A's SD instance CANNOT reference Collection B's tokens
- Each instance is isolated
- Workaround: Include shared primitives in both instances via `include`

## Platform Configuration Structure

### Single Platform (CSS Only)

For this project, only CSS output is needed. Each SD instance uses the same platform config with different file destinations.

```typescript
{
  platforms: {
    css: {
      transformGroup: 'css',              // Built-in: color/css, size/rem, name/kebab, etc.
      buildPath: 'dist/css/temp/',        // Temp directory for partials
      files: [
        {
          destination: `${collectionName}-${modeName}.css`,
          format: 'css/variables',        // Built-in format
          filter: options.filter,         // Optional: filter which tokens to include
          options: {
            showFileHeader: false,        // Disable auto-generated header
            outputReferences: true        // Keep {references} as var() in output
          }
        }
      ]
    }
  }
}
```

### Transform Groups

**Built-in `css` transform group includes:**
- `attribute/cti`: Adds category/type/item metadata
- `name/kebab`: Converts token names to kebab-case
- `time/seconds`: Converts time values to seconds
- `html/icon`: Converts icons to HTML entities
- `size/rem`: Converts px to rem
- `color/css`: Converts color objects to CSS color format (rgb, hsl, hex)
- `asset/url`: Wraps asset paths in `url()`
- `fontFamily/css`: Formats font stacks
- `cubicBezier/css`: Formats easing functions
- `strokeStyle/css/shorthand`: Formats stroke styles
- `border/css/shorthand`: Formats border shorthand
- `typography/css/shorthand`: Formats font shorthand
- `transition/css/shorthand`: Formats transition shorthand
- `shadow/css/shorthand`: Formats shadow values

**Custom Transform Override (if needed for unitless):**
```typescript
StyleDictionary.registerTransform({
  name: 'size/rem-or-unitless',
  type: 'value',
  transitive: true,
  filter: (token) => token.$type === 'dimension',
  transform: (token) => {
    if (token.$description === 'unitless') {
      return token.$value.value; // Return raw number
    }
    // Otherwise, apply rem conversion
    return (token.$value.value / 16) + 'rem';
  }
});
```

## Filter Patterns

### Use Cases for Filters

1. **Exclude primitives from semantic output:** Only output semantic tokens, not the primitives they reference
2. **Split by token type:** Separate colors from dimensions in different files
3. **Mode-specific tokens:** Only include tokens relevant to a specific mode

### Filter Syntax

**File-level filter (recommended):**
```typescript
{
  files: [{
    destination: 'semantic-only.css',
    format: 'css/variables',
    filter: (token) => !token.filePath.includes('primitives')
  }]
}
```

**Object-based filter (DTCG $type):**
```typescript
{
  filter: {
    $type: 'color'  // Only include color tokens
  }
}
```

**Function filter (complex logic):**
```typescript
{
  filter: (token) => {
    // Include semantic tokens but exclude primitives
    const isPrimitive = token.name.startsWith('color-neutral-') ||
                       token.name.startsWith('color-brand-');
    return !isPrimitive;
  }
}
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 collections | Single build script, sequential processing, minimal optimization |
| 5-20 collections | Parallel SD instance builds (Promise.all), caching of primitive files |
| 20+ collections | Build cache (skip unchanged files), incremental builds, worker threads |

### Scaling Priorities

1. **First bottleneck:** Sequential processing of SD instances
   - **Fix:** Use `Promise.all()` to build multiple instances in parallel
   - **Impact:** ~3-5x speed improvement for 10+ collections

2. **Second bottleneck:** File I/O for merging outputs
   - **Fix:** Stream-based merging instead of reading all files into memory
   - **Impact:** Lower memory usage, handles 100+ output files

## Anti-Patterns

### Anti-Pattern 1: Single SD Instance for All Collections

**What people do:** Try to load all token files into one SD instance and use filters to output different modes.

**Why it's wrong:**
- Token name collisions across modes (e.g., `color-background-surface-default` exists in both light and dark)
- Cannot wrap different modes in different selectors from single instance
- Complex filter logic to separate modes
- Reference resolution ambiguity

**Do this instead:** One SD instance per collection+mode combination. Clean separation, no name collisions.

### Anti-Pattern 2: Custom Transforms for Everything

**What people do:** Write custom transforms for every value transformation need.

**Why it's wrong:**
- Maintenance burden (need to update transforms as SD evolves)
- Built-in transforms already handle 90% of cases
- Custom logic makes upgrades harder

**Do this instead:** Use built-in transform groups (`css`, `js`, `ios`, `android`). Only create custom transforms for truly unique needs (e.g., the unitless dimension case in this project).

### Anti-Pattern 3: Manually Concatenating CSS with String Templates

**What people do:** Build CSS output by concatenating strings instead of using SD formats.

```typescript
// BAD
let css = ':root {\n';
for (const token of tokens) {
  css += `  --${token.name}: ${token.value};\n`;
}
css += '}\n';
```

**Why it's wrong:**
- Fragile (easy to introduce syntax errors)
- Doesn't handle edge cases (special characters, escaping)
- Loses SD format features (comments, file headers, outputReferences)

**Do this instead:** Use built-in `css/variables` format or `registerFormat` with proper formatting helpers.

### Anti-Pattern 4: Ignoring `outputReferences`

**What people do:** Set `outputReferences: false` (or omit it, which defaults to false in some formats).

**Why it's wrong:**
- Loses the connection between tokens in output
- If a primitive changes, all semantic tokens need to be regenerated
- Cannot leverage CSS custom property inheritance/cascading

**Do this instead:** Set `outputReferences: true` to output `--color-text-default: var(--color-neutral-900);` instead of `--color-text-default: rgb(45, 46, 50);`. This preserves the reference chain in CSS.

## Integration Points

### External Tools

| Tool | Integration Pattern | Notes |
|------|---------------------|-------|
| **Figma (Tokens Studio)** | Export DTCG JSON → src/tokens/ | One-way sync: Figma → tokens, not bidirectional |
| **style-dictionary-utils** | Import transforms/formats as needed | Use for DTCG-specific transforms (color object, typography composite) |
| **CSS Bundler (e.g., PostCSS)** | Import dist/css/tokens.css | Generated CSS is standard, works with any bundler |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Build Script ↔ SD Instances** | Config object | Build script generates config, passes to `new StyleDictionary(config)` |
| **SD Instances ↔ File System** | File I/O | SD reads source files, writes output files |
| **Temp Outputs ↔ Combiner** | File read/merge | Combiner reads temp CSS files, merges, writes final output |

## Multi-Mode Output Strategy

### Challenge

Different collections have different numbers of modes:
- `primitives-color`: 1 mode (mode-1)
- `color`: 2 modes (light, dark)
- `radius`: 4 modes (sharp, default, rounded, pill)

Need to output:
- Primitives → `:root` (always available)
- Default modes → `:root` (works without data attributes)
- Non-default modes → `[data-*-mode='...']` (opt-in via attribute)

### Solution Architecture

**Step 1: Define Output Mapping**

```typescript
const outputMap = {
  'primitives-color.mode-1': { selector: ':root', include: true },
  'color.light': [
    { selector: ':root', include: true },           // Default mode
    { selector: '[data-color-mode="light"]', include: true }
  ],
  'color.dark': { selector: '[data-color-mode="dark"]', include: true },
  'radius.default': [
    { selector: ':root', include: true },           // Default mode
    { selector: '[data-radius-mode="default"]', include: true }
  ],
  'radius.sharp': { selector: '[data-radius-mode="sharp"]', include: true },
  // ...
};
```

**Step 2: Build Each Collection+Mode**

For each entry in manifest, create SD instance, build to temp file.

**Step 3: Merge Outputs**

Read temp files, wrap in selectors per outputMap, combine into single CSS file.

### Default Mode Handling

**Pattern:** Output default mode under both `:root` AND `[data-*-mode='...']`.

**Rationale:**
- `:root` → Works without data attribute (progressive enhancement)
- `[data-*-mode='light']` → Explicit mode selection (overwrites :root when attribute is set)

**CSS Specificity:** `[data-color-mode='light']` has same specificity as `:root`, so source order matters. Put `:root` first, data-attribute selectors after.

```css
/* This order ensures data-attribute selectors override :root when present */
:root {
  --color-background: #fff; /* default (light) */
}

[data-color-mode="light"] {
  --color-background: #fff; /* explicit light */
}

[data-color-mode="dark"] {
  --color-background: #000; /* explicit dark */
}
```

## File Header & Footer Patterns

### Built-in File Headers

SD v5 includes auto-generated file headers by default:

```css
/**
 * Do not edit directly
 * Generated on [timestamp]
 */
```

**Disable via config:**
```typescript
{
  files: [{
    options: {
      showFileHeader: false
    }
  }]
}
```

### Custom Headers via Format

```typescript
StyleDictionary.registerFormat({
  name: 'css/variables-with-header',
  format: ({ dictionary, file, options }) => {
    const header = `/**
 * Design Tokens - ${file.destination}
 * Generated: ${new Date().toISOString()}
 * DO NOT EDIT - Changes will be overwritten
 */\n\n`;

    const selector = options.selector || ':root';
    const vars = dictionary.allTokens
      .map(token => `  --${token.name}: ${token.value};`)
      .join('\n');

    return `${header}${selector} {\n${vars}\n}\n`;
  }
});
```

### Footer (Less Common)

Footers are rarely used in CSS output, but can be added similarly:

```typescript
const footer = `\n/* End of ${file.destination} */`;
return `${header}${selector} {\n${vars}\n}${footer}\n`;
```

## Recommended Build Script Structure

### High-Level Flow

```typescript
// scripts/buildTokens.ts

import StyleDictionary from 'style-dictionary';
import fs from 'fs/promises';

async function buildTokens() {
  // 1. Read manifest
  const manifest = JSON.parse(await fs.readFile('src/tokens/manifest.json', 'utf-8'));

  // 2. Define output mapping (selector per collection+mode)
  const outputMap = defineOutputMap(manifest);

  // 3. Build each collection+mode (parallel)
  await Promise.all(
    Object.entries(manifest.collections).flatMap(([collectionName, collection]) =>
      Object.entries(collection.modes).map(([modeName, modeFiles]) =>
        buildCollectionMode(collectionName, modeName, modeFiles, manifest)
      )
    )
  );

  // 4. Merge temp outputs into final CSS
  await mergeOutputs(outputMap, 'dist/css/tokens.css');

  // 5. Cleanup temp directory
  await fs.rm('dist/css/temp', { recursive: true });
}

async function buildCollectionMode(collectionName, modeName, modeFiles, manifest) {
  const config = {
    source: modeFiles.map(f => `src/tokens/${f}`),
    include: getPrimitivesForCollection(collectionName, manifest),
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'dist/css/temp/',
        files: [{
          destination: `${collectionName}.${modeName}.css`,
          format: 'css/variables',
          options: { showFileHeader: false }
        }]
      }
    }
  };

  const sd = new StyleDictionary(config);
  await sd.buildPlatform('css');
}

async function mergeOutputs(outputMap, destination) {
  let combined = '';

  for (const [key, selectorConfig] of Object.entries(outputMap)) {
    const [collectionName, modeName] = key.split('.');
    const tempFile = `dist/css/temp/${collectionName}.${modeName}.css`;
    const content = await fs.readFile(tempFile, 'utf-8');

    // Extract CSS variables from temp file
    const vars = extractCSSVariables(content);

    // Wrap in selector(s)
    const selectors = Array.isArray(selectorConfig) ? selectorConfig : [selectorConfig];
    for (const { selector } of selectors) {
      combined += `${selector} {\n${vars}\n}\n\n`;
    }
  }

  await fs.writeFile(destination, combined);
}

buildTokens().catch(console.error);
```

### Component Breakdown

**Components:**
1. **Manifest Reader:** Parses manifest.json
2. **Output Map Generator:** Defines which modes go in which selectors
3. **SD Config Generator:** Creates config for each collection+mode
4. **SD Instance Builder:** Instantiates and builds SD
5. **Output Merger:** Combines temp CSS files with selectors
6. **Cleanup:** Removes temp directory

**Data Flow:**
```
manifest.json
  → outputMap
  → [collectionName, modeName, modeFiles]
  → SD config
  → SD instance
  → temp CSS file
  → merged CSS
  → dist/css/tokens.css
```

## Sources

**Official Documentation:**
- Style Dictionary v5 README: node_modules/style-dictionary/README.md
- Style Dictionary v5 TypeScript Definitions: node_modules/style-dictionary/lib/StyleDictionary.d.ts
- Multi-brand/multi-platform example: node_modules/style-dictionary/examples/advanced/multi-brand-multi-platform/
- Basic config example: node_modules/style-dictionary/examples/basic/config.json

**Package Versions:**
- style-dictionary: v5.2.0 (package.json)
- style-dictionary-utils: v6.0.1 (package.json)
- Node.js requirement: >=22.0.0 (from SD v5 package.json)

**Project Context:**
- .planning/PROJECT.md (requirements, constraints, decisions)
- src/tokens/manifest.json (collection structure)
- Token files in src/tokens/ (DTCG format with $type/$value)

**Confidence Level:**
- **Config patterns:** HIGH (verified from official examples)
- **Multi-instance strategy:** HIGH (confirmed from multi-brand example)
- **Source vs include:** HIGH (documented in README)
- **Reference resolution:** MEDIUM-HIGH (inferred from SD v5 behavior, not explicitly documented in examples)
- **Output merging:** MEDIUM (common pattern, not officially documented)
- **Custom format for selectors:** MEDIUM (alternative approach, not required)

---
*Architecture research for: Design token build pipeline with Style Dictionary v5*
*Researched: 2026-02-14*
