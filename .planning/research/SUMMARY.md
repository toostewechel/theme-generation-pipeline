# Project Research Summary

**Project:** Design Token Build Pipeline
**Domain:** Design token transformation (DTCG to CSS)
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a design token transformation pipeline that converts DTCG-format design tokens into platform-specific CSS outputs using Style Dictionary v5 and style-dictionary-utils. The recommended approach leverages the industry-standard Style Dictionary v5 ecosystem with pre-built DTCG transforms to handle multi-mode theming (light/dark colors, radius variants) through data-attribute selectors in a single combined CSS file.

The core technical challenge is managing multi-mode tokens where the same semantic token (e.g., `color-background-surface-default`) has different values per mode while maintaining proper CSS selector specificity and reference resolution across collections. The architecture requires multiple isolated Style Dictionary instances (one per collection+mode), with post-processing to merge partial outputs into a single CSS file with correctly scoped selectors.

Key risks center on Style Dictionary v5's async-first architecture requiring careful await usage, DTCG color object transformation requiring style-dictionary-utils configuration, and CSS selector specificity management for multi-mode output. These risks are mitigated through proper async patterns, explicit DTCG transform registration, and documented selector ordering (`:root` defaults first, then `[data-*]` overrides).

## Key Findings

### Recommended Stack

The project requires Style Dictionary v5 (industry standard for token pipelines) with style-dictionary-utils v6 for DTCG-specific transforms. Style Dictionary v5 introduces async/ESM architecture and native DTCG support, while style-dictionary-utils provides critical transforms for sRGB color objects, typography composites, and dimension values. Node.js 22+ is required for Style Dictionary v5's modern ESM features.

**Core technologies:**
- **Style Dictionary 5.2.0**: Core transformation engine — async/ESM architecture, transitive transforms, DTCG format support with massive ecosystem
- **style-dictionary-utils 6.0.1**: DTCG transforms — handles sRGB color objects, typography composites, `css/advanced` format for multi-mode output with data-attribute selectors
- **tsx 4.x**: TypeScript execution — zero-config runner for build scripts, no compilation step needed
- **Node.js 22+**: Runtime environment — required by Style Dictionary v5 for native fetch and modern ESM features

**Critical version dependencies:**
- style-dictionary-utils v6 requires Style Dictionary v5 (peer dependency)
- Style Dictionary v5.2.0 requires Node.js >=22.0.0 (hard requirement)
- Project already configured as ESM (`"type": "module"` in package.json)

### Expected Features

**Must have (table stakes):**
- CSS Custom Property Output — industry standard format with `:root` and `[data-*]` selectors
- Token Reference Resolution — handles `{token-name}` syntax with transitive resolution
- Multi-Mode/Theme Support — light/dark colors, radius variants with data-attribute scoping
- Color Format Conversion — sRGB component arrays to CSS rgb() or hex
- Dimension Unit Conversion — px to rem with intelligent unitless exceptions (opacity, font-weight)
- Single Combined CSS File — simpler consumption, one import, better caching
- Typography Composite Expansion — both shorthand AND individual properties for flexibility
- Token Naming Transformation — kebab-case for valid CSS variable names

**Should have (competitive):**
- Data-Attribute Mode Selectors — `[data-color-mode="dark"]` more explicit than classes
- Semantic-Only Output Option — filter primitives to reduce bundle size (post-MVP)
- Intelligent Unitless Handling — font-weights, line-heights, opacity stay unitless per CSS spec
- Manifest-Driven Build — manifest.json defines collections/modes, reduces config complexity

**Defer (v2+):**
- TypeScript Type Definitions — generate .d.ts for token names (different output format)
- Token Documentation — human-readable docs (separate concern from build)
- Color Space Optimization — oklch output for modern browsers (wait for >90% support)
- JSON/JS Output — JavaScript object formats (CSS is primary target)

### Architecture Approach

The architecture uses multiple isolated Style Dictionary instances (one per collection+mode combination) to avoid token name collisions, with each instance configured with appropriate source files and primitive includes for reference resolution. Outputs are written to temporary files, then post-processed to wrap in correct selectors and merge into a single CSS file. This pattern allows clean separation of modes while producing atomic theme-switching output.

**Major components:**
1. **Build Orchestrator** — reads manifest.json, loops collections/modes, instantiates SD instances, merges outputs
2. **SD Instance (per collection+mode)** — transforms tokens for one mode, resolves references within scope
3. **Transform Pipeline** — applies DTCG transforms (color/css, dimension/css, typography/css, name/kebab)
4. **Reference Resolver** — resolves `{token-name}` references across source+include files (built-in SD v5)
5. **Output Combiner** — wraps partial CSS in selectors (`:root`, `[data-color-mode="dark"]`), merges into single file

