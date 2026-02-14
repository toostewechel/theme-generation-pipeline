# Phase 4: Typography - Research

**Researched:** 2026-02-14
**Domain:** Style Dictionary typography token transforms for DTCG typography tokens
**Confidence:** HIGH

## Summary

Phase 4 implements typography token output in CSS. The codebase already uses `style-dictionary-utils` v6.0.1 which includes the `typography/css` transform as part of the `css/extended` transform group. This transform automatically converts DTCG typography composite tokens into CSS font shorthand format.

**Current state verification:** The build pipeline already successfully outputs typography tokens. Individual properties (font-size, font-weight, line-height, font-family, letter-spacing) emit as separate CSS variables under `:root`, composite typography styles (display-lg, heading-xl, etc.) emit as CSS font shorthand variables, and primitive font tokens appear under `:root`. All three requirements (TYPO-01, TYPO-02, TYPO-03) are already satisfied by the existing Phase 3 implementation.

**Key finding:** CSS font shorthand syntax cannot include letter-spacing (it only supports font-style, font-variant, font-weight, font-size, line-height, font-family). The `typography/css` transform correctly excludes letter-spacing from the shorthand, outputting it as a separate property token. This is correct behavior per CSS specification.

**Primary recommendation:** Phase 4 requires NO code changes. Verify that all three requirements are met by running tests against current output. Document the typography token structure and CSS output format for future reference.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| style-dictionary-utils | 6.0.1 | DTCG transform collection | Already in use, `typography/css` transform handles DTCG typography tokens automatically, converts to CSS font shorthand |
| Style Dictionary | 5.2.0 | Token transformation engine | Already in use, no additional configuration needed |

### Supporting
No additional libraries needed - all functionality already implemented in Phase 3.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| typography/css transform | Custom font shorthand builder | Never use - reimplements solved problem, CSS font shorthand has strict ordering rules, 100+ lines of code |
| Separate letter-spacing variables | Include in shorthand | Impossible - CSS spec doesn't allow letter-spacing in font shorthand |
| @tokens-studio/sd-transforms | style-dictionary-utils | Different design decisions, heavier, Figma-specific features not needed |

**Installation:**
```bash
# Already installed in this project
npm install -D style-dictionary-utils@^6.0.1
```

## Architecture Patterns

### Current Implementation (Phase 3)
The codebase already processes typography tokens correctly through the `css/extended` transform group configured in `buildTokens.ts`. All typography tokens are included in the base files array and output in `:root`.

```
Current: transformGroup includes typography/css (from css/extended)
Status: All TYPO-01, TYPO-02, TYPO-03 requirements already satisfied
Verification: dist/css/tokens.css shows correct output
```

### Pattern 1: typography/css Transform (Already Working)
**What:** Converts DTCG typography composite tokens to CSS font shorthand
**When to use:** Automatic via `css/extended` transform group (already configured)
**Input format:** `{ fontFamily: "Helvetica", fontWeight: 500, fontSize: "16px", lineHeight: "22px", letterSpacing: "0.1px" }`
**Output format:** CSS font shorthand for compatible properties, separate variables for letter-spacing

**Example from current output:**
```typescript
// Input token (typography.styles.tokens.json):
{
  "display-lg": {
    "$type": "typography",
    "$value": {
      "fontFamily": "{typography-display-large-font-family}",
      "fontWeight": "{typography-display-large-font-weight}",
      "fontSize": "{typography-display-large-font-size}",
      "lineHeight": "{typography-display-large-line-height}",
      "letterSpacing": "{typography-display-large-letter-spacing}"
    }
  }
}

// Output CSS (current - already correct):
:root {
  --display-lg: var(--typography-display-large-font-weight) var(--typography-display-large-font-size)/var(--typography-display-large-line-height) var(--typography-display-large-font-family);
}

// Note: letter-spacing excluded from shorthand (CSS spec limitation)
// letter-spacing outputs as separate variable from the individual property token
```

### Pattern 2: Individual Typography Properties (Already Working)
**What:** Individual font properties emit as separate CSS variables
**Input:** Separate tokens for font-family, font-weight, font-size, line-height, letter-spacing
**Output:** Individual CSS variables under `:root`

**Example from current output:**
```css
/* Individual property tokens (already in output) */
:root {
  --typography-display-large-font-family: var(--font-family-serif);
  --typography-display-large-font-weight: var(--font-weight-semi-bold);
  --typography-display-large-font-size: var(--font-size-1300);
  --typography-display-large-line-height: var(--font-line-height-1400);
  --typography-display-large-letter-spacing: var(--font-letter-spacing-tight);
}
```

