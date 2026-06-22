import { describe, it, expect } from "vitest";
import { contrastRatio, resolveOnSurface } from "./contrast.js";
import { buildRamps } from "./ramps.js";
import themeInputs from "../../theme.config.js";
import { NEUTRAL_STEPS } from "./steps.js";

const white = { l: 1, c: 0, h: 0 };
const black = { l: 0, c: 0, h: 0 };

describe("contrastRatio", () => {
  it("returns ~21 for black on white", () => {
    expect(contrastRatio(black, white)).toBeGreaterThan(20);
  });
  it("returns ~1 for identical colors", () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 1);
  });
});

describe("resolveOnSurface", () => {
  const set = buildRamps(themeInputs);
  it("finds a neutral step meeting 4.5:1 against a near-white surface", () => {
    const surface = set.neutral["0"];
    const step = resolveOnSurface(set.neutral, surface, 4.5, NEUTRAL_STEPS);
    expect(NEUTRAL_STEPS).toContain(step);
    expect(contrastRatio(set.neutral[step], surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("finds a step meeting 4.5:1 against a dark surface", () => {
    const surface = set.neutral["950"];
    const step = resolveOnSurface(set.neutral, surface, 4.5, NEUTRAL_STEPS);
    expect(contrastRatio(set.neutral[step], surface)).toBeGreaterThanOrEqual(4.5);
  });
});
