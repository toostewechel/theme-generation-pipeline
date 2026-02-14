# Phase 2: Multi-Mode Architecture - Research

**Researched:** 2026-02-14
**Domain:** Multi-mode CSS output with selector-based theming using Style Dictionary v5 and style-dictionary-utils
**Confidence:** HIGH

## Summary

Phase 2 implements multi-mode architecture by outputting a single CSS file with multiple selectors for light/dark color modes and sharp/default/rounded/pill radius modes. The recommended approach uses style-dictionary-utils' `css/advanced` format with its `rules` configuration to emit the same semantic token name under different CSS selectors (`:root`, `[data-color-mode='light']`, `[data-color-mode='dark']`, `[data-radius-mode='sharp']`, etc.) without collision.

The core technical challenge is filtering tokens by their source file (light vs dark, sharp vs default vs rounded vs pill) and mapping each mode to the correct CSS selector while maintaining proper specificity order. Style Dictionary's `token.filePath` metadata property enables filtering tokens by source file, and the `css/advanced` format's `rules` array with `matcher` functions allows outputting the same token under different selectors in a single file.

**Primary recommendation:** Use `css/advanced` format from style-dictionary-utils (already installed v6.0.1) with multiple rules that match tokens by `filePath`, each rule specifying its own `selector`. Output light mode and default radius to `:root` first, then output all modes again under `[data-*]` selectors in deterministic order to ensure proper CSS cascade.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| style-dictionary-utils | 6.0.1 | DTCG-aware transforms and advanced CSS formats | De facto standard for DTCG token processing, provides `css/advanced` format with selector/rules support, maintained actively |
| Style Dictionary | 5.2.0 | Design token transformation engine | Already in use (Phase 1), provides `filePath` metadata for filtering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No additional dependencies needed | Phase 2 uses existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single file with rules | Multiple CSS files | Multiple files require runtime loading logic, single file simpler consumption, better performance (fewer HTTP requests) |
| css/advanced format | Custom format | Custom format requires maintenance, hand-rolled selector logic, css/advanced battle-tested |
| filePath matching | Custom token metadata | filePath is built-in SD metadata, no custom preprocessing needed, simpler |
| data-attributes | CSS classes | data-attributes semantically clearer, better for SSR/HTML attributes, conventional in theme systems |

**Installation:**
```bash
# Already installed in package.json
npm install -D style-dictionary-utils@^6.0.1
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── buildTokens.ts       # Updated with css/advanced format + rules
src/tokens/
├── manifest.json        # Existing collections/modes
├── color.light.tokens.json   # Light mode colors
├── color.dark.tokens.json    # Dark mode colors
├── radius.sharp.tokens.json  # Sharp radius mode
├── radius.default.tokens.json # Default radius mode
├── radius.rounded.tokens.json # Rounded radius mode
├── radius.pill.tokens.json   # Pill radius mode
dist/css/
└── tokens.css           # Single file with multiple selectors
```

### Pattern 1: css/advanced Format with Rules
**What:** Use style-dictionary-utils' `css/advanced` format to output multiple selectors in a single file
**When to use:** When different token sets (modes) need different CSS selectors but share token names
**Example:**
```typescript
// Source: style-dictionary-utils documentation
import { StyleDictionary } from 'style-dictionary-utils';

const sd = new StyleDictionary({
  source: sourceFiles, // All token files from manifest
  platforms: {
    css: {
      transformGroup: 'css/extended', // DTCG-aware transforms
      buildPath: 'dist/css/',
      files: [{
        destination: 'tokens.css',
        format: 'css/advanced',
        options: {
          selector: ':root', // Default selector for tokens not matching rules
          outputReferences: true, // Preserve {token} refs as var(--token)
          rules: [
            // Rule 1: Light mode under :root (default)
            {
              selector: ':root',
              matcher: (token) => token.filePath.includes('color.light.tokens.json')
            },
            // Rule 2: Light mode under [data-color-mode='light']
            {
              selector: "[data-color-mode='light']",
              matcher: (token) => token.filePath.includes('color.light.tokens.json')
            },
            // Rule 3: Dark mode under [data-color-mode='dark']
            {
              selector: "[data-color-mode='dark']",
              matcher: (token) => token.filePath.includes('color.dark.tokens.json')
            },
            // Rule 4: Default radius under :root
            {
              selector: ':root',
              matcher: (token) => token.filePath.includes('radius.default.tokens.json')
            },
            // Rule 5-7: Radius modes under [data-radius-mode='*']
            {
              selector: "[data-radius-mode='sharp']",
              matcher: (token) => token.filePath.includes('radius.sharp.tokens.json')
            },
            {
              selector: "[data-radius-mode='default']",
              matcher: (token) => token.filePath.includes('radius.default.tokens.json')
            },
            {
              selector: "[data-radius-mode='rounded']",
              matcher: (token) => token.filePath.includes('radius.rounded.tokens.json')
            },
            {
              selector: "[data-radius-mode='pill']",
              matcher: (token) => token.filePath.includes('radius.pill.tokens.json')
            }
          ]
        }
      }]
    }
  }
});
```

