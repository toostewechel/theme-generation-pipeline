// Canonical step lists. These names MUST match today's primitive token names.
export const NEUTRAL_STEPS: string[] = [
  "0", "paper", "50", "100", "200", "300", "400", "500",
  "600", "650", "700", "800", "850", "900", "950",
];

export const HUE_STEPS: string[] = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

// Target lightness (OKLCH l, 0..1) at contrast = default (0.5).
// Eased curve: light steps spaced tighter, dark steps wider (the standard ramp
// shape). The parity-gated steps (neutral 50/100/500/900/950, hue 100/500/900)
// and the brand-matched 500 are held on target; the rest are spaced so adjacent
// steps stay perceptibly distinct (see spacing.test.ts). "0" and "paper" are
// deliberately near-white anchors.
export const NEUTRAL_LIGHTNESS: Record<string, number> = {
  "0": 1.0, paper: 0.985, "50": 0.975, "100": 0.945, "200": 0.9,
  "300": 0.845, "400": 0.79, "500": 0.726, "600": 0.64, "650": 0.578,
  "700": 0.515, "800": 0.4, "850": 0.345, "900": 0.275, "950": 0.19,
};

// --- Hue ramps: per-hue WCAG-anchored model (no shared lightness array) ---
// Lightness is a per-hue quadratic through three anchors: a near-white light
// end, the FILL_STEP solved so white-on-fill hits the contrast target, and a
// near-black dark end. Because the fill is solved in WCAG-luminance space, the
// label-on-fill ratio holds across every hue (OKLCH lightness alone would not
// — see wcag-fill.test.ts). Chroma is a skewed gaussian peaking near the fill.
export const HUE_L_LIGHT = 0.97; // step 50 anchor (t = 0)
export const HUE_L_DARK = 0.16; // step 950 anchor (t = 1)
export const FILL_STEP = "500"; // the "base fill" a white label sits on
export const LABEL_ON_FILL_TARGET = 4.6; // white-on-fill WCAG floor (contrast knob raises it)

// Skewed gaussian for chroma across the ramp (t in 0..1): peak near the fill,
// separate sigmas so saturation can lean instead of peaking symmetrically.
export const CHROMA_PEAK_T = 0.5; // peak position (≈ fill / step 500)
export const CHROMA_SIGMA_LIGHT = 0.3; // falloff toward the light end
export const CHROMA_SIGMA_DARK = 0.34; // falloff toward the dark end

// Representative lightness for a `color-brand-*` token when no verbatim brand
// color is supplied for that accent slot (the accent's hue/chroma at mid tone).
export const BRAND_DEFAULT_L = 0.62;

// Chroma multiplier per step (peaks mid-ramp, tapers at the ends).
export const CHROMA_CURVE: Record<string, number> = {
  "0": 0.0, paper: 0.5, "50": 0.25, "100": 0.45, "200": 0.7, "300": 0.9,
  "400": 1.0, "500": 1.0, "600": 0.95, "650": 0.9, "700": 0.85,
  "800": 0.7, "850": 0.6, "900": 0.5, "950": 0.35,
};