**Key architectural decisions:**
- **Source vs Include pattern**: Use `source` for mode-specific tokens, `include` for primitives needed for reference resolution
- **Multiple SD instances**: One per collection+mode to avoid name collisions, enables isolated transforms
- **Post-processing merge**: Write partial CSS, then combine with selectors rather than custom format
- **Selector ordering**: `:root` defaults first, then `[data-*]` overrides to leverage CSS cascade

### Critical Pitfalls

1. **Async Configuration Not Awaited** — Style Dictionary v5 is async-first; missing `await` on API calls produces empty or partial output with no errors. Fix: wrap all SD calls in async functions, verify output files exist.

2. **DTCG sRGB Color Objects Not Transformed** — primitive colors use `{colorSpace: "srgb", components: [r, g, b]}` format that SD v5 doesn't parse natively. Without style-dictionary-utils DTCG transforms, output is `rgb([object Object])`. Fix: configure DTCG preprocessor and color/css transform from SD-utils.

3. **Multi-Mode Output Overwrites Previous Modes** — building each mode as separate platform with same destination causes last mode to overwrite. Fix: build to temp files with unique names, merge with post-processing.

4. **Dimension px-to-rem Conversion Breaks Unitless** — generic transforms convert `{value: 0.5, unit: "px", $description: "unitless"}` to `0.03125rem` nonsense. Fix: conditional transform checking `$description` field or token path for unitless tokens.

5. **CSS Selector Specificity Wars** — `:root` and `[data-color-mode="dark"]` have equal specificity (0,1,0); browser uses source order as tiebreaker. If `:root` comes after `[data-*]`, default wins over themed mode. Fix: declare `:root` first, `[data-*]` after.

## Implications for Roadmap

Based on research, suggested phase structure addresses dependency order, critical pitfalls, and feature complexity:

### Phase 1: Build Script Foundation & Basic CSS Output
**Rationale:** Must establish async configuration, token loading, and reference resolution before any feature work. All other phases depend on working build pipeline.

**Delivers:** Working build script that processes manifest.json, creates SD instances, outputs CSS to dist/css/ with resolved references

**Addresses:**
- Token Reference Resolution (table stakes)
- Token Naming Transformation (table stakes)
- File Output to dist/ (table stakes)
- Basic Error Handling (table stakes)

**Avoids:**
- Pitfall #1: Async not awaited (build verification)
- Pitfall #2: Token references unresolved (source/include pattern)
- Pitfall #7: ESM/CommonJS conflicts (module system validation)
- Pitfall #10: Cross-collection references fail (global token loading)

**Critical path items:**
- Configure Style Dictionary v5 async API correctly
- Parse manifest.json to determine collections/modes
- Load all tokens (source + include) for reference resolution
- Verify output files exist with expected content
- Test reference resolution across collections

### Phase 2: Multi-Mode CSS Output with Data-Attribute Selectors
**Rationale:** Multi-mode support is a must-have feature requiring architectural complexity (multiple SD instances, selector scoping). Build on Phase 1's foundation.

**Delivers:** Single combined CSS file with `:root` defaults and `[data-color-mode="dark"]`, `[data-radius-mode="rounded"]` overrides

**Addresses:**
- Multi-Mode/Theme Support (table stakes)
- Data-Attribute Mode Selectors (table stakes)
- Single Combined CSS File (table stakes)

**Avoids:**
- Pitfall #4: Multi-mode overwrites (temp file merge strategy)
- Pitfall #8: Selector specificity wars (`:root` before `[data-*]`)
- Pitfall #9: Token name collisions (verify mutual exclusivity)

**Uses:**
- style-dictionary-utils `css/advanced` format OR custom post-processing
- Manifest-based output mapping (mode → selector)

**Implements:**
- Output Combiner component (merge partials with selectors)
- Selector ordering logic (defaults first, overrides after)

### Phase 3: Color & Dimension Transformations
**Rationale:** DTCG color objects and dimension conversions are table stakes, but Phase 2 can output raw values temporarily. Transform layer builds on working multi-mode output.

**Delivers:** Proper CSS color values (rgb/hex from sRGB objects), rem dimensions, unitless exceptions

**Addresses:**
- Color Format Conversion (table stakes)
- Dimension Unit Conversion (table stakes)
- Intelligent Unitless Handling (differentiator)

**Avoids:**
- Pitfall #3: DTCG colors not transformed (SD-utils configuration)
- Pitfall #5: Dimension px-to-rem breaks unitless (conditional transform)

**Uses:**
- style-dictionary-utils color/css transform
- style-dictionary-utils dimension/css transform
- Custom unitless filter (check `$description` field)

**Implements:**
- Transform Pipeline configuration
- DTCG preprocessor registration
- Unitless token detection logic

### Phase 4: Typography Composite Tokens
**Rationale:** Typography is complex (composite values, optional properties, CSS shorthand syntax) and can be deferred without blocking other features. Builds on transform patterns from Phase 3.

**Delivers:** Typography tokens output both CSS font shorthand AND individual properties

**Addresses:**
- Typography Composite Expansion (table stakes)

