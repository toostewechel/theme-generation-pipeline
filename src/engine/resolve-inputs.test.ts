import { describe, it, expect } from "vitest";
import { resolveInputs } from "./resolve-inputs.js";
import type { ThemeInputs } from "./types.js";

const BASE: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: "default",
  accents: {
    primary: { hue: 151, chroma: 0.19 },
    secondary: { hue: 70, chroma: 0.135 },
  },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
  darkSurfaces: { base: 0.095, step: 0.034 },
};

describe("resolveInputs", () => {
  it("returns the base unchanged for an empty partial", () => {
    expect(resolveInputs({}, BASE)).toEqual(BASE);
  });

  it("overrides only the supplied accent slot, keeping the rest", () => {
    const out = resolveInputs({ accents: { primary: { hue: 20, chroma: 0.2 } } }, BASE);
    expect(out.accents.primary).toEqual({ hue: 20, chroma: 0.2 });
    expect(out.accents.secondary).toEqual({ hue: 70, chroma: 0.135 });
    expect(out.status).toEqual(BASE.status);
  });

  it("merges a single dark-surface dial over the base", () => {
    const out = resolveInputs({ darkSurfaces: { base: 0.08 } }, BASE);
    expect(out.darkSurfaces).toEqual({ base: 0.08, step: 0.034 });
  });

  it("replaces a scalar (contrast)", () => {
    expect(resolveInputs({ contrast: 0.8 }, BASE).contrast).toBe(0.8);
  });
});
