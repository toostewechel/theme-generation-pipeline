/**
 * Curated mapping from repo semantic tokens to the minimal design.md slot set.
 * Fixed by design: every generated design.md has the same shape; only values
 * differ per theme. Guarded against token renames by mapping.test.ts.
 */

export const COLOR_SLOTS = {
  primary: "text-default",
  secondary: "text-subtle",
  tertiary: "bg-brand-default",
  neutral: "bg-default-default",
  surface: "bg-surface-default",
  "accent-secondary": "bg-brand-secondary",
  "on-accent": "text-brand-on-brand-bg",
  border: "border-default-default",
} as const;

/** design.md style name -> typography.styles key */
export const TYPOGRAPHY_SLOTS = {
  h1: "heading-3xl",
  h2: "heading-2xl",
  h3: "heading-lg",
  "body-md": "body-base",
  "body-sm": "body-sm",
  label: "eyebrow-heading-sm",
} as const;

export const SPACING_SLOTS = {
  xs: "space-100",
  sm: "space-200",
  md: "space-400",
  lg: "space-600",
  xl: "space-800",
} as const;

/** Direct lookups into the mode-selected primitives-radius collection. */
export const ROUNDED_SLOTS = {
  sm: "radius-1",
  md: "radius-2",
  lg: "radius-3",
} as const;
