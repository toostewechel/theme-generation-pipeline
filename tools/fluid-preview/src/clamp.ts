// Canonical source: src/fluid/generateClamp.ts
// Duplicated here to avoid cross-package imports in the prototype.

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

export function generateClamp(input: ClampInput): string {
  const { minPx, maxPx, minVwPx, maxVwPx, baseFontSize } = input;

  if (minPx === maxPx) {
    return formatRem(minPx, baseFontSize);
  }

  const slope = (maxPx - minPx) / (maxVwPx - minVwPx);
  const intercept = minPx - slope * minVwPx;

  const slopeVw = round(slope * 100);
  const interceptRem = round(intercept / baseFontSize);

  const minRem = formatRem(minPx, baseFontSize);
  const maxRem = formatRem(maxPx, baseFontSize);

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