**Avoids:**
- Pitfall #6: Typography composites don't generate shorthand (SD-utils typography transform)

**Uses:**
- style-dictionary-utils typography/css transform OR custom property expansion
- fontFamily/css transform for quoted font stacks
- fontWeight/number transform for numeric weights

**Implements:**
- Typography transform configuration OR property-based output strategy

### Phase Ordering Rationale

- **Phase 1 before all**: Must have working build pipeline with reference resolution before any feature work; all phases depend on this foundation
- **Phase 2 before 3**: Multi-mode output requires architectural changes (multiple SD instances, merge strategy); can temporarily output raw values while solving selector scoping
- **Phase 3 before 4**: Color/dimension transforms establish transform pipeline patterns; typography builds on these patterns with more complexity
- **Phase 4 last**: Typography is most complex composite type; can be deferred if needed without blocking colors/dimensions

**Dependency chain:**
```
Phase 1 (foundation)
    → Phase 2 (multi-mode architecture)
        → Phase 3 (value transformations)
            → Phase 4 (complex composites)
```

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3:** DTCG transform configuration — style-dictionary-utils v6 API may have changed from training data; verify exact registration method, preprocessor syntax, and transform options
- **Phase 4:** Typography CSS shorthand format — verify SD-utils handles optional properties (letter-spacing), font-family array serialization, and line-height unitless requirement

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Build script structure — well-documented Style Dictionary v5 patterns from official examples, manifest parsing is standard JSON reading
- **Phase 2:** Multi-mode output — post-processing merge pattern is common, selector ordering is CSS fundamentals

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified from package.json, local node_modules examples inspected, v5 API patterns confirmed |
| Features | MEDIUM-HIGH | Table stakes based on design system patterns, differentiators informed by project constraints, anti-features from common mistakes |
| Architecture | HIGH | Multi-instance pattern verified from SD v5 multi-brand example, source/include documented in README, post-processing is proven pattern |
| Pitfalls | MEDIUM | Common v4→v5 migration issues based on training data, async patterns verified from examples, DTCG transform issues inferred from format differences |

**Overall confidence:** MEDIUM-HIGH

Research leverages verified local package versions and official examples, but unable to cross-reference current online documentation due to tool restrictions. Core patterns are solid; edge cases (DTCG preprocessor syntax, typography transform options) should be validated against style-dictionary-utils v6 docs during implementation.

### Gaps to Address

**API-specific details requiring validation during planning:**
- style-dictionary-utils v6 preprocessor registration syntax — training data shows `preprocessors: ['dtcg']` but actual v6 API may differ
- css/advanced format options for rules/matcher — verify exact API for multi-mode selector configuration
- DTCG color output format options — confirm rgb vs hex vs oklch output control

**Architectural decisions needing concrete specification:**
- Output mapping strategy (mode → selector) — need explicit manifest → selector mapping logic
- Default mode handling — confirm which modes appear in `:root` vs only `[data-*]`
- Primitive token filtering — decide if primitives appear in output or only semantics

**Implementation gaps:**
- Zero-value optimization for dimensions (accept `0rem` bloat or add conditional?)
- Typography output strategy (attempt shorthand or always use individual properties?)
- Build script error handling (silent failures vs explicit validation?)

## Sources

### Primary (HIGH confidence)
- `/node_modules/style-dictionary/package.json` — Version 5.2.0, Node.js >=22 requirement
- `/node_modules/style-dictionary/examples/advanced/variables-in-outputs/sd.config.js` — v5 API patterns (ESM, async, hooks)
- `/node_modules/style-dictionary/examples/advanced/transitive-transforms/sd.config.js` — Transitive transform usage
- `/node_modules/style-dictionary/examples/advanced/multi-brand-multi-platform/` — Multi-instance architecture
- `/node_modules/style-dictionary-utils/package.json` — Version 6.0.1, SD v5 peer dependency
- `/node_modules/style-dictionary-utils/README.md` — Format/transform documentation
- `/node_modules/style-dictionary-utils/dist/transformer/*.d.ts` — TypeScript definitions for transforms
- `/Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/src/tokens/manifest.json` — Collection structure
- `/Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/package.json` — Project dependencies, ESM configuration
- `/Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/CLAUDE.md` — Project requirements

### Secondary (MEDIUM confidence)
- Training data: Style Dictionary v5 API patterns — verified against local examples
- Training data: DTCG format structure — verified against existing token files in src/tokens/
- Training data: css/advanced format capabilities — verified with README and type definitions
- Training data: Design system token architecture patterns — informed feature analysis
- Training data: CSS Custom Properties specification — informed selector strategy

### Tertiary (LOW confidence)
- Training data: `$description` field behavior in SD v5 — stated it's not used for filtering, needs docs verification
- Training data: Platform options for color output format — assumed `colorOutputFormat` based on SD-utils types
- Training data: Complete list of built-in SD v5 transforms — provided common ones, not exhaustive

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
