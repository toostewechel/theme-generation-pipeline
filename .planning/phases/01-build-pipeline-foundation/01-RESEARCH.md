# Phase 1: Build Pipeline Foundation - Research

**Researched:** 2026-02-14
**Domain:** Style Dictionary v5 build pipeline with manifest processing
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational build pipeline that processes manifest.json and outputs CSS with resolved token references. The recommended approach uses Style Dictionary v5's programmatic API to read manifest.json, create a single StyleDictionary instance with all token files as sources, apply basic transforms (name/kebab for CSS variables), and output to dist/css/tokens.css using the css/variables format.

The core technical challenge is parsing manifest.json to discover all token files, configuring Style Dictionary with proper source file paths for reference resolution, and ensuring the build runs deterministically. Style Dictionary v5's async-first architecture requires careful await usage in the build script, and the deep merge behavior requires understanding how multiple token files combine.

**Primary recommendation:** Build script reads manifest.json, flattens all collection mode files into a single source array, creates one StyleDictionary instance, applies minimal transforms (name/kebab only at this phase), and outputs single CSS file. Defer color/dimension transformations to Phase 3 to reduce complexity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Style Dictionary | 5.2.0 | Design token transformation engine | Industry standard for token pipelines, async/ESM architecture, massive ecosystem, battle-tested reference resolution |
| tsx | 4.x | TypeScript build script execution | Zero-config TS runner, no compilation step, fast, standard for Node.js TS tooling |
| Node.js | 22+ | Runtime environment | Required by Style Dictionary v5 (hard requirement in package.json engines field) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 25.x | TypeScript definitions for Node.js | Type safety in build script, autocomplete for fs/path modules |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Style Dictionary | Theo (Salesforce) | Never use - deprecated since 2019, no DTCG support |
| Style Dictionary | Cobalt-UI | Only if need real-time Figma sync - smaller ecosystem, less mature |
| Programmatic API | CLI | CLI simpler but can't read manifest.json programmatically or customize build flow |
| tsx | ts-node | tsx faster startup, no tsconfig needed, better ESM support |

**Installation:**
```bash
# Already installed in this project
npm install -D style-dictionary@^5.2.0 tsx@^4.0.0 @types/node@^25.0.10
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── buildTokens.ts       # Main build orchestrator
src/tokens/
├── manifest.json        # Collections/modes definition
├── *.tokens.json        # Token files
dist/css/
└── tokens.css           # Build output (generated)
```

### Pattern 1: Manifest-Based Token Discovery
**What:** Read manifest.json to discover all token files instead of hardcoding paths
**When to use:** When token organization is complex (multiple collections, modes)
**Example:**
```typescript
// Source: Style Dictionary v5 patterns + manifest.json structure
import { readFileSync } from 'fs';

interface Manifest {
  collections: {
    [collectionName: string]: {
      modes: {
        [modeName: string]: string[];
      };
    };
  };
}

const manifest: Manifest = JSON.parse(
  readFileSync('src/tokens/manifest.json', 'utf8')
);

// Flatten all mode files into single source array
const sourceFiles: string[] = [];
for (const collection of Object.values(manifest.collections)) {
  for (const files of Object.values(collection.modes)) {
    sourceFiles.push(...files.map(f => `src/tokens/${f}`));
  }
}

// sourceFiles: [
//   'src/tokens/primitives-color.mode-1.tokens.json',
//   'src/tokens/color.light.tokens.json',
//   'src/tokens/color.dark.tokens.json',
//   // ... all other files
// ]
```

### Pattern 2: Style Dictionary v5 Async API
**What:** Use async/await with Style Dictionary v5 programmatic API
**When to use:** All Style Dictionary v5 builds (required, not optional)
**Example:**
```typescript
// Source: https://styledictionary.com/reference/api/
import StyleDictionary from 'style-dictionary';

async function buildTokens() {
  const sd = new StyleDictionary({
    source: sourceFiles, // From Pattern 1
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'dist/css/',
        files: [{
          destination: 'tokens.css',
          format: 'css/variables'
        }]
      }
    }
  });

  // CRITICAL: await required in v5 (async-first architecture)
  await sd.buildAllPlatforms();

  console.log('Build complete: dist/css/tokens.css');
}

buildTokens();
```