### Pattern 2: Token Filtering by filePath
**What:** Use Style Dictionary's built-in `filePath` metadata to identify which mode file a token came from
**When to use:** When tokens with same name exist in multiple mode files (light/dark, sharp/pill, etc.)
**Example:**
```typescript
// Source: Style Dictionary documentation - filters
// token.filePath automatically set by Style Dictionary during parse
// Example token object after parsing:
{
  "$type": "color",
  "$value": "{color-neutral-900}",
  "name": "color-text-default",
  "path": ["color-text-default"],
  "filePath": "src/tokens/color.light.tokens.json", // ✅ Auto-populated
  // ... other metadata
}

// Matcher function uses filePath to filter:
matcher: (token) => {
  return token.filePath.includes('color.light.tokens.json'); // ✅ Returns true for light mode tokens
}
```

### Pattern 3: CSS Selector Specificity Order
**What:** Ensure `:root` selectors appear before `[data-*]` selectors in output for proper cascade
**When to use:** Always, when multiple selectors target same properties
**Example:**
```css
/* Source: CSS cascade/specificity rules */
/* ✅ CORRECT ORDER - :root first establishes defaults */
:root {
  --color-text-default: var(--color-neutral-900); /* Light mode default */
  --radius-intensity: 1; /* Default radius mode */
}

[data-color-mode='light'] {
  --color-text-default: var(--color-neutral-900); /* Explicit light */
}

[data-color-mode='dark'] {
  --color-text-default: var(--color-neutral-200); /* Dark override */
}

[data-radius-mode='sharp'] {
  --radius-intensity: 0; /* Sharp override */
}

/* ❌ WRONG ORDER - data-attributes before :root breaks defaults */
[data-color-mode='dark'] {
  --color-text-default: var(--color-neutral-200);
}

:root {
  --color-text-default: var(--color-neutral-900); /* Overrides dark! */
}
```

**Why order matters:** `:root` and `[data-*]` have equal specificity (0,1,0), so cascade uses source order. Defaults in `:root` must come first, then `[data-*]` overrides.

### Pattern 4: Same Token Name in Multiple Selectors
**What:** Output identical token names under different selectors without collision
**When to use:** Multi-mode theming where semantic token names stay consistent across modes
**Example:**
```css
/* Source: css/advanced format output */
/* Same token name appears in multiple selectors - no collision */
:root {
  --color-background-surface-default: var(--color-neutral-0); /* Light mode */
}

[data-color-mode='light'] {
  --color-background-surface-default: var(--color-neutral-0); /* Duplicate for explicit mode */
}

[data-color-mode='dark'] {
  --color-background-surface-default: var(--color-neutral-dark-surface-2); /* Different value, same name */
}

/* Consumer code uses consistent token name regardless of mode */
.card {
  background: var(--color-background-surface-default); /* Automatically adapts to mode */
}
```

### Pattern 5: Deterministic Rule Order
**What:** Define rules array in explicit order to control CSS output order
**When to use:** Always, to ensure `:root` defaults output before `[data-*]` overrides
**Example:**
```typescript
// Source: css/advanced format behavior
options: {
  rules: [
    // ✅ CORRECT: Default modes first (output to :root first)
    { selector: ':root', matcher: (token) => token.filePath.includes('color.light.tokens.json') },
    { selector: ':root', matcher: (token) => token.filePath.includes('radius.default.tokens.json') },

    // Then all mode selectors (output after :root)
    { selector: "[data-color-mode='light']", matcher: (token) => token.filePath.includes('color.light.tokens.json') },
    { selector: "[data-color-mode='dark']", matcher: (token) => token.filePath.includes('color.dark.tokens.json') },
    { selector: "[data-radius-mode='sharp']", matcher: (token) => token.filePath.includes('radius.sharp.tokens.json') },
    // ... etc
  ]
}
```

