import { describe, it, expect } from "vitest";
import { isSectionModified, resetSection, withDarkSurfaceFallback } from "./theme-state.js";
import type { ThemeInputs } from "@project/src/engine/types.js";

const base: ThemeInputs = {
  neutral: { hue: 110, chroma: 0.01 },
  contrast: 0.5,
  accents: { primary: { hue: 150, chroma: 0.16 }, secondary: { hue: 235, chroma: 0.16 }, tertiary: { hue: 330, chroma: 0.16 } },
  status: { success: { hue: 150, chroma: 0.16 }, error: { hue: 25, chroma: 0.19 }, warning: { hue: 80, chroma: 0.16 }, info: { hue: 235, chroma: 0.14 } },
  darkSurfaces: { base: 0.13, step: 0.042 },
};

describe("withDarkSurfaceFallback", () => {
  it("fills missing darkSurfaces with the default", () => {
    const t = withDarkSurfaceFallback({ ...base, darkSurfaces: undefined });
    expect(t.darkSurfaces).toEqual({ base: 0.13, step: 0.042 });
  });
});

describe("isSectionModified", () => {
  it("is false when nothing changed", () => {
    expect(isSectionModified("accents", base, base)).toBe(false);
  });
  it("detects a changed accent hue", () => {
    const cur = { ...base, accents: { ...base.accents, primary: { hue: 200, chroma: 0.16 } } };
    expect(isSectionModified("accents", cur, base)).toBe(true);
    expect(isSectionModified("status", cur, base)).toBe(false);
  });
  it("foundation tracks neutral and contrast", () => {
    const cur = { ...base, contrast: 0.85 as const };
    expect(isSectionModified("foundation", cur, base)).toBe(true);
  });
});

describe("resetSection", () => {
  it("restores only the named section", () => {
    const cur = { ...base, contrast: 0.85 as const, status: { ...base.status, error: { hue: 5, chroma: 0.2 } } };
    const out = resetSection("foundation", cur, base);
    expect(out.contrast).toBe(0.5);
    expect(out.status.error).toEqual({ hue: 5, chroma: 0.2 }); // untouched
  });
  it("restores brand when resetting accents", () => {
    const baseWithBrand: ThemeInputs = { ...base, brand: { primary: { l: 0.62, c: 0.16, h: 150 } } };
    const cur: ThemeInputs = {
      ...baseWithBrand,
      accents: { ...baseWithBrand.accents, primary: { hue: 200, chroma: 0.16 } },
      brand: { primary: { l: 0.5, c: 0.2, h: 30 } },
    };
    expect(resetSection("accents", cur, baseWithBrand).brand).toEqual(baseWithBrand.brand);
  });
});
