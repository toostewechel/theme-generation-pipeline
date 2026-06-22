import type { ContrastInput } from "./types.js";

const ALIASES: Record<string, number> = { low: 0.25, default: 0.5, high: 0.85 };

/** Resolve a ContrastInput to a number in [0,1]. */
export function resolveContrast(input: ContrastInput): number {
  const n = typeof input === "number" ? input : ALIASES[input];
  if (n === undefined || Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Nudge a WCAG minimum by contrast. At/below default (0.5) the base minimum is
 * unchanged; above default it ramps linearly toward 7 (AAA-ish for body text).
 * Never returns below `baseMin`.
 */
export function targetFor(baseMin: number, contrast: number): number {
  const c = Math.min(1, Math.max(0, contrast));
  if (c <= 0.5) return baseMin;
  const t = (c - 0.5) / 0.5; // 0..1 across the upper half
  return baseMin + t * (7 - baseMin);
}
