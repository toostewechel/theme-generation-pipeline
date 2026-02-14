# Pitfalls Research

**Domain:** Style Dictionary v5 Token Build Pipeline
**Researched:** 2026-02-14
**Confidence:** MEDIUM

**Note on Confidence:** Research based on training data knowledge of Style Dictionary v4→v5 migration, DTCG spec, and common token pipeline patterns. Unable to verify against current documentation due to tool access restrictions. Recommend validation against official Style Dictionary v5 and style-dictionary-utils v6 documentation during implementation.

## Critical Pitfalls

### Pitfall 1: Async Configuration Not Awaited

**What goes wrong:**
Style Dictionary v5 switched to async-first architecture. Config files that use `await` but don't export async functions, or build scripts that don't await SD API calls, will silently fail or produce incomplete output. Build appears to succeed but CSS output is empty or partially written.

**Why it happens:**
v4 was synchronous, so migration guides are followed incorrectly. Developers copy v4 examples, miss the async requirement, and TypeScript/ESM don't always error on missing awaits for fire-and-forget promises.

**How to avoid:**
- All Style Dictionary API calls MUST be awaited: `await sd.buildAllPlatforms()`, `await sd.hasInitialized`, etc.
- Export async function from config if using top-level await for dynamic imports
- Use `"type": "module"` in package.json and ensure all SD imports are awaited
- Wrap entire build script in async IIFE or use top-level await with Node 22+

**Warning signs:**
- Build completes instantly (< 100ms) but no output files
- Intermittent output — sometimes works, sometimes empty
- No errors thrown despite missing output
- Debugger shows promises in "pending" state after build exits

**Phase to address:**
Phase 1 (Build Script Foundation) — Build script structure validation and output verification

---

### Pitfall 2: Token Reference Resolution Across Files Fails

**What goes wrong:**
Semantic tokens reference primitives (`{color-neutral-500}`), but if files aren't loaded in dependency order or manifest structure doesn't match SD's expectations, references resolve to undefined. Output CSS has literal `{color-neutral-500}` strings instead of values.

**Why it happens:**
Style Dictionary resolves references in a single pass after all files load. If the load order or file structure doesn't expose all primitives before semantics, or if the manifest `source` pattern excludes primitive files, references can't resolve. The DTCG manifest format may not map directly to SD's `source` patterns.

**How to avoid:**
- Ensure SD config `source` array includes ALL token files (primitives AND semantics)
- Load primitives before semantics: `source: ['src/tokens/primitives-*.json', 'src/tokens/*.json']`
- Verify manifest parser loads all collections and modes into SD's token tree
- Use SD's `parsers` option correctly for manifest.json structure
- Test with `sd.exportPlatform()` to inspect resolved token tree before transforms

**Warning signs:**
- CSS output contains literal `{token-name}` instead of values
- Build warnings about "unresolved references" (if SD logs them)
- Color variables show `{color-neutral-500}` in browser DevTools
- Some references work, others don't (inconsistent file loading)

**Phase to address:**
Phase 1 (Build Script Foundation) — Manifest parsing and token loading validation

---

### Pitfall 3: DTCG sRGB Color Objects Not Transformed to CSS

**What goes wrong:**
Primitive color tokens use DTCG format `{ colorSpace: "srgb", components: [r, g, b], alpha? }` but Style Dictionary doesn't natively understand this format in v5. Without correct transform, CSS output is `rgb([object Object])` or the raw object serialized as string.

**Why it happens:**
DTCG spec uses structured color objects, but SD v5 core doesn't have DTCG transforms by default. style-dictionary-utils v6 provides DTCG parsers/transforms, but they must be explicitly registered. If not configured correctly, SD treats color values as generic objects.

**How to avoid:**
- Use style-dictionary-utils `dtcg` preprocessor: `preprocessors: ['dtcg']`
- Register DTCG-aware transforms from style-dictionary-utils
- Verify transforms run in correct order: DTCG parse → color convert → CSS format
- Test output with actual sRGB object to ensure transform to `rgb(255, 255, 255)` or hex
- Check style-dictionary-utils v6 API for correct registration method (may differ from v5)

**Warning signs:**
- CSS contains `rgb([object Object])` or `{"colorSpace":"srgb",...}`
- Colors don't render in browser (invalid CSS)
- DevTools show malformed color values
- Hex conversion fails for alpha colors

**Phase to address:**
Phase 1 (Build Script Foundation) — Transform pipeline configuration and DTCG compatibility

