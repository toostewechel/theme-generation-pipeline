export interface ClampInput {
  minPx: number;
  maxPx: number;
  minVwPx: number;
  maxVwPx: number;
  baseFontSize: number;
}

function round(value: number, decimals = 4): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

function formatRem(px: number, base: number): string {
  const rem = round(px / base);
  return `${rem}rem`;
}

/**
 * Generates a CSS clamp() expression for fluid typography.
 *
 * The preferred value uses the form: interceptRem + slopeVw
 * where the font size linearly interpolates between min and max
 * across the viewport range.
 */
export function generateClamp(input: ClampInput): string {
  const { minPx, maxPx, minVwPx, maxVwPx, baseFontSize } = input;

  // If min equals max, no fluid behavior needed
  if (minPx === maxPx) {
    return formatRem(minPx, baseFontSize);
  }

  const slope = (maxPx - minPx) / (maxVwPx - minVwPx);
  const intercept = minPx - slope * minVwPx;

  const slopeVw = round(slope * 100);
  const interceptRem = round(intercept / baseFontSize);

  const minRem = formatRem(minPx, baseFontSize);
  const maxRem = formatRem(maxPx, baseFontSize);

  // Build the preferred value (intercept + slope)
  const parts: string[] = [];
  if (interceptRem !== 0) {
    parts.push(`${interceptRem}rem`);
  }
  if (slopeVw !== 0) {
    parts.push(`${slopeVw}vw`);
  }
  const preferred = parts.join(" + ") || "0rem";

  return `clamp(${minRem}, ${preferred}, ${maxRem})`;
}

export interface UnitlessClampInput {
  min: number;
  max: number;
  minVwPx: number;
  maxVwPx: number;
}

/**
 * Generates a CSS clamp() for unitless values (e.g., line-height ratios).
 * Uses calc() since unitless values can't use the rem+vw shorthand.
 *
 * Output: "clamp(1.2, calc(1.4 + (1.2 - 1.4) * (100vw - 320px) / (1440 - 320)), 1.4)"
 * Simplified to: "clamp(min, calc(intercept + slope * 100vw), max)"
 */
export function generateUnitlessClamp(input: UnitlessClampInput): string {
  const { min, max, minVwPx, maxVwPx } = input;

  if (min === max) {
    return String(round(min));
  }

  const slope = (max - min) / (maxVwPx - minVwPx);
  const intercept = min - slope * minVwPx;

  const slopeVw = round(slope * 100);
  const interceptVal = round(intercept);

  const clampMin = round(Math.min(min, max));
  const clampMax = round(Math.max(min, max));

  return `clamp(${clampMin}, ${interceptVal} + ${slopeVw}vw, ${clampMax})`;
}

/**
 * Computes the interpolated pixel size at a given viewport width.
 * Useful for preview tools that can't use actual vw units.
 */
export function interpolateAtViewport(
  minPx: number,
  maxPx: number,
  minVwPx: number,
  maxVwPx: number,
  viewportPx: number,
): number {
  if (viewportPx <= minVwPx) return minPx;
  if (viewportPx >= maxVwPx) return maxPx;
  return minPx + (maxPx - minPx) * ((viewportPx - minVwPx) / (maxVwPx - minVwPx));
}
