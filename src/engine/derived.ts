import type { Oklch, Ramp } from "./types.js";

// Opacity maps. Keys MUST match today's token names exactly (note the differing
// spelling: black uses "transparent", white uses "transparant").
const OPACITIES = {
  "4": 0.04, "8": 0.08, "12": 0.12, "16": 0.16, "24": 0.24,
  "32": 0.32, "48": 0.48, "64": 0.64, "80": 0.8,
} as const;

export const BLACK_ALPHA: Record<string, number> = { transparent: 0, ...OPACITIES };
export const WHITE_ALPHA: Record<string, number> = { transparant: 0, ...OPACITIES };

// Today's alpha base colors: black-alpha rests on #0a0a0a, white-alpha on #fff.
export const BLACK_BASE: Oklch = { l: 0.13, c: 0, h: 0 };
export const WHITE_BASE: Oklch = { l: 1, c: 0, h: 0 };

export function buildAlphas(): { black: Ramp; white: Ramp } {
  const black: Ramp = {};
  for (const [step, alpha] of Object.entries(BLACK_ALPHA)) black[step] = { ...BLACK_BASE, alpha };
  const white: Ramp = {};
  for (const [step, alpha] of Object.entries(WHITE_ALPHA)) white[step] = { ...WHITE_BASE, alpha };
  return { black, white };
}

// Dark-mode surface elevation ramp. Five solid surfaces derived from a base
// lightness (the deepest surface) plus a per-level step, so a designer controls
// "how dark is dark mode" (base) and "how separated are raised layers" (step).
// Defaults approximate the previous fixed ladder (~0.13 .. 0.30).
export const DARK_SURFACE_BASE = 0.13;
export const DARK_SURFACE_STEP = 0.042;
export const DARK_SURFACE_LEVELS = 5;
const DARK_SURFACE_CHROMA_CAP = 0.01; // keep surfaces near-neutral

export function buildDarkSurfaces(
  hue: number,
  chroma: number,
  base: number = DARK_SURFACE_BASE,
  step: number = DARK_SURFACE_STEP,
): Ramp {
  const out: Ramp = {};
  for (let n = 1; n <= DARK_SURFACE_LEVELS; n++) {
    const l = Math.min(1, Math.max(0, base + (n - 1) * step));
    out[String(n)] = { l, c: Math.min(chroma, DARK_SURFACE_CHROMA_CAP), h: hue };
  }
  return out;
}
