import { describe, it, expect } from "vitest";
import { resolveSemantics, SEMANTICS_LIGHT, SEMANTICS_DARK } from "./semantics.js";
import type { TargetSpec } from "./semantics.js";
import { buildRamps } from "./ramps.js";
import { contrastRatio, resolveOnSurface } from "./contrast.js";
import { resolveContrast, targetFor } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";
import themeInputs from "../../theme.config.js";

const ramps = buildRamps(themeInputs);

describe("resolveSemantics — lean tokens + legacy aliases", () => {
  const light = resolveSemantics(ramps, themeInputs, "light");
  it("resolves a fixed-step lean token to a primitive", () => {
    expect(light["color-bg"]).toEqual({ ref: "color-neutral-0" });
  });
  it("aliases a legacy token to its lean equivalent", () => {
    expect(light["color-background-surface-default"]).toEqual({ ref: "color-bg" });
    expect(light["color-action-primary-on-bg"]).toEqual({ ref: "color-fg-on-accent" });
  });
});

describe("resolveSemantics — contrast-targeted tokens pass WCAG", () => {
  for (const mode of ["light", "dark"] as const) {
    const table = mode === "light" ? SEMANTICS_LIGHT : SEMANTICS_DARK;
    const k = resolveContrast(themeInputs.contrast);

    for (const [name, spec] of Object.entries(table)) {
      if (spec.kind !== "target") continue;

      it(`${mode}: ${name} meets contrast guarantee (min ${spec.min}:1)`, () => {
        const surface = ramps[spec.onRamp][spec.onStep];
        const minRatio = targetFor(spec.min, k);
        const steps = spec.ramp === "neutral" ? NEUTRAL_STEPS : HUE_STEPS;
        const chosenStep = resolveOnSurface(ramps[spec.ramp], surface, minRatio, steps);
        const ratio = contrastRatio(ramps[spec.ramp][chosenStep], surface);
        expect(ratio).toBeGreaterThanOrEqual(minRatio);
      });
    }
  }
});

describe("SEMANTICS tables cover the same names in light and dark", () => {
  it("dark defines every key that light defines", () => {
    for (const key of Object.keys(SEMANTICS_LIGHT)) {
      expect(SEMANTICS_DARK[key], `missing dark spec for ${key}`).toBeDefined();
    }
  });

  it("light defines every key that dark defines", () => {
    for (const key of Object.keys(SEMANTICS_DARK)) {
      expect(SEMANTICS_LIGHT[key], `missing light spec for ${key}`).toBeDefined();
    }
  });
});
