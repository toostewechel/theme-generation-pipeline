import { oklch, formatHex } from "culori";

export const REP_L = 0.62;
export const CHROMA_MAX = 0.3;
export const CHROMA_STEP = 0.005;

export function hexOf(hue: number, chroma: number, l: number): string {
  return formatHex({ mode: "oklch", l, c: chroma, h: hue });
}

export interface ParsedHex { hue: number; chroma: number; l: number; }

export function parseHex(input: string): ParsedHex | null {
  const c = oklch(input.trim());
  if (!c) return null;
  const hue = Math.round((((c.h ?? 0) % 360) + 360) % 360);
  const raw = Math.min(CHROMA_MAX, Math.max(0, c.c ?? 0));
  const chroma = Math.round(raw / CHROMA_STEP) * CHROMA_STEP;
  const l = Math.min(1, Math.max(0, c.l ?? REP_L));
  return { hue, chroma, l };
}

export function hueTrack(): string {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 30) stops.push(`oklch(0.72 0.15 ${h})`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function chromaTrack(hue: number): string {
  return `linear-gradient(90deg, oklch(0.72 0 ${hue}), oklch(0.72 0.3 ${hue}))`;
}

export function swatchCss(l: number, hue: number, chroma: number): string {
  return `oklch(${l} ${chroma} ${hue})`;
}

export const CONTRAST_ALIASES: [string, number][] = [["low", 0.25], ["default", 0.5], ["high", 0.85]];

export function nearestAlias(v: number): string {
  let best = CONTRAST_ALIASES[0];
  for (const a of CONTRAST_ALIASES) if (Math.abs(a[1] - v) < Math.abs(best[1] - v)) best = a;
  return best[0];
}
