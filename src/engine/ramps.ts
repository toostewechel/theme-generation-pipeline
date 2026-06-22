import { clampChroma } from "culori";
import type { HueSeed, Oklch, Ramp, RampSet, ThemeInputs } from "./types.js";
import { resolveContrast } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS, NEUTRAL_LIGHTNESS, HUE_LIGHTNESS, CHROMA_CURVE } from "./steps.js";

/** Spread lightness around the mid (0.5) by the contrast knob. */
function applyContrast(l: number, contrast: number): number {
  const spread = 0.7 + contrast * 0.6; // low→0.88, default→1.0, high→1.21
  return Math.min(1, Math.max(0, 0.5 + (l - 0.5) * spread));
}

export function buildRamp(
  seed: HueSeed,
  steps: string[],
  lightness: Record<string, number>,
  contrast: number,
): Ramp {
  const ramp: Ramp = {};
  for (const step of steps) {
    const l = applyContrast(lightness[step], contrast);
    const c = seed.chroma * (CHROMA_CURVE[step] ?? 1);
    const clamped = clampChroma({ mode: "oklch", l, c, h: seed.hue }, "oklch", "p3");
    ramp[step] = { l: clamped.l, c: clamped.c ?? 0, h: clamped.h ?? seed.hue };
  }
  return ramp;
}

export function buildRamps(inputs: ThemeInputs): RampSet {
  const k = resolveContrast(inputs.contrast);
  return {
    neutral: buildRamp(inputs.neutral, NEUTRAL_STEPS, NEUTRAL_LIGHTNESS, k),
    accent: buildRamp(inputs.accents.primary, HUE_STEPS, HUE_LIGHTNESS, k),
    secondary: buildRamp(inputs.accents.secondary, HUE_STEPS, HUE_LIGHTNESS, k),
    tertiary: buildRamp(inputs.accents.tertiary, HUE_STEPS, HUE_LIGHTNESS, k),
    success: buildRamp(inputs.status.success, HUE_STEPS, HUE_LIGHTNESS, k),
    error: buildRamp(inputs.status.error, HUE_STEPS, HUE_LIGHTNESS, k),
    warning: buildRamp(inputs.status.warning, HUE_STEPS, HUE_LIGHTNESS, k),
    info: buildRamp(inputs.status.info, HUE_STEPS, HUE_LIGHTNESS, k),
  };
}
