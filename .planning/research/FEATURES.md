# Feature Research

**Domain:** Design Token CSS Build Pipeline
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSS Custom Property Output | Industry standard output format for design tokens | LOW | `--token-name: value` syntax in `:root` or scoped selectors |
| Token Reference Resolution | Tokens reference other tokens using `{token-name}` syntax | LOW | Style Dictionary core feature, handles transitive references |
| Multi-Mode/Theme Support | Light/dark modes, theme variants are fundamental to modern design systems | MEDIUM | Requires selector strategy (data-attributes, classes, media queries) |
| Color Format Conversion | DTCG sRGB array format → CSS color functions (oklch, rgb, hsl) | MEDIUM | Need color space conversions, alpha handling, backwards compatibility |
| Dimension Unit Conversion | px to rem for accessibility and responsive design | LOW | Standard 16px base, simple division |
| File Output to dist/ | Build artifacts in predictable location | LOW | Standard convention for compiled assets |
| Token Naming Transformation | Token names → valid CSS variable names (kebab-case) | LOW | Style Dictionary name transforms |
| Basic Error Handling | Token not found, circular references, malformed JSON | LOW | Style Dictionary provides foundation, may need custom validation |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single Combined CSS File | One import vs many, simpler consumption, better caching | MEDIUM | Must merge multiple modes/collections intelligently with selector scoping |
| Typography Composite Expansion | Both shorthand (`font: ...`) AND individual properties (`font-size`, `line-height`) | MEDIUM | Allows consumers to use either shorthand or override individual values |
| Intelligent Unitless Handling | Font-weights, line-heights stay unitless per CSS spec | MEDIUM | Conditional unit conversion based on `$description: "unitless"` metadata |
| Data-Attribute Mode Selectors | `[data-color-mode="dark"]` more explicit than classes | LOW | Better developer experience than `.theme-dark`, clearer intent |
| Semantic-Only Output with Primitive Reference | Output only semantic tokens, primitives inlined via references | MEDIUM | Smaller CSS bundle, clearer API surface, need filtering strategy |
| DTCG Format Native Support | First-class support for DTCG `$type`/`$value` format | LOW | style-dictionary-utils provides this, sets up for ecosystem compatibility |
| Color Space Optimization | Output modern oklch for better gradients/interpolation | HIGH | Requires understanding of browser support, may need fallbacks |
| Manifest-Driven Build | Single manifest.json defines all collections/modes | LOW | Already in place, reduces configuration complexity |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multiple Separate CSS Files Per Mode | Seems more "modular" | Runtime theme switching requires loading new CSS, FOUC, complexity | Single file with scoped selectors, CSS already loaded |
| Automatic CSS Class Generation | "Generate utility classes like Tailwind" | Massive scope creep, not the job of a token pipeline | Let consumers build utilities from tokens, or use actual Tailwind integration |
| Runtime JavaScript Theme Switching | "Build the theme switcher" | Out of scope, implementation-specific | Provide CSS structure, let consumers implement switcher |
| Source Maps for Tokens | "Debug which token a value came from" | CSS doesn't support custom properties source maps, limited value | Use descriptive token names, documentation |
| Watch Mode in Build Script | "Auto-rebuild on token changes" | Should be handled by task runner (npm-watch, nodemon, etc.), not build script | Document using nodemon/watchman, keep build script simple |
| CSS Nesting/Layers | "Use modern CSS features" | Adds complexity, browser support concerns, not necessary for variables | Flat :root and attribute selectors work universally |
| Token Documentation Generation | "Auto-generate docs from tokens" | Different concern (documentation vs build), complex templating | Separate tool/phase if needed |

## Feature Dependencies