---

### Pitfall 4: Multi-Mode Output Overwrites Previous Modes

**What goes wrong:**
When building light/dark color modes or sharp/rounded radius modes, each mode overwrites the previous output file instead of appending with different selectors. Final CSS only has the last mode processed (e.g., only dark mode colors).

**Why it happens:**
Style Dictionary builds each platform/configuration independently. If each mode is a separate platform with same output destination, latter builds overwrite. Without proper file append strategy or selector scoping, single-file output loses earlier modes.

**How to avoid:**
- Use single SD build with conditional formatting, NOT separate builds per mode
- Leverage SD's `files` array with different selectors per file, then concatenate
- OR use style-dictionary-utils' multi-mode formatting if available
- Build to temporary files, then combine with post-processing
- Ensure each mode wraps output in unique selector: `:root` for default, `[data-color-mode='dark']` for dark
- Use SD's `options` in format config to pass selector context

**Warning signs:**
- Only last processed mode appears in final CSS
- Running build twice produces different output (race condition)
- CSS file size doesn't grow when adding modes
- Only `:root` selectors, no `[data-*]` attribute selectors

**Phase to address:**
Phase 2 (Multi-Mode CSS Output) — Mode-specific selector generation and file combination strategy

---

### Pitfall 5: Dimension px-to-rem Conversion Breaks 0px and Unitless

**What goes wrong:**
Transform converts `{ value: 0, unit: "px" }` to `0rem` (unnecessary unit), or converts `$description: "unitless"` tokens that should stay as raw numbers (`0.5` for opacity) into `0.031rem` or similar nonsense values.

**Why it happens:**
Generic px-to-rem transforms divide value by base font size (16) without checking for zero or inspecting `$description` metadata. DTCG dimension objects `{ value, unit }` need unwrapping before conversion, and exceptions need explicit filtering.

**How to avoid:**
- Use transform with zero check: `value === 0 ? '0' : value / 16 + 'rem'`
- Filter tokens by `$description: "unitless"` BEFORE px-to-rem transform
- Create conditional transform: if unitless, output raw number; else convert to rem
- Verify negative values preserve sign: `-4px` → `-0.25rem`
- Test fractional values: `1.5px` → `0.09375rem` (precision matters)

**Warning signs:**
- Opacity/alpha tokens show as `0.03125rem` instead of `0.5`
- Zero dimensions show as `0rem` instead of `0` (bloated output)
- Negative margins broken in output CSS
- Letter-spacing values wrong (often use px but need em/rem conversion logic)

**Phase to address:**
Phase 1 (Build Script Foundation) — Transform configuration and dimension handling

---

### Pitfall 6: Typography Composite Tokens Don't Generate CSS Shorthand

**What goes wrong:**
Typography tokens with `$type: "typography"` and composite values (family, weight, size, line-height, letter-spacing) output as object literals instead of CSS `font` shorthand. CSS shows `font: [object Object]` or individual properties aren't combined.

**Why it happens:**
DTCG composite typography format differs from CSS shorthand order and syntax. SD core doesn't have DTCG typography transform. style-dictionary-utils may provide one, but it needs correct registration and the format must match expectations (property order, optional values, etc.).

**How to avoid:**
- Use style-dictionary-utils typography transform if available
- OR output individual properties as separate CSS vars instead of shorthand
- Verify transform outputs valid CSS: `font: 600 1rem/1.5 "Inter", sans-serif`
- Test with optional properties missing (not all tokens have letter-spacing)
- Ensure font-family arrays serialize correctly: `["Inter", "system-ui"]` → `"Inter", system-ui`

**Warning signs:**
- CSS `font` property shows object literal
- Typography tokens only output individual properties, no shorthand
- Font shorthand order wrong (causes browser to ignore)
- Missing quotes around font family names with spaces

**Phase to address:**
Phase 3 (Typography Tokens) — Typography transform configuration or property-based approach

---

### Pitfall 7: ESM vs CommonJS Module Conflicts

**What goes wrong:**
Style Dictionary v5 and style-dictionary-utils are ESM-only. Mixing CommonJS (`require`, `module.exports`) with ESM (`import`, `export`) in config files or build scripts causes `ERR_REQUIRE_ESM` or `Cannot use import statement outside a module`.

**Why it happens:**
v4 supported CommonJS. Migration guides show both formats. Without `"type": "module"` in package.json or `.mjs` extensions, Node defaults to CommonJS, then ESM imports fail.

