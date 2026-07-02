import type { ThemeInputs, HueSeed, Oklch, ContrastInput } from "./types.js";

type Slots<T> = { primary?: T; secondary?: T; tertiary?: T };

export interface DeepPartialInputs {
  neutral?: Partial<HueSeed>;
  contrast?: ContrastInput;
  accents?: Slots<HueSeed>;
  status?: Partial<{ success: HueSeed; error: HueSeed; warning: HueSeed; info: HueSeed }>;
  brand?: Slots<Oklch>;
  darkSurfaces?: Partial<{ base: number; step: number }>;
  alpha?: boolean;
}

/** Merge a partial set of structured inputs over a complete base ThemeInputs. */
export function resolveInputs(partial: DeepPartialInputs, base: ThemeInputs): ThemeInputs {
  const out: ThemeInputs = {
    ...base,
    ...(partial.contrast !== undefined ? { contrast: partial.contrast } : {}),
    ...(partial.alpha !== undefined ? { alpha: partial.alpha } : {}),
    neutral: { ...base.neutral, ...partial.neutral },
    accents: { ...base.accents, ...partial.accents },
    status: { ...base.status, ...partial.status },
  };
  if (partial.brand || base.brand) out.brand = { ...base.brand, ...partial.brand };
  if (partial.darkSurfaces || base.darkSurfaces) {
    out.darkSurfaces = { ...base.darkSurfaces, ...partial.darkSurfaces } as ThemeInputs["darkSurfaces"];
  }
  return out;
}
