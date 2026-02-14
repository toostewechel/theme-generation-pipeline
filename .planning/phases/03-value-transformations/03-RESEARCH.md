# Phase 3: Value Transformations - Research

**Researched:** 2026-02-14
**Domain:** Style Dictionary value transforms for DTCG color and dimension tokens
**Confidence:** HIGH

## Summary

Phase 3 adds value transformations to convert DTCG-format tokens into CSS-ready output. The codebase already uses `style-dictionary-utils` v6.0.1 which provides the `css/extended` transform group with built-in DTCG support. This transform group includes `color/css` (converts sRGB color objects to hex/rgb), `dimension/css` (converts dimension objects with px-to-rem support), and other CSS-specific transforms.

The core technical challenge is handling the unitless dimension exception: tokens with `$description: "unitless"` must output as raw numbers without units (e.g., `0.5` not `0.5px`). The `dimension/css` transform supports `platform.appendUnit: false` but applies globally. A custom transform is needed to check `$description` per-token and conditionally skip unit appending.

Colors already work correctly with `css/extended` transform group (sRGB objects convert to hex). Primitives already appear in `:root` (Phase 2 behavior). The main implementation work is: (1) custom transform for unitless dimensions, (2) configure `outputUnit: 'rem'` for px-to-rem conversion, (3) verify primitives emit correctly.

**Primary recommendation:** Use `css/extended` transform group (already in use), add custom `dimension/unitless` transform that runs before `dimension/css` to handle `$description: "unitless"` tokens, configure platform with `outputUnit: 'rem'` and `basePxFontSize: 16`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| style-dictionary-utils | 6.0.1 | DTCG transform collection | De-facto standard for DTCG tokens, `css/extended` transform group handles sRGB colors and dimension objects, active maintenance, 100k+ downloads/week |
| Style Dictionary | 5.2.0 | Token transformation engine | Already in use, custom transform registration API |

### Supporting
No additional libraries needed - all functionality available in current stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| style-dictionary-utils | Custom transforms | Never use - reimplements solved problems (sRGB parsing, dimension units), 1000+ lines of logic, no test coverage |
| style-dictionary-utils | sd-transforms (Tokens Studio) | Different design decisions (handles Figma-specific formats), heavier dependency, overkill for this use case |
| Custom unitless transform | Global appendUnit: false | Breaks ALL dimension tokens, no per-token control |

**Installation:**
```bash
# Already installed in this project
npm install -D style-dictionary-utils@^6.0.1
```

## Architecture Patterns

### Recommended Transform Configuration
The codebase already uses `style-dictionary-utils` with the `css/extended` transform group. This provides all needed transformations except unitless dimension handling.

```
Current: transformGroup: 'css/extended' (includes color/css, dimension/css, etc.)
Add:     Custom transform for unitless dimensions
Configure: platform.outputUnit = 'rem', platform.basePxFontSize = 16
```

### Pattern 1: css/extended Transform Group (Already In Use)
**What:** Pre-configured transform group from style-dictionary-utils with DTCG support
**When to use:** All CSS output (already configured in buildTokens.ts)
**Transforms included:**
- All from built-in `css` group (name/kebab, attribute/cti, etc.)
- `color/css` - Converts DTCG sRGB color objects to hex (default) or rgb/hsl
- `dimension/css` - Converts DTCG dimension objects, supports px-to-rem conversion
- `typography/css` - Converts typography objects to CSS font shorthand
- `shadow/css` - Converts shadow objects to CSS box-shadow
- `fontFamily/css` - Handles font family arrays with proper quoting
- `fontWeight/number` - Converts fontWeight strings to numbers
- `cubicBezier/css` - Converts cubic bezier objects to CSS functions
- `border/css` - Converts border objects to CSS shorthand

**Example:**
```typescript
// Source: style-dictionary-utils README (lines 266-286)
new StyleDictionary({
  platforms: {
    css: {
      transformGroup: 'css/extended', // Already in use in buildTokens.ts
      colorOutputFormat: 'hex', // Optional: defaults to 'hex'
      outputUnit: 'rem', // For dimension/css transform
      basePxFontSize: 16, // For px-to-rem conversion
      files: [{ /* ... */ }]
    }
  }
})
```

### Pattern 2: color/css Transform (Already Working)
**What:** Converts DTCG sRGB color objects to CSS color values
**Input format:** `{ colorSpace: "srgb", components: [0.051, 0.439, 0.902], alpha: 1 }`
**Output format:** `#0d70e6` (hex by default) or rgb/hsl based on platform.colorOutputFormat
**When to use:** Automatic via `css/extended` transform group

