import type { ThemeInputs, HueSeed } from "./types.js";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const CONTRAST_WORDS = new Set(["low", "default", "high"]);

function checkSeed(label: string, seed: HueSeed | undefined, errors: string[]): void {
  if (!seed) {
    errors.push(`${label}: missing`);
    return;
  }
  if (typeof seed.hue !== "number" || seed.hue < 0 || seed.hue > 360) {
    errors.push(`${label}: hue must be a number in [0,360] (got ${seed.hue})`);
  }
  if (typeof seed.chroma !== "number" || seed.chroma < 0) {
    errors.push(`${label}: chroma must be a number >= 0 (got ${seed.chroma})`);
  }
}

/** Validate a fully-resolved ThemeInputs. Returns all problems at once. */
export function validateInputs(inputs: ThemeInputs): ValidationResult {
  const errors: string[] = [];

  checkSeed("neutral", inputs.neutral, errors);
  checkSeed("accents.primary", inputs.accents?.primary, errors);
  for (const slot of ["secondary", "tertiary"] as const) {
    if (inputs.accents?.[slot]) checkSeed(`accents.${slot}`, inputs.accents[slot], errors);
  }
  for (const key of ["success", "error", "warning", "info"] as const) {
    checkSeed(`status.${key}`, inputs.status?.[key], errors);
  }

  const c = inputs.contrast;
  const contrastOk =
    (typeof c === "number" && c >= 0 && c <= 1) ||
    (typeof c === "string" && CONTRAST_WORDS.has(c));
  if (!contrastOk) {
    errors.push(`contrast: must be a number in [0,1] or one of low|default|high (got ${String(c)})`);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
