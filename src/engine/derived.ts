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

// Dark-mode surface lightnesses (today: #0a0a0a..#242424 → l ≈ 0.13..0.30).
export const DARK_SURFACE_LIGHTNESS: Record<string, number> = {
  "1": 0.13, "2": 0.16, "3": 0.2, "4": 0.24, "5": 0.3,
};

export function buildDarkSurfaces(hue: number, chroma: number): Ramp {
  const out: Ramp = {};
  for (const [step, l] of Object.entries(DARK_SURFACE_LIGHTNESS)) {
    out[step] = { l, c: Math.min(chroma, 0.01), h: hue };
  }
  return out;
}