**How to avoid:**
- Set `"type": "module"` in package.json (ALREADY DONE in this project)
- Use `.mjs` extension for config if package.json can't be modified
- ALL imports must be ESM: `import StyleDictionary from 'style-dictionary'`
- NO CommonJS syntax: avoid `require()`, `module.exports`, `__dirname`
- Use `import.meta.url` instead of `__dirname` for path resolution
- Ensure all custom transforms/formats use ESM syntax

**Warning signs:**
- `Error [ERR_REQUIRE_ESM]: require() of ES Module not supported`
- `SyntaxError: Cannot use import statement outside a module`
- Build script runs in Node but config file fails to load
- Mixing `.js` and `.mjs` extensions causing inconsistent behavior

**Phase to address:**
Phase 1 (Build Script Foundation) — Module system configuration validation

---

### Pitfall 8: CSS Selector Specificity Wars with data-attributes

**What goes wrong:**
Default mode in `:root` and themed mode in `[data-color-mode='dark']` have same specificity when both apply. Browser picks last-declared rule, not the more specific one. Dark mode doesn't override default even when data-attribute is set.

**Why it happens:**
`:root` and `[data-color-mode='dark']` both have specificity (0,1,0). CSS cascade uses source order as tiebreaker. If `:root` comes after `[data-*]` in output, it wins. Developers expect attribute selector to be more specific, but it isn't.

**How to avoid:**
- Declare `:root` defaults FIRST in CSS output, THEN `[data-*]` overrides
- OR use higher specificity for overrides: `:root[data-color-mode='dark']` (0,2,0)
- OR wrap default in lower-specificity selector: `html` (0,0,1) vs `[data-*]` (0,1,0)
- Test in browser DevTools with attribute toggling to verify cascade
- Document selector ordering in CLAUDE.md for future maintenance

**Warning signs:**
- Setting `data-color-mode='dark'` doesn't change theme
- Some tokens override, others don't (inconsistent specificity)
- DevTools show dark mode styles crossed out, `:root` styles winning
- Theme switching only works if `:root` styles removed from HTML

**Phase to address:**
Phase 2 (Multi-Mode CSS Output) — Selector ordering and specificity validation

---

### Pitfall 9: Token Name Collisions Between Modes in Single File

**What goes wrong:**
Light mode defines `--color-background-surface-default: white` and dark mode defines same variable name with different value. When both output to single CSS file with different selectors, variable name collision causes overwrites or unexpected inheritance.

**Why it happens:**
CSS variables with same name in different selectors share namespace. If not scoped correctly or if inheritance isn't considered, child elements may inherit from wrong mode. This is usually desired behavior, but can break if modes aren't mutually exclusive.

**How to avoid:**
- This is EXPECTED behavior for theming — same variable name, different values per mode
- ENSURE selectors are mutually exclusive: don't set multiple `data-color-mode` values simultaneously
- Test variable resolution in nested contexts: `[data-color-mode='light'] [data-color-mode='dark']` edge cases
- Document that data-attributes should be set on root element (`<html>` or `<body>`)
- Verify no unintended cascade: light mode vars shouldn't leak into dark mode scope

**Warning signs:**
- Mixed theme colors rendering (some light, some dark in same view)
- Variables not updating when data-attribute changes
- Unexpected values in DevTools computed styles
- Theme flashing or wrong colors on initial render

**Phase to address:**
Phase 2 (Multi-Mode CSS Output) — Variable scoping and inheritance testing

---

### Pitfall 10: Build Order Dependencies When Tokens Reference Across Collections

**What goes wrong:**
Semantic color tokens reference primitive color tokens, which works fine. But if radius tokens reference color tokens (e.g., focus ring), or typography references dimension tokens, and collections are built in isolated passes, cross-collection references fail.

**Why it happens:**
If manifest parser builds each collection independently and references cross collection boundaries, SD can't resolve them unless all tokens are in single global dictionary during resolution phase.

**How to avoid:**
- Load ALL token files into single SD instance before building
- Don't create separate SD instances per collection
- Ensure manifest parser adds all collections/modes to same token tree
- Verify cross-collection references work: `{font-size-400}` from typography collection resolves primitive
- Use SD's `tokens` option to pre-merge all sources

**Warning signs:**
- Some token references work, others fail (collection-dependent)
- Rebuild order changes output (non-deterministic)
- References within same collection work, cross-collection fail
- Build errors about "cannot resolve reference to [token-name]"

