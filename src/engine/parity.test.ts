import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { differenceEuclidean, oklch, rgb } from "culori";
import { buildRamps } from "./ramps.js";
import themeInputs from "../../theme.config.js";

// Read the FROZEN legacy fixture (not the live token file, which Task 10 overwrites).
const current = JSON.parse(
  readFileSync(new URL("./__fixtures__/legacy-primitives.json", import.meta.url), "utf-8"),
);

function currentOklch(name: string) {
  const comps = current[name].$value.components as number[];
  return oklch(rgb({ mode: "rgb", r: comps[0], g: comps[1], b: comps[2] }));
}

const dE = differenceEuclidean("oklch");
// Proximity GUIDE tolerance (not a hard gate). Tighten/loosen during calibration.
const TOL = 0.06;

describe("proximity guide — neutral ramp", () => {
  const set = buildRamps(themeInputs);
  for (const step of ["50", "100", "500", "900", "950"]) {
    it(`neutral-${step} is within tolerance of today`, () => {
      const gen = { mode: "oklch" as const, ...set.neutral[step] };
      const cur = currentOklch(`color-neutral-${step}`);
      expect(dE(gen, cur)).toBeLessThan(TOL);
    });
  }
});

describe("proximity guide — primary accent", () => {
  const set = buildRamps(themeInputs);
  for (const step of ["100", "500", "900"]) {
    it(`accent-${step} is within tolerance of today`, () => {
      const gen = { mode: "oklch" as const, ...set.accent[step] };
      const cur = currentOklch(`color-accent-${step}`);
      expect(dE(gen, cur)).toBeLessThan(TOL);
    });
  }
});