```
[CSS Custom Property Output]
    └──requires──> [Token Reference Resolution]
    └──requires──> [Token Naming Transformation]

[Multi-Mode/Theme Support]
    └──requires──> [CSS Custom Property Output]
    └──requires──> [Data-Attribute Mode Selectors]

[Color Format Conversion]
    └──requires──> [Token Reference Resolution]

[Typography Composite Expansion]
    └──requires──> [Token Reference Resolution]
    └──requires──> [Dimension Unit Conversion]

[Single Combined CSS File]
    └──requires──> [Multi-Mode/Theme Support]
    └──requires──> [Data-Attribute Mode Selectors]

[Semantic-Only Output]
    └──requires──> [Token Reference Resolution]
    └──enhances──> [Single Combined CSS File] (smaller output)

[Intelligent Unitless Handling]
    └──enhances──> [Dimension Unit Conversion] (exception handling)
    └──enhances──> [Typography Composite Expansion] (correct font shorthand)
```

### Dependency Notes

- **CSS Custom Property Output requires Token Reference Resolution:** Cannot output final CSS values without resolving `{token-name}` references first
- **Multi-Mode/Theme Support requires Data-Attribute Mode Selectors:** Need selector strategy to scope mode-specific values
- **Single Combined CSS File requires Multi-Mode/Theme Support:** Must handle multiple modes in one file, each scoped appropriately
- **Semantic-Only Output enhances Single Combined CSS File:** Reduces CSS size by omitting primitive tokens, relying on reference resolution
- **Intelligent Unitless Handling enhances Typography Composite Expansion:** Font shorthand requires unitless line-height, correct format critical

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] **Token Reference Resolution** — Core functionality, Style Dictionary provides this
- [ ] **CSS Custom Property Output** — Primary deliverable, essential
- [ ] **Token Naming Transformation** — Must have valid CSS variable names
- [ ] **Multi-Mode/Theme Support** — Light/dark and radius modes are in requirements
- [ ] **Data-Attribute Mode Selectors** — Scoping strategy for modes
- [ ] **Color Format Conversion** — sRGB array → CSS color() or rgb()
- [ ] **Dimension Unit Conversion** — px → rem for spacing/sizing
- [ ] **Intelligent Unitless Handling** — Font-weights and specific dimensions must stay unitless
- [ ] **Single Combined CSS File** — Specified in requirements, simpler consumption
- [ ] **Typography Composite Expansion** — Both shorthand and individual properties for flexibility
- [ ] **File Output to dist/css/** — Expected location per CLAUDE.md

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Semantic-Only Output Option** — Add filter to exclude primitives, reducing bundle size (trigger: CSS size feedback)
- [ ] **Color Space Optimization** — Use oklch for modern browsers (trigger: browser support data shows >90% coverage)
- [ ] **Enhanced Error Messages** — Better diagnostics for token issues (trigger: user confusion in development)
- [ ] **Multiple Output Strategies** — Option for separate files if specific use case emerges (trigger: consumer request with valid use case)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **TypeScript Type Definitions** — Generate .d.ts for token names (why defer: different output format, separate concern)
- [ ] **Token Documentation** — Generate human-readable docs (why defer: documentation is separate from build pipeline)
- [ ] **JSON/JS Output** — Output tokens as JavaScript objects (why defer: CSS is primary target, add when needed)
- [ ] **Custom Selector Strategies** — Support class-based, media-query-based theming (why defer: data-attributes cover requirements)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSS Custom Property Output | HIGH | LOW | P1 |
| Token Reference Resolution | HIGH | LOW | P1 |
| Multi-Mode/Theme Support | HIGH | MEDIUM | P1 |
| Color Format Conversion | HIGH | MEDIUM | P1 |
| Dimension Unit Conversion | HIGH | LOW | P1 |
| Single Combined CSS File | HIGH | MEDIUM | P1 |
| Data-Attribute Mode Selectors | HIGH | LOW | P1 |
| Typography Composite Expansion | HIGH | MEDIUM | P1 |
| Intelligent Unitless Handling | MEDIUM | MEDIUM | P1 |
| Token Naming Transformation | HIGH | LOW | P1 |
| File Output to dist/css/ | HIGH | LOW | P1 |
| Semantic-Only Output Option | MEDIUM | MEDIUM | P2 |
| Color Space Optimization | MEDIUM | HIGH | P2 |
| Enhanced Error Messages | MEDIUM | LOW | P2 |
| TypeScript Type Definitions | LOW | MEDIUM | P3 |
| Token Documentation | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP requirements)
- P2: Should have, add when possible (post-validation enhancements)
- P3: Nice to have, future consideration (v2+ scope)

## Implementation Approach Analysis

### Token Reference Resolution
**Approach:** Leverage Style Dictionary's built-in resolution
**Notes:** Style Dictionary handles transitive references automatically, no custom implementation needed

### CSS Custom Property Output
**Approach:** Use style-dictionary-utils `css/advanced` formatter
**Notes:** Provides CSS custom property output with selector customization

### Multi-Mode/Theme Support
**Approach:** Generate selector-scoped blocks for each mode
**Strategy:**
```css
:root {
  /* default mode values */
}

