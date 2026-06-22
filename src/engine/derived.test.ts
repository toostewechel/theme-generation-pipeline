import { describe, it, expect } from "vitest";
import { buildAlphas, buildDarkSurfaces, BLACK_ALPHA, WHITE_ALPHA } from "./derived.js";

describe("buildAlphas", () => {
  const { black, white } = buildAlphas();
  it("preserves the black 'transparent' and white 'transparant' keys", () => {
    expect(BLACK_ALPHA).toHaveProperty("transparent");
    expect(WHITE_ALPHA).toHaveProperty("transparant");
  });
  it("sets alpha from the opacity map", () => {
    expect(black["12"].alpha).toBeCloseTo(0.12, 5);
    expect(white["transparant"].alpha).toBe(0);
  });
  it("black base is dark, white base is light", () => {
    expect(black["80"].l).toBeLessThan(0.3);
    expect(white["80"].l).toBeGreaterThan(0.95);
  });
});

describe("buildDarkSurfaces", () => {
  const surf = buildDarkSurfaces(70, 0.006);
  it("produces five increasing-lightness surfaces", () => {
    const ls = ["1", "2", "3", "4", "5"].map((s) => surf[s].l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThan(ls[i - 1]);
    expect(ls[0]).toBeLessThan(0.25);
  });
});
