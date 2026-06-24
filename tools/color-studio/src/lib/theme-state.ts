import type { ThemeInputs } from "@project/src/engine/index.js";

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