### Pattern 3: ESM Module System
**What:** Use ES modules (import/export) not CommonJS (require)
**When to use:** Style Dictionary v5 is ESM-only, no CommonJS support
**Example:**
```typescript
// package.json MUST have:
{
  "type": "module"
}

// Build script uses ESM syntax:
import StyleDictionary from 'style-dictionary'; // ✅
const StyleDictionary = require('style-dictionary'); // ❌ ERROR in v5
```

### Pattern 4: Source Files for Reference Resolution
**What:** All token files in source array for deep merge and reference resolution
**When to use:** When semantic tokens reference primitives (this project's pattern)
**Example:**
```typescript
// Source: https://styledictionary.com/reference/config/
{
  source: [
    'src/tokens/primitives-color.mode-1.tokens.json', // Defines {color-neutral-500}
    'src/tokens/color.light.tokens.json'  // References {color-neutral-500}
  ]
}

// color.light.tokens.json:
{
  "color-text-default": {
    "$type": "color",
    "$value": "{color-neutral-900}" // ✅ Resolves because primitive in source
  }
}
```

### Pattern 5: Build Script as npm Script
**What:** Run build via npm script using tsx for TypeScript execution
**When to use:** Always (requirement PIPE-05)
**Example:**
```json
// package.json
{
  "scripts": {
    "build:tokens": "npx tsx scripts/buildTokens.ts"
  }
}
```

### Anti-Patterns to Avoid
- **Synchronous buildAllPlatforms():** v5 is async-first, missing await produces empty/partial output with no errors
- **Hardcoded token file paths:** Brittle when adding new files, manifest.json is single source of truth
- **Separate build per token file:** Breaks reference resolution, massive config duplication
- **Using v4 API patterns:** `StyleDictionary.extend(config)` deprecated, use `new StyleDictionary(config)`
- **Missing error handling:** Build can fail silently, always check output file exists

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token reference resolution | Custom {token-name} parser | Style Dictionary built-in | Handles transitive refs, circular detection, deep merging, edge cases |
| File path globbing | Custom glob implementation | Style Dictionary source array | Accepts globs, handles merging, already tested |
| CSS variable naming | Manual kebab-case converter | name/kebab transform | Handles edge cases (numbers, special chars, unicode) |
| Token type detection | Custom $type parser | Style Dictionary token.type | Validated against DTCG spec, handles inheritance |
| Build determinism | Manual sorting/hashing | Style Dictionary output | Deterministic by default when source order stable |

**Key insight:** Style Dictionary has solved token-specific edge cases (circular refs, transitive resolution, type inheritance). Custom solutions miss edge cases and create maintenance burden.

## Common Pitfalls

### Pitfall 1: Async Not Awaited
**What goes wrong:** `buildAllPlatforms()` returns Promise, missing await completes script before build finishes, produces empty/partial output with no error message
**Why it happens:** v4 was synchronous, v5 breaking change to async-first
**How to avoid:** Wrap build in async function, await all Style Dictionary API calls, verify output file exists
**Warning signs:** dist/ folder empty, no error messages, script completes instantly
```typescript
// ❌ WRONG - no await
function buildTokens() {
  const sd = new StyleDictionary(config);
  sd.buildAllPlatforms(); // Returns Promise, ignored
  console.log('Done'); // Logs before build finishes
}

// ✅ CORRECT - async/await
async function buildTokens() {
  const sd = new StyleDictionary(config);
  await sd.buildAllPlatforms(); // Waits for completion
  console.log('Done'); // Logs after build
}
```

### Pitfall 2: Token References Unresolved
**What goes wrong:** CSS output contains literal `{color-neutral-500}` instead of resolved value
**Why it happens:** Referenced token not in source array, typo in reference name, or circular reference
**How to avoid:** Include ALL token files in source array (primitives + semantics), verify reference syntax matches token names exactly
**Warning signs:** CSS contains curly braces, console shows "Reference doesn't exist" warnings
```typescript
// ❌ WRONG - primitives not in source
{
  source: ['src/tokens/color.light.tokens.json'] // References primitives but doesn't include them
}

// ✅ CORRECT - all files in source
{
  source: [
    'src/tokens/primitives-color.mode-1.tokens.json',
    'src/tokens/color.light.tokens.json'
  ]
}
```

### Pitfall 3: ESM/CommonJS Conflicts
**What goes wrong:** "require is not defined" or "Cannot use import statement outside module" errors
**Why it happens:** package.json missing "type": "module" or mixing ESM/CommonJS syntax
**How to avoid:** Verify package.json has "type": "module", use import/export everywhere, avoid require()
**Warning signs:** Module loading errors, syntax errors at runtime
```typescript
// package.json MUST have:
{
  "type": "module"
}

// ❌ WRONG - CommonJS in ESM project
const fs = require('fs');

// ✅ CORRECT - ESM syntax
import { readFileSync } from 'fs';
```

### Pitfall 4: Build Path Doesn't Exist
**What goes wrong:** Build fails with "ENOENT: no such file or directory" when writing output
**Why it happens:** dist/css/ folder doesn't exist, Style Dictionary doesn't create parent directories
**How to avoid:** Create buildPath directory before build, or use fs.mkdirSync with recursive option
**Warning signs:** ENOENT errors, build fails immediately
```typescript
// ✅ Create output directory before build
import { mkdirSync } from 'fs';

async function buildTokens() {
  mkdirSync('dist/css', { recursive: true });

  const sd = new StyleDictionary({
    platforms: {
      css: {
        buildPath: 'dist/css/', // Now guaranteed to exist
        // ...
      }
    }
  });

  await sd.buildAllPlatforms();
}
```

### Pitfall 5: Non-Deterministic Output
**What goes wrong:** Same input produces different output (variable order changes), breaks git diffs, causes false cache invalidation
**Why it happens:** Source array order unstable (Object.values on unordered object), async file reads
**How to avoid:** Sort source files array, use stable iteration over manifest.json, await all async operations
**Warning signs:** Git shows variable reordering with no actual changes, CI rebuilds identical tokens differently
```typescript
// ❌ WRONG - unstable order
const sourceFiles = Object.values(manifest.collections)
  .flatMap(c => Object.values(c.modes).flat());

// ✅ CORRECT - stable sorted order
const sourceFiles = Object.entries(manifest.collections)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([_, collection]) =>
    Object.entries(collection.modes)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([_, files]) => files.sort())
  )
  .map(f => `src/tokens/${f}`);
```

## Code Examples

Verified patterns from official sources:

### Complete Build Script
```typescript
// Source: Style Dictionary v5 API docs + manifest.json structure
import StyleDictionary from 'style-dictionary';
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

  // Create Style Dictionary instance
  const sd = new StyleDictionary({
    source: sourceFiles,
    platforms: {
      css: {
        transformGroup: 'css', // Includes name/kebab
        buildPath: 'dist/css/',
        files: [{
          destination: 'tokens.css',
          format: 'css/variables'
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

### Minimal css/variables Output
```typescript
// Source: https://styledictionary.com/reference/hooks/formats/predefined/
{
  destination: 'tokens.css',
  format: 'css/variables',
  options: {
    outputReferences: true // Preserve {token} refs as var(--token)
  }
}

// Output:
// :root {
//   --color-neutral-500: rgb(165 166 171);
//   --color-text-default: var(--color-neutral-500);
// }
```

### Built-in css Transform Group
```typescript
// Source: Style Dictionary v5 built-in transform groups
{
  transformGroup: 'css' // Includes:
  // - attribute/cti (category/type/item attributes)
  // - name/kebab (kebab-case names)
  // - time/seconds (ms -> s)
  // - html/icon (icon paths)
  // - size/rem (px -> rem, but NOT for DTCG dimension objects)
  // - color/css (hex/rgb/hsl, but NOT for DTCG sRGB objects)
  // - asset/url (asset paths)
  // - fontFamily/css (quoted font stacks)
  // - cubicBezier/css (timing functions)
  // - strokeStyle/css/shorthand (border shorthand)
  // - border/css/shorthand (border shorthand)
  // - typography/css/shorthand (font shorthand)
  // - transition/css/shorthand (transition shorthand)
  // - shadow/css/shorthand (box-shadow shorthand)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Style Dictionary v4 (sync) | Style Dictionary v5 (async) | v5.0.0 (2023) | All API calls return Promises, requires await, enables async transforms |
| CommonJS (require) | ESM only (import) | v5.0.0 | Must use "type": "module" in package.json, no require() support |
| StyleDictionary.extend() | new StyleDictionary() | v5.0.0 | More explicit instantiation, cleaner separation of concerns |
| Custom reference syntax | Fixed {token} syntax | v5.0.0 | Aligned with DTCG spec, no customization allowed |
| Manual token file discovery | Glob patterns in source | Always supported | Use manifest.json for explicit control vs glob for simplicity |

**Deprecated/outdated:**
- **v4 API patterns**: Still work in some cases but deprecated, use v5 API
- **Synchronous builds**: No longer supported, all builds async
- **CommonJS modules**: Not supported in v5, ESM only

## Open Questions

1. **What tokens appear in Phase 1 output?**
   - What we know: All tokens from all collections/modes in source array
   - What's unclear: Should primitives and semantics both appear, or filter?
   - Recommendation: Output everything in Phase 1, defer filtering to later phase (simpler)

2. **How to handle DTCG color objects in Phase 1?**
   - What we know: Built-in color/css transform doesn't parse sRGB component arrays
   - What's unclear: Output raw objects in Phase 1, or add style-dictionary-utils now?
   - Recommendation: Defer to Phase 3 - output raw values in Phase 1 to reduce complexity

3. **Should build clean dist/ before writing?**
   - What we know: Good practice to remove old files
   - What's unclear: Add clean step or let SD overwrite?
   - Recommendation: Add mkdirSync with recursive, let SD overwrite - simpler than full clean

## Sources

### Primary (HIGH confidence)
- [Style Dictionary v5 Configuration](https://styledictionary.com/reference/config/) - Source arrays, platform config
- [Style Dictionary v5 API Reference](https://styledictionary.com/reference/api/) - Async API, constructor, buildAllPlatforms
- [Style Dictionary v5 Migration Guide](https://styledictionary.com/versions/v5/migration/) - Breaking changes, v4→v5 patterns
- [Style Dictionary Built-in Formats](https://styledictionary.com/reference/hooks/formats/predefined/) - css/variables format options
- [Style Dictionary Built-in Transforms](https://styledictionary.com/reference/hooks/transforms/predefined/) - css transform group
- [Node.js fs module](https://nodejs.org/api/fs.html) - readFileSync, mkdirSync
- Local: `/node_modules/style-dictionary/examples/advanced/variables-in-outputs/sd.config.js` - v5 API patterns
- Local: `src/tokens/manifest.json` - Collection/mode structure

### Secondary (MEDIUM confidence)
- [Reading JSON Files in Node.js](https://heynode.com/tutorial/readwrite-json-files-nodejs/) - JSON.parse patterns
- [Style Dictionary Reference Resolution](https://styledictionary.com/reference/utils/references/) - How {token} refs work
- WebSearch: "Style Dictionary v5 getting started configuration" - Basic setup patterns

### Tertiary (LOW confidence)
- None - Phase 1 uses well-documented stable patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Versions verified in package.json, v5 API documented
- Architecture: HIGH - Manifest parsing standard, v5 API examples verified
- Pitfalls: HIGH - Common v5 migration issues well-documented, async patterns clear

**Research date:** 2026-02-14
**Valid until:** 90 days (stable technology, slow-moving API)
