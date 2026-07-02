import { oklch } from "culori";
import type { Oklch, HueSeed } from "./types.js";

/** Full-precision OKLCH of a CSS color string (hex, rgb(), etc.). Throws if unparseable. */
export function hexToOklch(hex: string): Oklch {
  const o = oklch(hex);
  if (!o) throw new Error(`hexToOklch: could not parse color "${hex}"`);
  return { l: o.l, c: o.c ?? 0, h: o.h ?? 0 };
}

/** Hue + chroma seed derived from a CSS color string. Throws if unparseable. */
export function hexToHueSeed(hex: string): HueSeed {
  const { c, h } = hexToOklch(hex);
  return { hue: h, chroma: c };
}
