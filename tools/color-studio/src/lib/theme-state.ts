import type { ThemeInputs, HueSeed } from "@project/src/engine/index.js";

export type SectionKey = "foundation" | "accents" | "status" | "darkSurfaces";

const DARK_SURFACE_FALLBACK = { base: 0.13, step: 0.042 };

export function withDarkSurfaceFallback(t: ThemeInputs): ThemeInputs {
  return { ...t, darkSurfaces: { ...DARK_SURFACE_FALLBACK, ...(t.darkSurfaces ?? {}) } };
}

function slice(section: SectionKey, t: ThemeInputs): unknown {
  switch (section) {
    case "foundation": return { neutral: t.neutral, contrast: t.contrast };
    case "accents": return t.accents;
    case "status": return t.status;
    case "darkSurfaces": return t.darkSurfaces ?? DARK_SURFACE_FALLBACK;
  }
}

export function isSectionModified(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): boolean {
  return JSON.stringify(slice(section, current)) !== JSON.stringify(slice(section, baseline));
}

export function resetSection(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): ThemeInputs {
  switch (section) {
    case "foundation": return { ...current, neutral: { ...baseline.neutral }, contrast: baseline.contrast };
    case "accents": return { ...current, accents: structuredClone(baseline.accents), brand: structuredClone(baseline.brand) };
    case "status": return { ...current, status: structuredClone(baseline.status) };
    case "darkSurfaces": return { ...current, darkSurfaces: { ...(baseline.darkSurfaces ?? DARK_SURFACE_FALLBACK) } };
  }
}

export const ACCENT_SLOTS = ["primary", "secondary", "tertiary"] as const;
export type AccentSlot = (typeof ACCENT_SLOTS)[number];

export function presentAccentSlots(t: ThemeInputs): AccentSlot[] {
  return ACCENT_SLOTS.filter((s) => t.accents[s]);
}

export function accentCount(t: ThemeInputs): number {
  return presentAccentSlots(t).length;
}

export function addAccent(t: ThemeInputs): ThemeInputs {
  const count = accentCount(t);
  if (count >= ACCENT_SLOTS.length) return t;
  const slot = ACCENT_SLOTS[count]; // count 1 → secondary, 2 → tertiary
  const seed: HueSeed = {
    hue: (t.accents.primary.hue + 90 * count) % 360,
    chroma: t.accents.primary.chroma,
  };
  return { ...t, accents: { ...t.accents, [slot]: seed } };
}

export function removeAccent(t: ThemeInputs): ThemeInputs {
  const present = presentAccentSlots(t);
  if (present.length <= 1) return t;
  const last = present[present.length - 1] as "secondary" | "tertiary";
  const { [last]: _dropped, ...accents } = t.accents;
  const next: ThemeInputs = { ...t, accents };
  if (t.brand && last in t.brand) {
    const { [last]: _b, ...brand } = t.brand;
    next.brand = brand;
  }
  return next;
}
