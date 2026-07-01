import { clampChroma, wcagContrast } from "culori";
import type { HueSeed, Oklch, Ramp, RampSet, ThemeInputs } from "./types.js";
import { resolveContrast, targetFor } from "./contrast-input.js";
import { buildDarkSurfaces } from "./derived.js";
import {
  NEUTRAL_STEPS, HUE_STEPS, NEUTRAL_LIGHTNESS, CHROMA_CURVE,
  HUE_L_LIGHT, HUE_L_DARK, FILL_STEP, LABEL_ON_FILL_TARGET,
  CHROMA_PEAK_T, CHROMA_SIGMA_LIGHT, CHROMA_SIGMA_DARK,
} from "./steps.js";

const EPSILON = 0.001;
const WHITE = { mode: "oklch" as const, l: 1, c: 0, h: 0 };

/** Spread lightness around the mid (0.5) by the contrast knob. Used by the
 * neutral ramp, which is a fixed eased curve (not contrast-anchored). */
function applyContrast(l: number, contrast: number): number {
  const spread = 0.7 + contrast * 0.6; // low→0.88, default→1.0, high→1.21
  return Math.min(1, Math.max(0, 0.5 + (l - 0.5) * spread));
}

function clampToP3(l: number, c: number, h: number): Oklch {
  const cl = clampChroma({ mode: "oklch", l, c, h }, "oklch", "p3");
  return { l: cl.l, c: cl.c ?? 0, h: cl.h ?? h };
}

/** Enforce strict monotonic-decreasing lightness in step order (safety net for
 * clamping or curve overshoot at extreme settings). No-op when already strict. */
function enforceMonotonic(ramp: Ramp, steps: string[]): void {
  let prevL = Infinity;
  for (const step of steps) {
    if (ramp[step].l >= prevL) ramp[step].l = Math.max(0, prevL - EPSILON);
    prevL = ramp[step].l;
  }
}

/** Neutral / array-driven ramp: lightness from a fixed eased table, chroma from
 * the shared multiplier curve. Kept for the achromatic neutral scaffold. */
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
    ramp[step] = clampToP3(l, c, seed.hue);
  }
  enforceMonotonic(ramp, steps);
  return ramp;
}

/** Chroma at normalized position t (0..1): skewed gaussian peaking near the
 * fill, with separate light/dark sigmas. */
function chromaAt(t: number, peak: number): number {
  const sigma = t < CHROMA_PEAK_T ? CHROMA_SIGMA_LIGHT : CHROMA_SIGMA_DARK;
  const d = t - CHROMA_PEAK_T;
  return peak * Math.exp(-(d * d) / (2 * sigma * sigma));
}

/** Solve the fill-step lightness so white-on-fill meets `target` for this hue.
 * Contrast against white falls monotonically as L rises, so binary search
 * converges. The fill's chroma is gamut-clamped at each candidate L. */
function solveFillLightness(hue: number, peak: number, target: number): number {
  let lo = 0.2; // darkest fill we allow
  let hi = 0.85; // lightest fill we allow
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const fill = clampToP3(mid, peak, hue);
    const ratio = wcagContrast(WHITE, { mode: "oklch", l: fill.l, c: fill.c, h: fill.h });
    if (ratio > target) lo = mid; // can afford a lighter fill
    else hi = mid; // too little contrast, go darker
  }
  return (lo + hi) / 2;
}

/** Per-hue ramp: WCAG-anchored quadratic lightness + skewed-gaussian chroma. */
export function buildHueRamp(seed: HueSeed, target: number): Ramp {
  const lFill = solveFillLightness(seed.hue, seed.chroma, target);

  // Quadratic L(t) = a·t² + b·t + c through (0, light), (0.5, fill), (1, dark).
  const c0 = HUE_L_LIGHT;
  const b = 4 * lFill - 3 * HUE_L_LIGHT - HUE_L_DARK;
  const a = HUE_L_DARK - HUE_L_LIGHT - b;

  const ramp: Ramp = {};
  const n = HUE_STEPS.length;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const l = Math.min(1, Math.max(0, a * t * t + b * t + c0));
    ramp[HUE_STEPS[i]] = clampToP3(l, chromaAt(t, seed.chroma), seed.hue);
  }
  enforceMonotonic(ramp, HUE_STEPS);
  return ramp;
}

export function buildRamps(inputs: ThemeInputs): RampSet {
  const k = resolveContrast(inputs.contrast);
  const target = targetFor(LABEL_ON_FILL_TARGET, k); // contrast knob darkens fills
  const hue = (s: HueSeed) => buildHueRamp(s, target);
  return {
    neutral: buildRamp(inputs.neutral, NEUTRAL_STEPS, NEUTRAL_LIGHTNESS, k),
    accent: hue(inputs.accents.primary),
    ...(inputs.accents.secondary ? { secondary: hue(inputs.accents.secondary) } : {}),
    ...(inputs.accents.tertiary ? { tertiary: hue(inputs.accents.tertiary) } : {}),
    success: hue(inputs.status.success),
    error: hue(inputs.status.error),
    warning: hue(inputs.status.warning),
    info: hue(inputs.status.info),
    darkSurface: buildDarkSurfaces(
      inputs.neutral.hue,
      inputs.neutral.chroma,
      inputs.darkSurfaces?.base,
      inputs.darkSurfaces?.step,
    ),
  };
}

// Re-export so callers (tests, fill solver consumers) can reach the fill step.
export { FILL_STEP, LABEL_ON_FILL_TARGET };