### Anti-Patterns to Avoid
- **Using filter instead of rules:** filter excludes tokens from output, rules include same token multiple times under different selectors
- **Hardcoded file names in matchers:** Brittle, use `includes()` or regex to match patterns
- **Multiple StyleDictionary instances:** Creates multiple files, not single combined file - use rules instead
- **Wrong selector order:** `[data-*]` before `:root` breaks default values
- **Forgetting outputReferences:** Token references resolve to static values instead of CSS var() references

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multiple selectors in one file | Custom format concatenating outputs | css/advanced format | Handles selector wrapping, proper formatting, tested |
| Token filtering by source file | Custom metadata or preprocessing | token.filePath built-in metadata | Automatically populated by SD, no custom code needed |
| CSS specificity ordering | Manual file concatenation | Rules array order | Deterministic output order guaranteed |
| Mode-aware token resolution | Runtime JavaScript switching logic | CSS cascade with data-attributes | Works without JS, SSR-friendly, progressive enhancement |
| Duplicate token detection | Custom validation | Style Dictionary collision warnings | Built-in, warns about unintended duplicates |

**Key insight:** style-dictionary-utils' `css/advanced` format solves the exact problem of outputting tokens under multiple selectors in a single file. Custom formats would require reimplementing selector wrapping, formatting, and order management.

## Common Pitfalls

### Pitfall 1: Using filter Instead of rules
**What goes wrong:** Tokens filtered by mode appear only once, not under multiple selectors
**Why it happens:** `filter` excludes tokens (true = include, false = exclude), but multi-mode needs same token under different selectors
**How to avoid:** Use `rules` with matchers, not `filter`. Rules include matching tokens under their selector, allowing duplication.
**Warning signs:** Each mode selector has different tokens, semantic token names missing from some modes
```typescript
// ❌ WRONG - filter excludes tokens from other modes
files: [
  {
    destination: 'tokens.css',
    format: 'css/variables',
    filter: (token) => token.filePath.includes('color.light.tokens.json') // Only light tokens output
  }
]
// Result: Only light mode tokens in file, no dark mode

// ✅ CORRECT - rules allow same token under multiple selectors
files: [
  {
    destination: 'tokens.css',
    format: 'css/advanced',
    options: {
      rules: [
        { selector: ':root', matcher: (token) => token.filePath.includes('color.light.tokens.json') },
        { selector: "[data-color-mode='dark']", matcher: (token) => token.filePath.includes('color.dark.tokens.json') }
      ]
    }
  }
]
// Result: Light tokens under :root, dark tokens under [data-color-mode='dark']
```

### Pitfall 2: Wrong CSS Selector Order
**What goes wrong:** Default mode values don't apply, or mode overrides don't work
**Why it happens:** `:root` and `[data-*]` have equal specificity, cascade uses source order - if `[data-*]` comes first, `:root` overwrites it
**How to avoid:** Define `:root` rules first in rules array, then `[data-*]` rules
**Warning signs:** Defaults work but mode switching doesn't change values, or mode switching works but defaults are wrong
```typescript
// ❌ WRONG - data-attribute rules before :root rules
rules: [
  { selector: "[data-color-mode='dark']", matcher: (token) => token.filePath.includes('color.dark.tokens.json') },
  { selector: ':root', matcher: (token) => token.filePath.includes('color.light.tokens.json') }
]
// CSS output order matches rules order:
// [data-color-mode='dark'] { --color-text-default: ...; }  /* First */
// :root { --color-text-default: ...; }  /* Second - overwrites dark! */

// ✅ CORRECT - :root rules first
rules: [
  { selector: ':root', matcher: (token) => token.filePath.includes('color.light.tokens.json') },
  { selector: "[data-color-mode='dark']", matcher: (token) => token.filePath.includes('color.dark.tokens.json') }
]
// CSS output:
// :root { --color-text-default: ...; }  /* Default */
// [data-color-mode='dark'] { --color-text-default: ...; }  /* Override when mode active */
```

