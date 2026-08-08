/**
 * Shared CSS/SCSS platform config and the custom dimension transforms it depends on.
 *
 * Lives here (rather than inline in scripts/buildTokens.ts) so the transform order
 * — which is load-bearing, see the notes on `cssPlatformConfig` — is unit-testable.
 */

/**
 * Unitless dimensions.
 * Tokens with $description: 'unitless' output as raw numbers without units.
 */
export const dimensionUnitlessTransform = {
  name: "dimension/unitless",
  type: "value" as const,
  // Transitive means the transform should follow and apply to token references
  transitive: true,
  filter: (token: any) =>
    token.$type === "dimension" && token.$description === "unitless",
  transform: (token: any) => {
    // Read from the ORIGINAL DTCG value so this is immune to any earlier
    // dimension transform (dimension/css) that may have already stringified
    // the value with a unit. This transform must run LAST so nothing
    // re-appends a unit afterwards.
    const source = token.original?.$value ?? token.$value;
    if (typeof source === "object" && source.value !== undefined) {
      return String(source.value);
    }
    return String(source).replace(/(px|rem|em)$/, "");
  },
};

/**
 * em dimensions.
 * Tokens with $description: 'em' output in em units (px / basePxFontSize).
 */
export const dimensionEmTransform = {
  name: "dimension/em",
  type: "value" as const,
  transitive: true,
  filter: (token: any) =>
    token.$type === "dimension" && token.$description === "em",
  transform: (token: any, config: any) => {
    const baseFontSize = config?.basePxFontSize ?? 16;
    const pxValue =
      typeof token.$value === "object" && token.$value.value !== undefined
        ? Number(token.$value.value)
        : parseFloat(String(token.$value));
    const emValue = Math.round((pxValue / baseFontSize) * 1000) / 1000;
    return `${emValue}em`;
  },
};

/**
 * Shared platform configuration, applied to every CSS/SCSS build.
 *
 * Transform order is load-bearing in two places:
 *
 * 1. `dimension/em` must run BEFORE `dimension/css` — it emits a string, which
 *    `dimension/css` then passes through untouched.
 * 2. `dimension/unitless` must run LAST so no other dimension transform
 *    re-appends a unit afterwards.
 *
 * `dimension/css` (style-dictionary-utils) is what performs the px -> rem
 * conversion, honouring `outputUnit` and `basePxFontSize` below.
 *
 * Do NOT add Style Dictionary's built-in `size/rem` here. Despite the name it
 * does not convert px to rem — it only reads a *unitless* number as a rem count,
 * and for a DTCG dimension carrying an explicit unit it returns the value with
 * that unit as a string (e.g. {value:14, unit:'px'} -> "14px"). Because
 * `dimension/css` short-circuits on string input, that stringification silently
 * disables px -> rem conversion for every dimension token.
 */
export const cssPlatformConfig = {
  transforms: [
    "attribute/cti",
    "name/kebab",
    "time/seconds",
    "html/icon",
    "dimension/em",
    "asset/url",
    "fontFamily/css",
    "cubicBezier/css",
    "strokeStyle/css/shorthand",
    "border/css/shorthand",
    "typography/css/shorthand",
    "transition/css/shorthand",
    "oklch/css",
    "dimension/css",
    "duration/css",
    "shadow/css",
    "strokeStyle/css",
    "transition/css",
    "typography/css",
    "fontWeight/css",
    "w3c-border/css",
    "gradient/css",
    // Must run LAST: strips the unit from dimension tokens marked
    // $description: "unitless" so later transforms can't re-append a unit.
    "dimension/unitless",
  ],
  outputUnit: "rem",
  basePxFontSize: 16,
};
