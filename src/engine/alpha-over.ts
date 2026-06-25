import { rgb, oklch, clampChroma } from "culori";
import type { Oklch } from "./types.js";

const WHITE: Oklch = { l: 1, c: 0, h: 0 };

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Solve the "alphredo" problem against a white background: given an opaque
 * OKLCH color, return the most-transparent color that, composited over white
 * in gamma sRGB, renders identically to the input.
 *
 * The math runs in gamma sRGB because browsers and Figma composite alpha
 * there; the solid is gamut-mapped into sRGB first (ramps are p3-clamped, so a
 * raw conversion can fall outside [0,1]). The result is returned in OKLCH +
 * alpha to match the engine's native storage space.
 */
export function alphaOverWhite(solid: Oklch): Oklch {
  const inGamut = clampChroma(
    { mode: "oklch", l: solid.l, c: solid.c, h: solid.h },
    "oklch",
    "rgb",
  );
  const s = rgb(inGamut)!;
  const f = [clamp01(s.r), clamp01(s.g), clamp01(s.b)];
  const alpha = 1 - Math.min(f[0], f[1], f[2]);
  if (alpha < 1e-9) return { ...WHITE, alpha: 0 }; // pure white → invisible over white
  const c = f.map((x) => clamp01((x - (1 - alpha)) / alpha));
  const back = oklch({ mode: "rgb", r: c[0], g: c[1], b: c[2] })!;
  return {
    l: back.l,
    c: back.c ?? 0,
    h: back.h ?? solid.h,
    alpha,
  };
}
