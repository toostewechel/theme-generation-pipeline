import { describe, it, expect } from "vitest";
import { rgb, clampChroma } from "culori";
import type { Oklch } from "./types.js";
import { alphaOverWhite } from "./alpha-over.js";

// Recompose a twin (color + alpha) over white in gamma sRGB: out = a·C + (1-a)·1.
function composeOverWhite(twin: Oklch): [number, number, number] {
  const a = twin.alpha ?? 1;
  const s = rgb({ mode: "oklch", l: twin.l, c: twin.c, h: twin.h })!;
  return [
    a * s.r + (1 - a),
    a * s.g + (1 - a),
    a * s.b + (1 - a),
  ];
}

// The sRGB the solid maps to (after gamut-mapping into sRGB), the target match.
function srgbOf(solid: Oklch): [number, number, number] {
  const g = clampChroma({ mode: "oklch", l: solid.l, c: solid.c, h: solid.h }, "oklch", "rgb");
  const s = rgb(g)!;
  return [s.r, s.g, s.b];
}

describe("alphaOverWhite", () => {
  it("composited over white matches the original solid (round-trip)", () => {
    const solid: Oklch = { l: 0.625, c: 0.168, h: 151 }; // a mid accent fill
    const twin = alphaOverWhite(solid);
    const got = composeOverWhite(twin);
    const want = srgbOf(solid);
    for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 6);
  });

  it("alpha equals 1 - min(sRGB channel)", () => {
    const solid: Oklch = { l: 0.5, c: 0.1, h: 250 };
    const [r, g, b] = srgbOf(solid);
    const twin = alphaOverWhite(solid);
    expect(twin.alpha).toBeCloseTo(1 - Math.min(r, g, b), 4);
  });

  it("pure white solid -> alpha 0 (fully transparent)", () => {
    const twin = alphaOverWhite({ l: 1, c: 0, h: 0 });
    expect(twin.alpha).toBe(0);
  });

  it("black solid -> alpha 1 (opaque)", () => {
    const twin = alphaOverWhite({ l: 0, c: 0, h: 0 });
    expect(twin.alpha).toBeCloseTo(1, 4);
  });

  it("alpha increases monotonically as the solid darkens", () => {
    const light = alphaOverWhite({ l: 0.95, c: 0.02, h: 151 });
    const mid = alphaOverWhite({ l: 0.6, c: 0.1, h: 151 });
    const dark = alphaOverWhite({ l: 0.25, c: 0.05, h: 151 });
    expect(light.alpha!).toBeLessThan(mid.alpha!);
    expect(mid.alpha!).toBeLessThan(dark.alpha!);
  });

  it("keeps a high-chroma p3 solid within valid sRGB bounds", () => {
    const twin = alphaOverWhite({ l: 0.55, c: 0.37, h: 145 }); // beyond sRGB gamut
    expect(twin.alpha!).toBeGreaterThanOrEqual(0);
    expect(twin.alpha!).toBeLessThanOrEqual(1);
    const got = composeOverWhite(twin);
    for (const ch of got) {
      expect(ch).toBeGreaterThanOrEqual(-1e-6);
      expect(ch).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});