[data-color-mode="dark"] {
  /* dark mode overrides */
}

[data-radius-mode="rounded"] {
  /* rounded radius overrides */
}
```

### Color Format Conversion
**Approach:** Use style-dictionary-utils color transforms
**Options:**
- `color/css` transform for DTCG → CSS conversion
- Output format: `rgb()` for compatibility, `color(srgb ...)` for accuracy
**Decision:** Start with `rgb()` for maximum compatibility

### Dimension Unit Conversion
**Approach:** Custom transform checking `$description` field
```javascript
// If $description === "unitless", output raw number
// Else if $type === "dimension" and unit === "px", convert to rem (px / 16)
// Else output as-is
```

### Single Combined CSS File
**Approach:** Multiple Style Dictionary platforms merging into one file
**Strategy:**
1. Process each collection/mode separately
2. Use custom formatter to combine outputs
3. Wrap each mode in appropriate selector

### Typography Composite Expansion
**Approach:** Output both formats for each typography token
```css
--typography-display-large: 600 3.5rem/4rem -0.02em "Test Signifier VF";
--typography-display-large-font-weight: 600;
--typography-display-large-font-size: 3.5rem;
--typography-display-large-line-height: 4rem;
--typography-display-large-letter-spacing: -0.02em;
--typography-display-large-font-family: "Test Signifier VF";
```

## Competitor Feature Analysis

| Feature | Manual CSS | Token Studio | Our Approach |
|---------|------------|--------------|--------------|
| Multi-mode support | Manual duplication | Separate files or themes | Single file, data-attribute scoped |
| Typography handling | Manual properties | Individual properties only | Both shorthand AND individual |
| Dimension units | Hardcoded px/rem choice | All or nothing conversion | Smart conversion with unitless exceptions |
| Output structure | Ad-hoc | Multiple files | Single combined file |
| Token filtering | N/A | Manual config | Semantic-only option via filters |
| Color formats | Manual conversion | Single format | sRGB → CSS rgb() with future oklch path |

**Key Differentiators from Manual CSS:**
1. Automatic reference resolution
2. Consistent naming
3. Mode variants without duplication

**Key Differentiators from Token Studio:**
1. Single combined file (simpler consumption)
2. Typography shorthand + individual properties (more flexible)
3. Intelligent unitless handling (follows CSS specs)
4. Data-attribute selectors (clearer than classes)

## Sources

**Knowledge Base:** Training data on Style Dictionary v4-v5, DTCG format specification, CSS Custom Properties specification, design token ecosystem patterns (LOW-MEDIUM confidence due to web access restrictions)

**Project Context:**
- /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/src/tokens/manifest.json
- /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/package.json (style-dictionary v5.2.0, style-dictionary-utils v6.0.1)
- /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline/.planning/codebase/STACK.md
- CLAUDE.md requirements

**Industry Patterns:** CSS Custom Properties best practices, design system token architecture patterns, accessibility requirements (rem for dimensions)

---
*Feature research for: Design Token CSS Build Pipeline*
*Researched: 2026-02-14*
*Confidence: MEDIUM - Based on Style Dictionary ecosystem knowledge and project requirements, without access to current web documentation*