### Pitfall 3: Primitive Tokens Appear in Mode Selectors
**What goes wrong:** Primitive tokens (color-neutral-500) appear under `[data-color-mode='dark']` even though they're not mode-specific
**Why it happens:** All source files in source array, matchers don't exclude primitives
**How to avoid:** Matchers should match ONLY mode-specific files, exclude primitive files OR accept that primitives appear everywhere (no functional impact)
**Warning signs:** Primitives duplicated under every mode selector, inflated CSS file size
```typescript
// ❌ PROBLEM - primitives match if matcher too broad
matcher: (token) => token.filePath.includes('color') // Matches primitives-color.mode-1.tokens.json too!

// ✅ SOLUTION 1 - Specific file matching
matcher: (token) => token.filePath.includes('color.light.tokens.json') // Only semantic light tokens

// ✅ SOLUTION 2 - Exclude primitives explicitly
matcher: (token) =>
  token.filePath.includes('color.light.tokens.json') &&
  !token.filePath.includes('primitives')

// ✅ SOLUTION 3 - Accept duplication (no functional impact, CSS vars override by specificity/order)
// Primitives output under every selector, but last definition wins (same value anyway)
```

### Pitfall 4: Forgetting outputReferences
**What goes wrong:** Token references resolve to static values instead of CSS variables, breaks token chain
**Why it happens:** `outputReferences: true` not set in options, SD resolves all `{token}` refs
**How to avoid:** Always set `outputReferences: true` for CSS outputs
**Warning signs:** CSS contains static values instead of var() references, changing primitive doesn't update semantics
```css
/* ❌ WITHOUT outputReferences: true */
:root {
  --color-neutral-900: rgb(23 23 23);
  --color-text-default: rgb(23 23 23); /* Static value - broken chain */
}

/* ✅ WITH outputReferences: true */
:root {
  --color-neutral-900: rgb(23 23 23);
  --color-text-default: var(--color-neutral-900); /* Variable reference - chain preserved */
}
```

### Pitfall 5: Deep Merge Collision Warnings
**What goes wrong:** Style Dictionary warns about token collisions when same token name exists in light and dark files
**Why it happens:** SD deep merges all source files, detects that `color-text-default` exists in both light and dark (intentional for multi-mode)
**How to avoid:** Warnings are expected and safe to ignore for mode tokens - they're intentional collisions
**Warning signs:** Console shows "Token collision" warnings during build for mode tokens
```bash
# Expected warnings (safe to ignore):
⚠️  Token collision detected: color-text-default
   src/tokens/color.light.tokens.json
   src/tokens/color.dark.tokens.json

# This is INTENTIONAL - same semantic token with different values per mode
```

**Note:** These collision warnings are informational, not errors. They confirm that modes are overriding the same semantic tokens as intended.

### Pitfall 6: Mode Tokens Not Reaching Rules Matcher
**What goes wrong:** Mode tokens don't appear under their selectors, rules matcher doesn't find them
**Why it happens:** Source files not included in source array, or matcher `filePath` pattern doesn't match actual path
**How to avoid:** Verify all mode files in source array, log `token.filePath` in matcher to debug
**Warning signs:** Empty selectors in output, tokens missing from expected modes
```typescript
// Debug matcher:
matcher: (token) => {
  console.log(`Token: ${token.name}, filePath: ${token.filePath}`); // Debug output
  return token.filePath.includes('color.light.tokens.json');
}

// Common cause: relative vs absolute paths
// filePath might be: "src/tokens/color.light.tokens.json" (relative)
// OR: "/Users/you/project/src/tokens/color.light.tokens.json" (absolute)
// Use includes() not exact match
```

## Code Examples

Verified patterns from official sources and research:

### Complete Build Script with Multi-Mode Rules
```typescript
// Source: style-dictionary-utils css/advanced format + SD v5 API
import { StyleDictionary } from 'style-dictionary-utils';
import { readFileSync, mkdirSync } from 'fs';

interface Manifest {
  collections: {
    [collectionName: string]: {
      modes: {
        [modeName: string]: string[];
      };
    };
  };
}

async function buildTokens() {
  // Read manifest.json
  const manifest: Manifest = JSON.parse(
    readFileSync('src/tokens/manifest.json', 'utf8')
  );

  // Discover all token files (stable order)
  const sourceFiles = Object.entries(manifest.collections)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([_, collection]) =>
      Object.entries(collection.modes)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([_, files]) => files.sort())
    )
    .map(file => `src/tokens/${file}`);

  console.log(`Discovered ${sourceFiles.length} token files`);

  // Ensure output directory exists
  mkdirSync('dist/css', { recursive: true });

  // Create Style Dictionary instance with css/advanced format
  const sd = new StyleDictionary({
    source: sourceFiles,
    platforms: {
      css: {
        transformGroup: 'css/extended', // DTCG-aware transforms
        buildPath: 'dist/css/',
        files: [{
          destination: 'tokens.css',
          format: 'css/advanced',
          options: {
            selector: ':root', // Default for tokens not matching any rule
            outputReferences: true, // Preserve {token} refs as var(--token)
            rules: [
              // ===== DEFAULTS IN :root (appear first in CSS) =====

              // Light color mode as default
              {
                selector: ':root',
                matcher: (token) => token.filePath.includes('color.light.tokens.json')
              },

              // Default radius mode as default
              {
                selector: ':root',
                matcher: (token) => token.filePath.includes('radius.default.tokens.json')
              },

              // ===== MODE OVERRIDES (appear after :root) =====

              // Color modes
              {
                selector: "[data-color-mode='light']",
                matcher: (token) => token.filePath.includes('color.light.tokens.json')
              },
              {
                selector: "[data-color-mode='dark']",
                matcher: (token) => token.filePath.includes('color.dark.tokens.json')
              },

              // Radius modes
              {
                selector: "[data-radius-mode='sharp']",
                matcher: (token) => token.filePath.includes('radius.sharp.tokens.json')
              },
              {
                selector: "[data-radius-mode='default']",
                matcher: (token) => token.filePath.includes('radius.default.tokens.json')
              },
              {
                selector: "[data-radius-mode='rounded']",
                matcher: (token) => token.filePath.includes('radius.rounded.tokens.json')
              },
              {
                selector: "[data-radius-mode='pill']",
                matcher: (token) => token.filePath.includes('radius.pill.tokens.json')
              }
            ]
          }
        }]
      }
    }
  });

  // Build all platforms (async)
  await sd.buildAllPlatforms();

  console.log('✅ Build complete: dist/css/tokens.css');
}

// Execute build
buildTokens().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
```

### Expected CSS Output Structure
```css
/* Source: css/advanced format behavior */

/* ===== DEFAULTS - :root first ===== */
:root {
  /* Primitive colors (appear in all selectors or just :root) */
  --color-neutral-0: rgb(255 255 255);
  --color-neutral-900: rgb(23 23 23);

  /* Light mode semantic colors (default) */
  --color-text-default: var(--color-neutral-900);
  --color-background-surface-default: var(--color-neutral-0);

  /* Default radius mode (default) */
  --radius-intensity: 1;
}

/* ===== MODE OVERRIDES - data-attributes after :root ===== */

[data-color-mode='light'] {
  /* Same as :root light mode (explicit) */
  --color-text-default: var(--color-neutral-900);
  --color-background-surface-default: var(--color-neutral-0);
}

[data-color-mode='dark'] {
  /* Dark mode overrides */
  --color-text-default: var(--color-neutral-200);
  --color-background-surface-default: var(--color-neutral-dark-surface-2);
}

[data-radius-mode='sharp'] {
  --radius-intensity: 0;
}

[data-radius-mode='default'] {
  --radius-intensity: 1;
}

[data-radius-mode='rounded'] {
  --radius-intensity: 2;
}

[data-radius-mode='pill'] {
  --radius-intensity: 9999;
}
```

### HTML Usage Pattern
```html
<!-- Source: CSS custom properties usage patterns -->

<!-- Default mode (uses :root values) -->
<html>
  <body>
    <div class="card">
      <!-- Uses --color-background-surface-default from :root (light mode) -->
      <!-- Uses --radius-intensity from :root (default = 1) -->
    </div>
  </body>
</html>

<!-- Explicit light mode + sharp radius -->
<html data-color-mode="light" data-radius-mode="sharp">
  <body>
    <div class="card">
      <!-- Uses --color-background-surface-default from [data-color-mode='light'] (same as default) -->
      <!-- Uses --radius-intensity from [data-radius-mode='sharp'] (0) -->
    </div>
  </body>
</html>

<!-- Dark mode + pill radius -->
<html data-color-mode="dark" data-radius-mode="pill">
  <body>
    <div class="card">
      <!-- Uses --color-background-surface-default from [data-color-mode='dark'] (dark surface) -->
      <!-- Uses --radius-intensity from [data-radius-mode='pill'] (9999) -->
    </div>
  </body>
</html>
```