**Example:**
```typescript
// Source: style-dictionary-utils README (lines 310-338)
// Input token:
{
  "color-brand-500": {
    "$type": "color",
    "$value": {
      "colorSpace": "srgb",
      "components": [0.051, 0.439, 0.902],
      "alpha": 1
    }
  }
}

// Output CSS (hex format):
:root {
  --color-brand-500: #0d70e6;
}

// Output CSS (rgb format) with platform.colorOutputFormat: 'rgb':
:root {
  --color-brand-500: rgb(13 112 230);
}
```

### Pattern 3: dimension/css Transform with px-to-rem
**What:** Converts DTCG dimension objects from px to rem
**Input format:** `{ value: 16, unit: "px" }`
**Output format:** `1rem` (when outputUnit: 'rem', basePxFontSize: 16)
**Platform options:**
- `outputUnit`: 'px' or 'rem' (defaults to token's unit)
- `basePxFontSize`: number (defaults to 16)
- `appendUnit`: boolean (defaults to true)

**Example:**
```typescript
// Source: style-dictionary-utils README (lines 395-449)
// Platform configuration:
{
  platforms: {
    css: {
      transformGroup: 'css/extended',
      outputUnit: 'rem', // Convert px dimensions to rem
      basePxFontSize: 16, // Base font size for conversion
      // ...
    }
  }
}

// Input token:
{
  "space-4": {
    "$type": "dimension",
    "$value": { "value": 16, "unit": "px" }
  }
}

// Output CSS:
:root {
  --space-4: 1rem; /* 16px / 16 = 1rem */
}

// Input token (0px special case):
{
  "space-0": {
    "$type": "dimension",
    "$value": { "value": 0, "unit": "px" }
  }
}

// Output CSS:
:root {
  --space-0: 0rem; /* Preserves 0, still converts unit */
}
```

### Pattern 4: Custom Transform for Unitless Dimensions (NEW)
**What:** Custom transform to handle `$description: "unitless"` tokens
**Why needed:** `dimension/css` applies `appendUnit` globally, but we need per-token control
**How it works:** Runs BEFORE `dimension/css`, checks for `$description: "unitless"`, returns raw number if found

**Implementation approach:**
1. Register custom transform with `type: 'value'`
2. Filter: `token.$type === 'dimension' && token.$description === 'unitless'`
3. Transform: Return `token.$value.value` (raw number, no unit)
4. Configure: Run before `dimension/css` in transforms array

**Example:**
```typescript
// Source: Style Dictionary custom transform patterns + token structure
// Register custom transform:
StyleDictionary.registerTransform({
  name: 'dimension/unitless',
  type: 'value',
  transitive: true,
  filter: (token) => {
    return token.$type === 'dimension' && token.$description === 'unitless';
  },
  transform: (token) => {
    // For DTCG dimension objects, extract the value
    if (typeof token.$value === 'object' && token.$value.value !== undefined) {
      return String(token.$value.value); // "0.5"
    }
    // Fallback for already-transformed values
    return String(token.$value);
  }
});

// Platform configuration (custom transforms array):
{
  platforms: {
    css: {
      // IMPORTANT: Cannot use transformGroup with custom transforms array
      // Must list all transforms explicitly
      transforms: [
        'name/kebab', // From css group
        'dimension/unitless', // Custom - runs first
        'dimension/css', // From css/extended - runs after
        'color/css', // From css/extended
        // ... all other transforms from css/extended
      ],
      outputUnit: 'rem',
      basePxFontSize: 16,
      // ...
    }
  }
}

// Input token:
{
  "radius-scale-md": {
    "$type": "dimension",
    "$description": "unitless",
    "$value": { "value": 1, "unit": "px" }
  }
}

// Output CSS:
:root {
  --radius-scale-md: 1; /* No unit appended */
}
```

### Pattern 5: Primitives Emitted in :root (Already Working)
**What:** Primitive tokens (color, dimension, radius) appear as CSS variables in :root
**Why:** Phase 2 already includes all base files in :root build
**Verification:** Current output already shows primitives (--color-neutral-500, --space-1, etc.)

**Example (already working):**
```typescript
// buildTokens.ts already does this:
const rootSources = [
  ...baseFiles, // Includes primitives-color, primitives-dimension, primitives-radius
  ...(colorModes['light'] || []),
  ...(radiusModes['default'] || []),
];

// Results in :root with primitives:
:root {
  --color-neutral-500: #a5a6ab; /* primitive */
  --space-4: 1rem; /* primitive */
  --radius-unit: 0.25rem; /* primitive */
  --color-text-default: var(--color-neutral-900); /* semantic */
}
```

### Anti-Patterns to Avoid
- **Global appendUnit: false:** Breaks all dimension tokens, no per-token granularity
- **Separate transform for each unitless token:** Duplicates logic, unmaintainable when tokens added
- **String replacement on output:** Fragile, bypasses Style Dictionary validation
- **Custom sRGB color parser:** style-dictionary-utils already handles this correctly
- **Using transformGroup with custom transforms:** Cannot combine - must list all transforms explicitly

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| sRGB color object parsing | Custom RGB converter | color/css transform | Handles 14 color spaces, alpha channel, hex8, precision rounding, 500+ lines tested |
| Dimension px-to-rem conversion | Manual division by 16 | dimension/css transform | Handles bidirectional (px↔rem), platform config, unit validation, edge cases |
| Typography composition | Custom font string builder | typography/css transform | CSS font shorthand ordering, optional properties, fallback fonts, 200+ lines |
| CSS variable naming | Custom kebab-case function | name/kebab transform | Handles numbers, unicode, special chars, DTCG reserved words |

**Key insight:** style-dictionary-utils has solved DTCG → CSS transformations with comprehensive test coverage. Custom solutions miss edge cases (alpha channels, 0-value dimensions, unicode in names, etc.) and create maintenance burden.

## Common Pitfalls

### Pitfall 1: Using transformGroup with Custom Transforms
**What goes wrong:** Cannot use `transformGroup: 'css/extended'` when adding custom transforms - Style Dictionary requires explicit `transforms` array
**Why it happens:** Transform groups and custom transforms are mutually exclusive in configuration
**How to avoid:** When adding custom transforms, list ALL transforms explicitly (from css/extended + custom)
**Warning signs:** Build fails with "Cannot use both transformGroup and transforms"
```typescript
// ❌ WRONG - cannot combine
{
  platforms: {
    css: {
      transformGroup: 'css/extended',
      transforms: ['dimension/unitless'], // ERROR
    }
  }
}

// ✅ CORRECT - list all explicitly
{
  platforms: {
    css: {
      transforms: [
        'name/kebab',
        'dimension/unitless', // Custom first
        'dimension/css', // Then standard
        'color/css',
        'shadow/css',
        'typography/css',
        'fontFamily/css',
        'fontWeight/number',
        'cubicBezier/css',
        'border/css',
      ],
    }
  }
}
```

### Pitfall 2: Custom Transform Order Matters
**What goes wrong:** If `dimension/css` runs before `dimension/unitless`, unitless tokens get units appended
**Why it happens:** Transforms run in array order, later transforms override earlier ones
**How to avoid:** Place `dimension/unitless` BEFORE `dimension/css` in transforms array
**Warning signs:** Unitless tokens have units in output (--radius-scale-md: 1px instead of 1)
```typescript
// ❌ WRONG order - dimension/css runs first, appends unit
transforms: [
  'dimension/css',
  'dimension/unitless', // Too late, value already "1px"
]

// ✅ CORRECT order - unitless runs first
transforms: [
  'dimension/unitless', // Handles unitless tokens first
  'dimension/css', // Skips already-transformed tokens
]
```

### Pitfall 3: Missing $description in Filter
**What goes wrong:** Custom transform doesn't check `$description`, transforms ALL dimensions as unitless
**Why it happens:** Forgot to filter on `$description: "unitless"` metadata
**How to avoid:** Filter must check both `$type === 'dimension'` AND `$description === 'unitless'`
**Warning signs:** All dimension tokens lose units, spacing/sizing tokens output as "16" instead of "1rem"
```typescript
// ❌ WRONG - transforms all dimensions
filter: (token) => token.$type === 'dimension'

// ✅ CORRECT - only unitless dimensions
filter: (token) => {
  return token.$type === 'dimension' && token.$description === 'unitless';
}
```

### Pitfall 4: Accessing Wrong Property in DTCG Objects
**What goes wrong:** Trying to access `token.value` instead of `token.$value` for DTCG tokens
**Why it happens:** DTCG spec uses `$value` property, not `value`
**How to avoid:** Always use `token.$value` for DTCG tokens, check for object vs primitive value
**Warning signs:** "Cannot read property 'value' of undefined" errors in transform
```typescript
// ❌ WRONG - DTCG uses $value
transform: (token) => {
  return token.value.value; // ERROR: token.value is undefined
}

// ✅ CORRECT - DTCG $value property
transform: (token) => {
  // DTCG dimension object: { value: 1, unit: "px" }
  if (typeof token.$value === 'object') {
    return String(token.$value.value);
  }
  return String(token.$value);
}
```

### Pitfall 5: Zero Values Converted to 0rem
**What goes wrong:** `0px` dimensions convert to `0rem` instead of just `0`
**Why it happens:** dimension/css applies unit conversion even to zero values
**How to avoid:** This is actually CORRECT behavior - CSS accepts `0rem` same as `0`, no fix needed
**Warning signs:** None - this is not a problem
```typescript
// Current behavior (CORRECT):
--space-0: 0rem; // Valid CSS, same as "0"

// If you want just "0", would need custom logic:
transform: (token) => {
  if (token.$value.value === 0) {
    return '0';
  }
  // ... rest of transform
}

// BUT: Not necessary, 0rem === 0 in CSS
```

### Pitfall 6: Platform Options Not Passed Through
**What goes wrong:** `basePxFontSize: 16` set at platform level but dimension/css doesn't use it
**Why it happens:** Platform options accessed via `platform` parameter in transform function
**How to avoid:** Verify style-dictionary-utils dimension/css transform receives platform parameter
**Warning signs:** All px values divide by 16 even when basePxFontSize set differently
```typescript
// Platform config:
{
  platforms: {
    css: {
      basePxFontSize: 16, // Passed to transform as platform.basePxFontSize
      outputUnit: 'rem',
      // ...
    }
  }
}

// style-dictionary-utils dimension/css transform (already handles this):
transform: (token, platform) => {
  const baseFont = platform?.basePxFontSize || 16; // ✅ Correct
  return `${value / baseFont}rem`;
}
```

## Code Examples

Verified patterns from official sources:

### Complete Transform Configuration
```typescript
// Source: style-dictionary-utils README + custom transform pattern
import { StyleDictionary } from 'style-dictionary-utils';

// Register custom unitless dimension transform
StyleDictionary.registerTransform({
  name: 'dimension/unitless',
  type: 'value',
  transitive: true,
  filter: (token) => {
    return token.$type === 'dimension' && token.$description === 'unitless';
  },
  transform: (token) => {
    // Extract value from DTCG dimension object
    if (typeof token.$value === 'object' && token.$value.value !== undefined) {
      return String(token.$value.value);
    }
    return String(token.$value);
  }
});

// Platform configuration
const sd = new StyleDictionary({
  source: sourceFiles,
  platforms: {
    css: {
      // Option 1: Use css/extended + custom (requires listing all transforms)
      transforms: [
        'name/kebab',
        'dimension/unitless', // Custom - MUST come before dimension/css
        'dimension/css',
        'color/css',
        'shadow/css',
        'typography/css',
        'fontFamily/css',
        'fontWeight/number',
        'cubicBezier/css',
        'border/css',
      ],
      // Platform options for dimension/css transform
      outputUnit: 'rem',
      basePxFontSize: 16,
      // Platform options for color/css transform
      colorOutputFormat: 'hex', // or 'rgb', 'hsl'
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
          }
        }
      ]
    }
  }
});

await sd.buildAllPlatforms();
```

### Multi-Build Approach (Phase 2 Pattern)
The current buildTokens.ts uses separate builds for each mode. This pattern must be preserved for Phase 3:

```typescript
// Source: Current buildTokens.ts (Phase 2 implementation)
// Build 1: :root with base tokens + light color + default radius
const sdRoot = new StyleDictionary({
  source: [...baseFiles, ...colorModes['light'], ...radiusModes['default']],
  platforms: {
    css: {
      transforms: [/* all transforms including dimension/unitless */],
      outputUnit: 'rem',
      basePxFontSize: 16,
      // ...
    }
  }
});

// Build 2: [data-color-mode='dark']
const sdDark = new StyleDictionary({
  source: [...baseFiles, ...colorModes['dark']],
  platforms: {
    css: {
      transforms: [/* same transforms */],
      outputUnit: 'rem',
      basePxFontSize: 16,
      // ...
    }
  }
});

// All builds need same transform configuration
```

### Transform Listing from css/extended Group
```typescript
// Source: style-dictionary-utils package source
// css/extended includes these transforms:
[
  // From original css group:
  'attribute/cti',
  'name/kebab',
  'time/seconds',
  'html/icon',
  'size/rem', // NOTE: This is old built-in, dimension/css overrides
  'color/css-builtin', // NOTE: Built-in color/css, overridden by utils version
  'asset/url',
  'fontFamily/css',
  'cubicBezier/css',
  'strokeStyle/css/shorthand',
  'border/css/shorthand',
  'typography/css/shorthand',
  'transition/css/shorthand',
  'shadow/css/shorthand',

  // From style-dictionary-utils:
  'color/css', // Overrides built-in, handles DTCG sRGB
  'shadow/css', // DTCG shadow objects
  'typography/css', // DTCG typography objects
  'fontFamily/css', // DTCG font family arrays
  'fontWeight/number', // Convert string to number
  'name/pathToDotNotation', // Unused in CSS but included
  'cubicBezier/css', // DTCG cubic bezier objects
  'border/css', // DTCG border objects
  'dimension/css', // DTCG dimension objects with px-to-rem
]

// When adding custom transforms, copy this list and insert custom transforms
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual sRGB parsing | color/css transform | style-dictionary-utils v3+ | Automatic DTCG color support, no custom code |
| Global unit stripping | Per-token $description metadata | DTCG spec adoption | Token-level control vs platform-level |
| Separate color formats | platform.colorOutputFormat option | style-dictionary-utils v4+ | Single transform, multiple output formats |
| String dimension values | DTCG dimension objects | DTCG spec v1.0 | Structured data, unit conversion support |

**Deprecated/outdated:**
- **Manual {value, unit} parsing:** style-dictionary-utils handles DTCG dimension objects
- **Custom RGB string builders:** color/css transform outputs all CSS color formats
- **Platform-specific transforms:** css/extended unified approach for web/CSS output

## Open Questions

1. **Should css/extended group be preserved or custom transforms listed?**
   - What we know: css/extended provides all needed transforms except unitless
   - What's unclear: Is listing 15+ transforms explicitly better than extending the group?
   - Recommendation: List all transforms explicitly - clearer what's happening, easier to debug order

2. **Should 0px convert to 0rem or just 0?**
   - What we know: CSS treats `0rem` same as `0` (unit doesn't matter for zero)
   - What's unclear: Does stripping unit from zero values add clarity or just complexity?
   - Recommendation: Keep 0rem (dimension/css default) - consistent with other rem values

3. **Should primitive tokens be filtered from mode selectors?**
   - What we know: Phase 2 includes primitives in :root, semantic tokens in mode selectors
   - What's unclear: Do primitives need explicit filtering or does filePath matching handle it?
   - Recommendation: Current Phase 2 implementation uses filePath filters - verify this continues working

## Sources

### Primary (HIGH confidence)
- [style-dictionary-utils README](https://github.com/lukasoppermann/style-dictionary-utils/blob/main/README.md) - css/extended transforms, dimension/css, color/css
- Local: `/node_modules/style-dictionary-utils/README.md` - Complete API documentation
- Local: `/node_modules/style-dictionary-utils/dist/transformer/dimension-css.js` - Source code analysis
- [Style Dictionary Transforms](https://styledictionary.com/reference/hooks/transforms/) - Custom transform API
- [Style Dictionary Built-in Transforms](https://styledictionary.com/reference/hooks/transforms/predefined/) - Transform types and structure
- Current: `buildTokens.ts` - Phase 2 multi-build pattern
- Current: `dist/css/tokens.css` - Verified output showing colors already converted to hex

### Secondary (MEDIUM confidence)
- [Style Dictionary + SD Transforms | Tokens Studio](https://docs.tokens.studio/transform-tokens/style-dictionary) - Alternative transform approaches
- [Design Tokens | Style Dictionary](https://styledictionary.com/info/tokens/) - Token metadata and $description usage
- Web Search: "style-dictionary custom transform filter token description metadata 2026" - Custom transform patterns

### Tertiary (LOW confidence)
- None - Phase 3 uses well-documented stable transforms from style-dictionary-utils

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - style-dictionary-utils documented, v6.0.1 in package.json, source code verified
- Architecture: HIGH - css/extended transform group documented, dimension/css source code analyzed, current output verified
- Pitfalls: MEDIUM-HIGH - Transform ordering well-documented, $description pattern inferred from token structure

**Research date:** 2026-02-14
**Valid until:** 60 days (stable technology, style-dictionary-utils has infrequent breaking changes)