**Phase to address:**
Phase 1 (Build Script Foundation) — Manifest parsing and global token dictionary construction

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip unitless detection, convert all dimensions to rem | Simpler transform logic (5 lines vs 15) | Opacity/alpha tokens broken, CSS invalid, requires manual fixes in output | Never — opacity is critical |
| Build each mode as separate SD config, manually concatenate files | Easier to reason about (one mode = one config) | Fragile file combination, selector scoping bugs, hard to maintain order | Only if < 3 modes total and static |
| Hardcode color conversion instead of using DTCG transform | No dependency on style-dictionary-utils API changes | Breaks when color format changes, hex/rgb/hsl conversion bugs, alpha handling wrong | Never — DTCG is standard |
| Output primitives and semantics to separate CSS files | Easier debugging (separate concerns) | Consumers must load multiple files (performance hit), correct load order required | Prototyping only, not production |
| Use CommonJS config with dynamic ESM import | Works in mixed codebases | Async import() complexity, top-level await errors, Node version sensitivity | Never — project is ESM |
| Skip zero-value optimization in px-to-rem | Simpler transform (no conditionals) | Bloated CSS (0rem vs 0), minor performance impact | Acceptable if file size not critical |
| Stringify font-family arrays instead of parsing | Avoids complex string formatting | CSS syntax errors if font names have commas/quotes, fails on edge cases | Never — fonts are user-facing |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| style-dictionary-utils v6 | Import SD-utils transforms but forget to register them in config | Use `preprocessors: ['dtcg']` AND register transforms explicitly in `transform` groups |
| DTCG manifest.json | Treat manifest as SD source file (it's metadata, not tokens) | Parse manifest separately, use it to build SD `source` array, don't include in SD sources |
| tsx (TypeScript runner) | Assume TSX compiles to CommonJS by default | TSX respects package.json `"type": "module"`, outputs ESM, no tsconfig needed |
| Node.js v22 | Use `__dirname` for path resolution (not available in ESM) | Use `new URL('.', import.meta.url).pathname` or `fileURLToPath(import.meta.url)` |
| CSS variable output | Forget to sanitize token names for CSS (underscores, spaces, special chars) | Use SD's `name/cti/kebab` transform or ensure token names are valid CSS identifiers |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all mode files into single SD build | Build time linear with # of modes × tokens | Pre-filter tokens by mode before SD processing if modes > 10 | ~1000 tokens, 10+ modes (~10k combinations) |
| Synchronous file I/O in custom transforms | Build hangs or is very slow | Use async transforms, stream file reading | > 500 token files or transforms that read external data |
| Rebuilding entire token set on single token change | Full rebuild on every watch event | Implement incremental build (only rebuild changed collections) | > 2000 tokens, watch mode critical |
| Deep object traversal in reference resolution | Exponential time with nested references | SD handles this internally, avoid deep nesting (< 3 levels) | References nested > 5 levels deep |
| Large CSS output file (uncompressed) | Slow initial page load | Gzip/Brotli compression in production, split primitives from semantics | > 100KB uncompressed CSS |

## Security Mistakes

*Not applicable to this domain — design token build pipeline is build-time only, no runtime security surface. Tokens are static data, not executable code.*

**Build-time risks:**
- Token files from untrusted sources (e.g., design tool plugins) could contain malicious JSON that exploits parsers
- Mitigation: Validate token files against DTCG schema before processing

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No default mode in `:root` | Theme broken until JS sets data-attribute (FOUC) | Emit light mode in `:root` as fallback, dark mode in `[data-color-mode='dark']` |
| Forgetting to emit primitive tokens | Developers can't prototype with base colors | Include primitives in output even if consumers primarily use semantics |
| Missing CSS variable fallbacks | Hard-coded values in consuming code when tokens missing | Document that CSS vars have no fallback (unlike `var(--missing, blue)`) |
| Inconsistent token naming between modes | Different variable names in light vs dark breaks theming | Same semantic token name, different values (e.g., `--color-background-surface-default` in both) |
| No documentation of data-attribute API | Developers don't know how to switch themes | Generate README with data-attribute usage: `<html data-color-mode='dark'>` |

## "Looks Done But Isn't" Checklist

- [ ] **Build script completes without errors:** Often missing — verify output files exist with non-zero size
- [ ] **CSS output has both `:root` and `[data-*]` selectors:** Often missing — check file for multi-mode selectors, not just `:root`
- [ ] **Token references resolved (no literal `{token-name}` in CSS):** Often missing — grep output for `{` to find unresolved refs
- [ ] **Zero values output as `0` not `0rem`:** Often missing — check opacity/border tokens for unit bloat
- [ ] **Unitless dimensions stay unitless:** Often missing — verify `$description: "unitless"` tokens don't have units in output
- [ ] **sRGB color objects converted to rgb()/hex:** Often missing — check color output format, ensure not stringified objects
- [ ] **Typography tokens output valid CSS font shorthand:** Often missing — test in browser, check for `[object Object]`
- [ ] **Negative dimensions preserve sign:** Often missing — verify negative margin tokens like `-4px` → `-0.25rem`
- [ ] **Alpha/transparent colors render correctly:** Often missing — test transparent white/black tokens in browser
- [ ] **Build is deterministic (same input = same output):** Often missing — run build twice, diff outputs, ensure no timestamp/random data

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Async not awaited | LOW | Add `await` to all SD API calls, wrap in async function, verify output |
| Token references unresolved | LOW | Fix `source` glob pattern to include all token files, verify load order |
| DTCG colors not transformed | MEDIUM | Install/configure style-dictionary-utils DTCG preprocessor, test output |
| Multi-mode overwrites | MEDIUM | Refactor to single build with conditional selectors, re-test all modes |
| px-to-rem breaks unitless | LOW | Add conditional transform checking `$description`, filter before conversion |
| Typography not formatted | MEDIUM | Use SD-utils typography transform OR switch to individual property output |
| ESM/CommonJS conflict | LOW | Ensure `"type": "module"` in package.json, convert all requires to imports |
| Selector specificity wrong | LOW | Reorder CSS output (`:root` first, `[data-*]` after), test in browser |
| Token name collisions | LOW | This is expected — verify selectors mutually exclusive, test theme switching |
| Cross-collection references fail | MEDIUM | Refactor to single SD instance loading all collections, verify resolution |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Async not awaited | Phase 1: Build Script Foundation | Output files exist and have expected content |
| Token references unresolved | Phase 1: Build Script Foundation | Grep output for `{`, no literal references remain |
| DTCG colors not transformed | Phase 1: Build Script Foundation | Color tokens output as valid CSS rgb/hex |
| Multi-mode overwrites | Phase 2: Multi-Mode CSS Output | CSS file contains all modes with different selectors |
| px-to-rem breaks unitless | Phase 1: Build Script Foundation | Opacity tokens are raw numbers, not rem units |
| Typography not formatted | Phase 3: Typography Tokens | Font tokens output valid CSS shorthand or properties |
| ESM/CommonJS conflict | Phase 1: Build Script Foundation | Build script executes without module errors |
| Selector specificity wrong | Phase 2: Multi-Mode CSS Output | Theme switching works in test HTML page |
| Token name collisions | Phase 2: Multi-Mode CSS Output | Variable scoping correct, no cross-mode bleed |
| Cross-collection references fail | Phase 1: Build Script Foundation | Typography tokens referencing dimensions resolve |

## Sources

**Style Dictionary v5 Knowledge:**
- Training data knowledge of v4→v5 breaking changes (async API, ESM-only)
- DTCG specification (W3C Community Group format)
- style-dictionary-utils package (community transforms/formats)

**Project-Specific Context:**
- `.planning/codebase/CONCERNS.md` — identified build script missing, token inconsistencies
- `.planning/PROJECT.md` — requirements for multi-mode output, unitless handling
- `src/tokens/*.json` — actual DTCG token structure (sRGB objects, dimension objects, references)
- `package.json` — ESM configuration, Style Dictionary v5.2.0, style-dictionary-utils v6.0.1

**Confidence Note:**
Unable to verify against current Style Dictionary v5.2.0 or style-dictionary-utils v6.0.1 documentation due to tool access restrictions (WebSearch/WebFetch denied). Recommendations based on:
1. Training data knowledge of SD v4→v5 migration (up to Jan 2025)
2. DTCG specification structure
3. Project's actual token file structure
4. Common token pipeline patterns

**Recommended Validation:**
- Cross-reference against official Style Dictionary v5 migration guide
- Verify style-dictionary-utils v6 API for DTCG preprocessor registration
- Check SD v5.2.0 release notes for any breaking changes post-v5.0
- Test against actual SD v5 + SD-utils v6 behavior (some edge cases may differ)

---
*Pitfalls research for: Style Dictionary v5 Token Build Pipeline*
*Researched: 2026-02-14*