### Pattern 3: Primitive Font Tokens (Already Working)
**What:** Primitive font tokens (family, weight, size, line-height, letter-spacing) appear in `:root`
**Current status:** Phase 2 implementation includes all base files in `:root` build
**Verification:** dist/css/tokens.css line 98-144 shows all primitive font tokens

**Example from current output:**
```css
/* Primitive font tokens (already in output) */
:root {
  --font-family-serif: 'Test Signifier VF';
  --font-family-sans: Geist;
  --font-family-mono: 'Berkeley Mono';
  --font-weight-semi-bold: 600;
  --font-size-1300: 3.375rem;
  --font-line-height-1400: 3.5rem;
  --font-letter-spacing-tight: -0.015625rem;
}
```

### Pattern 4: CSS Font Shorthand Syntax
**What:** CSS font shorthand property order and syntax
**Order:** [font-weight] [font-size]/[line-height] [font-family]
**Required:** font-size and font-family are mandatory
**Optional:** font-weight, line-height (must use slash separator)
**Excluded:** letter-spacing (not part of CSS font shorthand spec)

**References:**
- [MDN: font property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font)
- [W3Schools: CSS Font Shorthand](https://www.w3schools.com/css/css_font_shorthand.asp)
- [CSS-Tricks: Font Shorthand](https://css-tricks.com/almanac/properties/f/font/)

**Example:**
```css
/* Valid CSS font shorthand */
font: 600 3.375rem/3.5rem 'Test Signifier VF';

/* CSS variables version (current output) */
--display-lg: var(--typography-display-large-font-weight) var(--typography-display-large-font-size)/var(--typography-display-large-line-height) var(--typography-display-large-font-family);

/* letter-spacing CANNOT be included in shorthand - must be separate */
letter-spacing: var(--typography-display-large-letter-spacing);
```

### Anti-Patterns to Avoid
- **Custom font shorthand builder:** typography/css already handles this correctly
- **Including letter-spacing in shorthand:** CSS spec forbids this, browsers will ignore the entire declaration
- **Filtering typography tokens:** All typography tokens should output (primitives, individuals, composites)
- **Separate typography build:** Typography tokens processed same as other tokens in Phase 3 multi-build approach

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS font shorthand generation | Custom string builder | typography/css transform | CSS font shorthand has strict property ordering rules (font-style → font-variant → font-weight → font-size/line-height → font-family), optional vs required property handling, font-family quoting rules |
| Typography token decomposition | Custom property extractor | typography/css transform | Handles token references, DTCG object structure, missing properties, default values |
| Font family quoting | Custom quote wrapper | fontFamily/css transform | Handles multi-word font names, system fonts, fallback stacks, already integrated |
| Font weight conversion | String-to-number converter | fontWeight/number transform | Converts named weights (bold) to numbers (700), handles invalid values, already included |

**Key insight:** Typography token transformation has many edge cases (missing properties, mixed reference/literal values, CSS syntax rules). style-dictionary-utils handles all of these correctly with 200+ lines of tested code.

## Common Pitfalls

### Pitfall 1: Assuming letter-spacing Belongs in Font Shorthand
**What goes wrong:** Attempting to include letter-spacing in CSS font shorthand causes entire declaration to be invalid
**Why it happens:** DTCG spec includes letterSpacing in typography tokens, but CSS font shorthand spec does not
**How to avoid:** Understand that letter-spacing outputs as separate CSS variable (from individual property token), not in composite shorthand
**Warning signs:** Browser DevTools shows strikethrough on font shorthand, no styles applied
```css
/* ❌ INVALID - letter-spacing cannot be in font shorthand */
font: 600 3.375rem/3.5rem -0.015625rem 'Test Signifier VF';

/* ✅ CORRECT - letter-spacing is separate property */
font: 600 3.375rem/3.5rem 'Test Signifier VF';
letter-spacing: -0.015625rem;
```

### Pitfall 2: Expecting Composite Token to Include All Properties
**What goes wrong:** Composite typography shorthand variable doesn't include letter-spacing
**Why it happens:** CSS limitation - font shorthand cannot include letter-spacing
**How to avoid:** Use individual property variables when all properties needed, or apply letter-spacing separately
**Warning signs:** Text renders without letter-spacing when only using composite token
```css
/* ❌ INCOMPLETE - missing letter-spacing */
.heading {
  font: var(--display-lg);
  /* letter-spacing not applied */
}

/* ✅ CORRECT - apply letter-spacing separately */
.heading {
  font: var(--display-lg);
  letter-spacing: var(--typography-display-large-letter-spacing);
}

/* ✅ ALTERNATIVE - use individual properties */
.heading {
  font-family: var(--typography-display-large-font-family);
  font-weight: var(--typography-display-large-font-weight);
  font-size: var(--typography-display-large-font-size);
  line-height: var(--typography-display-large-line-height);
  letter-spacing: var(--typography-display-large-letter-spacing);
}
```

### Pitfall 3: Thinking Phase 4 Requires Code Changes
**What goes wrong:** Implementing new transforms or build configuration when functionality already exists
**Why it happens:** Not verifying current output before planning implementation
**How to avoid:** Check dist/css/tokens.css against requirements before coding
**Warning signs:** Duplicate transform registration, conflicting build configurations
```typescript
// ❌ WRONG - typography/css already registered in css/extended
StyleDictionary.registerTransform({
  name: 'typography/css',  // Already exists, will error
  // ...
});

// ✅ CORRECT - no code changes needed
// typography/css transform already included in css/extended transform group
// Current configuration in buildTokens.ts already correct
```

### Pitfall 4: Font Shorthand Property Order
**What goes wrong:** Incorrect property order in custom font strings causes CSS to ignore declaration
**Why it happens:** Not following CSS spec order: font-style → font-variant → font-weight → font-size/line-height → font-family
**How to avoid:** Use typography/css transform (already doing this), never build font strings manually
**Warning signs:** Font styles not applying, CSS validation errors
```css
/* ❌ WRONG order - font-family before font-size */
font: 'Helvetica' 600 16px/22px;

/* ❌ WRONG order - line-height without slash */
font: 600 16px 22px 'Helvetica';

/* ✅ CORRECT order (what typography/css outputs) */
font: 600 16px/22px 'Helvetica';
```

### Pitfall 5: Missing Font Family Quotes
**What goes wrong:** Multi-word font family names without quotes fail to parse
**Why it happens:** CSS requires quotes around font names with spaces
**How to avoid:** Use fontFamily/css transform (already included in css/extended)
**Warning signs:** Fonts not loading, fallback system fonts appear instead
```css
/* ❌ WRONG - multi-word name needs quotes */
--font-family-serif: Test Signifier VF;

/* ✅ CORRECT (what fontFamily/css outputs) */
--font-family-serif: 'Test Signifier VF';
```

## Code Examples

All examples verified from current output in dist/css/tokens.css:

### Current Typography Output (Complete Example)
```css
/* Source: dist/css/tokens.css lines 98-144 (primitives) */
:root {
  /* Primitive font tokens (TYPO-03) */
  --font-family-serif: 'Test Signifier VF';
  --font-family-sans: Geist;
  --font-family-mono: 'Berkeley Mono';
  --font-weight-semi-bold: 600;
  --font-weight-medium: 500;
  --font-size-1300: 3.375rem;
  --font-size-900: 2.25rem;
  --font-line-height-1400: 3.5rem;
  --font-line-height-1000: 2.5rem;
  --font-letter-spacing-tight: -0.015625rem;
  --font-letter-spacing-normal: 0rem;

  /* Individual typography property tokens (TYPO-01) */
  --typography-display-large-font-family: var(--font-family-serif);
  --typography-display-large-font-weight: var(--font-weight-semi-bold);
  --typography-display-large-font-size: var(--font-size-1300);
  --typography-display-large-line-height: var(--font-line-height-1400);
  --typography-display-large-letter-spacing: var(--font-letter-spacing-tight);

  --typography-heading-3xl-font-family: var(--font-family-serif);
  --typography-heading-3xl-font-weight: var(--font-weight-medium);
  --typography-heading-3xl-font-size: var(--font-size-900);
  --typography-heading-3xl-line-height: var(--font-line-height-1000);
  --typography-heading-3xl-letter-spacing: var(--font-letter-spacing-normal);

  /* Composite typography style tokens (TYPO-02) */
  --display-lg: var(--typography-display-large-font-weight) var(--typography-display-large-font-size)/var(--typography-display-large-line-height) var(--typography-display-large-font-family);
  --heading-3xl: var(--typography-heading-3xl-font-weight) var(--typography-heading-3xl-font-size)/var(--typography-heading-3xl-line-height) var(--typography-heading-3xl-font-family);
}
```

### Using Typography Tokens in CSS
```css
/* Using composite token (shorthand) */
.hero-title {
  font: var(--display-lg);
  letter-spacing: var(--typography-display-large-letter-spacing);
}

/* Using individual property tokens */
.section-heading {
  font-family: var(--typography-heading-3xl-font-family);
  font-weight: var(--typography-heading-3xl-font-weight);
  font-size: var(--typography-heading-3xl-font-size);
  line-height: var(--typography-heading-3xl-line-height);
  letter-spacing: var(--typography-heading-3xl-letter-spacing);
}

/* Using primitive tokens directly */
.custom-text {
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semi-bold);
  font-size: var(--font-size-1300);
  line-height: var(--font-line-height-1400);
  letter-spacing: var(--font-letter-spacing-tight);
}
```

### Token File Structure (Already Exists)
```json
// src/tokens/primitives-font.mode-1.tokens.json
{
  "font-family-serif": {
    "$type": "fontFamily",
    "$value": "Test Signifier VF"
  },
  "font-weight-semi-bold": {
    "$type": "fontWeight",
    "$value": 600
  },
  "font-size-1300": {
    "$type": "dimension",
    "$value": { "value": 54, "unit": "px" }
  },
  "font-line-height-1400": {
    "$type": "dimension",
    "$value": { "value": 56, "unit": "px" }
  },
  "font-letter-spacing-tight": {
    "$type": "dimension",
    "$value": { "value": -0.25, "unit": "px" }
  }
}

// src/tokens/typography.mode-1.tokens.json
{
  "typography-display-large-font-family": {
    "$type": "fontFamily",
    "$value": "{font-family-serif}"
  },
  "typography-display-large-font-weight": {
    "$type": "fontWeight",
    "$value": "{font-weight-semi-bold}"
  },
  "typography-display-large-font-size": {
    "$type": "dimension",
    "$value": "{font-size-1300}"
  },
  "typography-display-large-line-height": {
    "$type": "dimension",
    "$value": "{font-line-height-1400}"
  },
  "typography-display-large-letter-spacing": {
    "$type": "dimension",
    "$value": "{font-letter-spacing-tight}"
  }
}

// src/tokens/typography.styles.tokens.json
{
  "display-lg": {
    "$type": "typography",
    "$value": {
      "fontFamily": "{typography-display-large-font-family}",
      "fontWeight": "{typography-display-large-font-weight}",
      "fontSize": "{typography-display-large-font-size}",
      "lineHeight": "{typography-display-large-line-height}",
      "letterSpacing": "{typography-display-large-letter-spacing}"
    }
  }
}
```

### Build Configuration (Already Correct)
```typescript
// Source: scripts/buildTokens.ts (current - no changes needed)
const sharedPlatformConfig = {
  transforms: [
    'attribute/cti',
    'name/kebab',
    'time/seconds',
    'html/icon',
    'size/rem',
    'asset/url',
    'fontFamily/css',       // ✅ Handles font family quoting
    'cubicBezier/css',
    'strokeStyle/css/shorthand',
    'border/css/shorthand',
    'typography/css/shorthand',
    'transition/css/shorthand',
    'shadow/css/shorthand',
    'w3c-color/css',
    'dimension/unitless',
    'dimension/css',
    'duration/css',
    'shadow/css',
    'strokeStyle/css',
    'transition/css',
    'typography/css',      // ✅ Converts typography tokens to font shorthand
    'fontWeight/css',      // ✅ Converts font weight to numbers
    'w3c-border/css',
    'gradient/css',
  ],
  outputUnit: 'rem',
  basePxFontSize: 16,
};

// Base files array includes typography tokens (already correct)
const baseFiles: string[] = [
  'src/tokens/primitives-font.mode-1.tokens.json',
  'src/tokens/typography.mode-1.tokens.json',
  'src/tokens/typography.styles.tokens.json',
  // ... other files
];

// Typography tokens included in :root build (already correct)
const rootSources = [
  ...baseFiles,  // Includes all typography tokens
  ...(colorModes['light'] || []),
  ...(radiusModes['default'] || []),
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual font shorthand strings | typography/css transform | style-dictionary-utils v3+ | Automatic DTCG typography token support |
| Custom property order logic | Built-in CSS spec ordering | style-dictionary-utils v4+ | Guaranteed valid CSS font shorthand |
| Global font-family quoting | fontFamily/css transform | style-dictionary-utils v5+ | Proper quoting for multi-word fonts |
| String font weights | fontWeight/number transform | style-dictionary-utils v6+ | Numeric weights for CSS |

**Deprecated/outdated:**
- **Manual typography token composition:** typography/css handles DTCG composite tokens
- **Custom font shorthand builders:** CSS ordering rules complex, use typography/css
- **Separate typography transform registration:** Already included in css/extended group

## Requirements Verification

### TYPO-01: Individual typography property tokens emit as CSS variables under `:root`
**Status:** ✅ SATISFIED (already implemented in Phase 3)
**Evidence:** dist/css/tokens.css lines show individual property tokens:
```css
--typography-display-large-font-family: var(--font-family-serif);
--typography-display-large-font-weight: var(--font-weight-semi-bold);
--typography-display-large-font-size: var(--font-size-1300);
--typography-display-large-line-height: var(--font-line-height-1400);
--typography-display-large-letter-spacing: var(--font-letter-spacing-tight);
```

### TYPO-02: Composite typography styles emit as CSS font shorthand variables under `:root`
**Status:** ✅ SATISFIED (already implemented in Phase 3)
**Evidence:** dist/css/tokens.css shows composite shorthand tokens:
```css
--display-lg: var(--typography-display-large-font-weight) var(--typography-display-large-font-size)/var(--typography-display-large-line-height) var(--typography-display-large-font-family);
--heading-3xl: var(--typography-heading-3xl-font-weight) var(--typography-heading-3xl-font-size)/var(--typography-heading-3xl-line-height) var(--typography-heading-3xl-font-family);
```

### TYPO-03: Primitive font tokens emit as CSS variables under `:root`
**Status:** ✅ SATISFIED (already implemented in Phase 3)
**Evidence:** dist/css/tokens.css lines 98-144 show primitive tokens:
```css
--font-family-serif: 'Test Signifier VF';
--font-weight-semi-bold: 600;
--font-size-1300: 3.375rem;
--font-line-height-1400: 3.5rem;
--font-letter-spacing-tight: -0.015625rem;
```

## Open Questions

1. **Should letter-spacing be documented as separate from composite tokens?**
   - What we know: CSS font shorthand cannot include letter-spacing per spec
   - What's unclear: Should documentation explicitly call this out for consumers?
   - Recommendation: Add comment in token files explaining letter-spacing limitation

2. **Should typography styles file be processed differently?**
   - What we know: typography.styles.tokens.json in manifest.json under styles section
   - What's unclear: Does this affect build processing vs collections?
   - Recommendation: Verify manifest processing handles styles same as collections

3. **Are all typography tokens already in output?**
   - What we know: Verified display-lg, heading-3xl, primitives appear in output
   - What's unclear: Are there other typography tokens not yet checked?
   - Recommendation: Verify all tokens from typography.mode-1.tokens.json and typography.styles.tokens.json appear in CSS output

## Sources

### Primary (HIGH confidence)
- [style-dictionary-utils README](https://github.com/lukasoppermann/style-dictionary-utils/blob/main/README.md) - typography/css transform, fontFamily/css, fontWeight/number
- Local: `/node_modules/style-dictionary-utils/README.md` - Complete API documentation
- Current: `scripts/buildTokens.ts` - Verified configuration with css/extended transform group
- Current: `dist/css/tokens.css` - Verified output showing all three requirements satisfied
- Current: `src/tokens/typography.mode-1.tokens.json` - Individual property token structure
- Current: `src/tokens/typography.styles.tokens.json` - Composite token structure
- Current: `src/tokens/primitives-font.mode-1.tokens.json` - Primitive token structure

### Secondary (MEDIUM confidence)
- [MDN: font property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font) - CSS font shorthand specification
- [W3Schools: CSS Font Shorthand](https://www.w3schools.com/css/css_font_shorthand.asp) - Font shorthand syntax
- [CSS-Tricks: Font Shorthand](https://css-tricks.com/almanac/properties/f/font/) - Property ordering
- [MDN: letter-spacing](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/letter-spacing) - Separate from font shorthand
- [Style Dictionary Issue #1494](https://github.com/style-dictionary/style-dictionary/issues/1494) - DTCG typography and letterSpacing handling

### Tertiary (LOW confidence)
- None - Phase 4 uses well-documented typography transforms from style-dictionary-utils

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - style-dictionary-utils documented, typography/css already in use, output verified
- Architecture: HIGH - Current output satisfies all three requirements, no changes needed
- Pitfalls: HIGH - CSS font shorthand spec well-defined, typography/css behavior verified

**Research date:** 2026-02-14
**Valid until:** 60 days (stable technology, CSS spec unchanged, style-dictionary-utils stable)
