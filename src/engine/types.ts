export interface HueSeed {
  /** OKLCH hue in degrees, 0..360 */
  hue: number;
  /** OKLCH chroma at full strength (the ramp scales this by step) */
  chroma: number;
}

export type ContrastInput = number | "low" | "default" | "high";

export interface ThemeInputs {
  neutral: HueSeed;
  contrast: ContrastInput;
  accents: { primary: HueSeed; secondary: HueSeed; tertiary: HueSeed };
  status: { success: HueSeed; error: HueSeed; warning: HueSeed; info: HueSeed };
  /**
   * Verbatim source colors per accent slot, emitted as `color-brand-*` tokens.
   * The ramp is derived from a seed's hue + chroma; this is the exact color for
   * the one place it must match (logo, hero). Omitted slots fall back to the
   * accent at a representative lightness.
   */
  brand?: { primary?: Oklch; secondary?: Oklch; tertiary?: Oklch };
}

/** A single resolved color. l in 0..1, h in degrees, alpha in 0..1. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/** step name ("50", "500", "paper", …) -> color */
export type Ramp = Record<string, Oklch>;

export interface RampSet {
  neutral: Ramp;
  accent: Ramp; // primary
  secondary: Ramp; // sky
  tertiary: Ramp; // pink
  success: Ramp;
  error: Ramp;
  warning: Ramp;
  info: Ramp;
}
