import { formatHex, formatHex8 } from "culori";
import type { Oklch } from "@project/src/engine/index.js";

/** Convert one ramp to an ordered { step: hex } map.
 *  Solid ramps → 6-digit hex; alpha ramps → 8-digit hex (preserves transparency). */
export function rampToHexMap(
  ramp: Record<string, Oklch>,
  opts: { alpha: boolean },
): Record<string, string> {
  const fmt = opts.alpha ? formatHex8 : formatHex;
  const out: Record<string, string> = {};
  for (const [step, c] of Object.entries(ramp)) {
    out[step] = fmt({ mode: "oklch", l: c.l, c: c.c, h: c.h, alpha: c.alpha }) ?? "#000000";
  }
  return out;
}
