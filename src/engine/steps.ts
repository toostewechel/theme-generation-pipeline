// Canonical step lists. These names MUST match today's primitive token names.
export const NEUTRAL_STEPS: string[] = [
  "0", "paper", "50", "100", "200", "300", "400", "500",
  "600", "650", "700", "800", "850", "900", "950",
];

export const HUE_STEPS: string[] = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

// Starting target lightness (OKLCH l, 0..1) at contrast = default (0.5).
// These are the calibration surface — Task 4 tunes them against today's palette.
export const NEUTRAL_LIGHTNESS: Record<string, number> = {
  "0": 1.0, paper: 0.985, "50": 0.975, "100": 0.945, "200": 0.895,
  "300": 0.83, "400": 0.74, "500": 0.726, "600": 0.56, "650": 0.51,
  "700": 0.46, "800": 0.37, "850": 0.32, "900": 0.275, "950": 0.19,
};

export const HUE_LIGHTNESS: Record<string, number> = {
  "50": 0.975, "100": 0.94, "200": 0.885, "300": 0.815, "400": 0.73,
  "500": 0.717, "600": 0.575, "700": 0.49, "800": 0.405, "900": 0.31, "950": 0.22,
};

// Chroma multiplier per step (peaks mid-ramp, tapers at the ends).
export const CHROMA_CURVE: Record<string, number> = {
  "0": 0.0, paper: 0.5, "50": 0.25, "100": 0.45, "200": 0.7, "300": 0.9,
  "400": 1.0, "500": 1.0, "600": 0.95, "650": 0.9, "700": 0.85,
  "800": 0.7, "850": 0.6, "900": 0.5, "950": 0.35,
};
