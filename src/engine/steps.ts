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

export const HUE_LIGHTNESS: Record<string, number> = {
  "50": 0.975, "100": 0.94, "200": 0.895, "300": 0.84, "400": 0.782,
  "500": 0.717, "600": 0.628, "700": 0.52, "800": 0.41, "900": 0.31, "950": 0.22,
};

// Chroma multiplier per step (peaks mid-ramp, tapers at the ends).
export const CHROMA_CURVE: Record<string, number> = {
  "0": 0.0, paper: 0.5, "50": 0.25, "100": 0.45, "200": 0.7, "300": 0.9,
  "400": 1.0, "500": 1.0, "600": 0.95, "650": 0.9, "700": 0.85,
  "800": 0.7, "850": 0.6, "900": 0.5, "950": 0.35,
};
