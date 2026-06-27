import { describe, it, expect } from "vitest";
import { isSectionModified, resetSection, withDarkSurfaceFallback, accentCount, addAccent, removeAccent } from "./theme-state.js";
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

const THREE: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: 0.5,
  accents: {
    primary: { hue: 100, chroma: 0.12 },
    secondary: { hue: 220, chroma: 0.11 },
    tertiary: { hue: 330, chroma: 0.1 },
  },
  status: {
    success: { hue: 150, chroma: 0.12 }, error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 }, info: { hue: 240, chroma: 0.12 },
  },
  brand: { secondary: { l: 0.6, c: 0.11, h: 220 } },
};
const ONE: ThemeInputs = { ...THREE, accents: { primary: THREE.accents.primary }, brand: {} };

describe("accent add/remove", () => {
  it("accentCount reflects present slots", () => {
    expect(accentCount(ONE)).toBe(1);
    expect(accentCount(THREE)).toBe(3);
  });

  it("addAccent appends secondary with a hue-rotated seed", () => {
    const next = addAccent(ONE);
    expect(accentCount(next)).toBe(2);
    expect(next.accents.secondary).toEqual({ hue: (100 + 90) % 360, chroma: 0.12 });
  });

  it("addAccent appends tertiary (+180) as the third", () => {
    const next = addAccent(addAccent(ONE));
    expect(accentCount(next)).toBe(3);
    expect(next.accents.tertiary).toEqual({ hue: (100 + 180) % 360, chroma: 0.12 });
  });

  it("addAccent is a no-op at 3", () => {
    expect(addAccent(THREE)).toEqual(THREE);
  });

  it("removeAccent drops the last slot and its brand entry", () => {
    const next = removeAccent(THREE);
    expect(accentCount(next)).toBe(2);
    expect("tertiary" in next.accents).toBe(false);
    const next2 = removeAccent(next); // drops secondary + brand.secondary
    expect(accentCount(next2)).toBe(1);
    expect(next2.brand && "secondary" in next2.brand).toBe(false);
  });

  it("removeAccent is a no-op at 1", () => {
    expect(removeAccent(ONE)).toEqual(ONE);
  });
});