### Matcher Function Patterns
```typescript
// Source: style-dictionary-utils and SD documentation

// Pattern 1: Simple file includes
matcher: (token) => token.filePath.includes('color.light.tokens.json')

// Pattern 2: Exclude primitives
matcher: (token) =>
  token.filePath.includes('color.light.tokens.json') &&
  !token.filePath.includes('primitives')

// Pattern 3: Multiple files for same selector
matcher: (token) =>
  token.filePath.includes('color.light.tokens.json') ||
  token.filePath.includes('color.shared.tokens.json')

// Pattern 4: Regex for complex patterns
matcher: (token) => /color\.(light|shared)\.tokens\.json$/.test(token.filePath)

// Pattern 5: Debug logging
matcher: (token) => {
  const matches = token.filePath.includes('color.light.tokens.json');
  if (matches) {
    console.log(`Matched token: ${token.name} from ${token.filePath}`);
  }
  return matches;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple CSS files per mode | Single file with selectors | Always available | Simpler consumption, fewer HTTP requests, better performance |
| CSS classes for modes (.light, .dark) | data-attributes ([data-color-mode]) | Convention shift ~2020 | More semantic, SSR-friendly, clearer intent |
| Manual file concatenation | css/advanced format rules | style-dictionary-utils v3+ | Automated, deterministic, no custom build logic |
| Custom format for selectors | css/advanced built-in | style-dictionary-utils v3+ | No maintenance burden, battle-tested |
| filter for mode separation | rules for mode duplication | style-dictionary-utils v3+ | Same token under multiple selectors without collision |

**Deprecated/outdated:**
- **Multiple separate CSS files:** Modern bundlers handle single large file better than multiple small files
- **JavaScript-only theme switching:** CSS-based switching works without JS, progressive enhancement
- **Custom selector formats:** css/advanced solves this, custom formats unnecessary

## Open Questions

1. **Should primitives appear in mode selectors or only :root?**
   - What we know: Primitives are mode-agnostic (color-neutral-500 same in light/dark)
   - What's unclear: Include in every selector (duplication) or filter out (cleaner)?
   - Recommendation: Include everywhere (simpler matchers, no functional impact - last value wins, all values identical)

2. **Should primitives have their own :root-only rule?**
   - What we know: Could add rule for primitives that ONLY outputs to :root, not mode selectors
   - What's unclear: Worth the complexity vs letting them appear everywhere?
   - Recommendation: Let primitives match mode rules (appears in all selectors) - simpler, deterministic, no conditional logic

3. **How to handle tokens in manifest.styles (typography.styles.tokens.json)?**
   - What we know: Phase 2 focuses on color/radius modes, styles not mode-specific
   - What's unclear: Should styles appear in :root only, or all selectors?
   - Recommendation: Defer to Phase 4 - for now, let them match default :root selector (options.selector fallback)

4. **Should collision warnings be suppressed programmatically?**
   - What we know: Expected warnings for mode tokens with same names
   - What's unclear: Can/should we suppress these specific warnings?
   - Recommendation: Keep warnings (informational, not errors), document they're expected - helps catch unintended collisions

## Sources

### Primary (HIGH confidence)
- [style-dictionary-utils GitHub](https://github.com/lukasoppermann/style-dictionary-utils) - css/advanced format, rules/matcher configuration
- [style-dictionary-utils npm](https://www.npmjs.com/package/style-dictionary-utils) - Version 6.0.1 documentation
- [Style Dictionary Filters](https://styledictionary.com/reference/hooks/filters/) - Filter vs rules distinction, token metadata
- [Style Dictionary Formats](https://styledictionary.com/reference/hooks/formats/) - Format options, outputReferences
- [MDN: CSS Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity) - Selector specificity rules, cascade order
- [MDN: Using CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) - CSS variables cascade and inheritance
- Local: `package.json` - Confirmed style-dictionary-utils 6.0.1 installed

### Secondary (MEDIUM confidence)
- [Always Twisted: Implementing Light and Dark Mode with Style Dictionary](https://www.alwaystwisted.com/articles/a-design-tokens-workflow-part-7) - Multi-mode patterns
- [dbanksdesign/style-dictionary-dark-mode GitHub](https://github.com/dbanksdesign/style-dictionary-dark-mode) - Dark mode implementation examples
- [CSS Custom Properties: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/css-variables-complete-guide) - Modern CSS variables usage
- [Smashing Magazine: CSS Custom Properties In The Cascade](https://www.smashingmagazine.com/2019/07/css-custom-properties-cascade/) - Cascade behavior with custom properties

### Tertiary (LOW confidence)
- None - Phase 2 uses well-documented patterns with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - style-dictionary-utils 6.0.1 verified installed, css/advanced format documented
- Architecture: HIGH - css/advanced rules pattern verified, CSS specificity rules well-established
- Pitfalls: HIGH - Common issues documented in community resources, CSS cascade rules clear

**Research date:** 2026-02-14
**Valid until:** 60 days (style-dictionary-utils stable, CSS cascade rules unchanging)
