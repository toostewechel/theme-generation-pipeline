import { wcagContrast } from "culori";
import type { Oklch, Ramp } from "./types.js";

function toCulori(c: Oklch) {
  return { mode: "oklch" as const, l: c.l, c: c.c, h: c.h };
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  return wcagContrast(toCulori(a), toCulori(b));
}

/**
 * Pick the first ramp step (scanning from the end farther from the surface in
 * lightness, i.e. the higher-contrast direction) that meets `minRatio` against
 * `surface`. If none qualify, return the step with the maximum contrast.
 */
export function resolveOnSurface(
  ramp: Ramp,
  surface: Oklch,
  minRatio: number,
  steps: string[],
): string {
  // Order steps by their contrast against the surface, descending.
  const ranked = [...steps].sort(
    (a, b) => contrastRatio(ramp[b], surface) - contrastRatio(ramp[a], surface),
  );
  for (let i = ranked.length - 1; i >= 0; i--) {
    if (contrastRatio(ramp[ranked[i]], surface) >= minRatio) return ranked[i];
  }
  return ranked[0]; // highest contrast available
}
