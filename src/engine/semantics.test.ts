import { describe, it, expect } from "vitest";
import { resolveSemantics, SEMANTICS_LIGHT, SEMANTICS_DARK } from "./semantics.js";
import type { TargetSpec } from "./semantics.js";
import { buildRamps } from "./ramps.js";
import { contrastRatio, resolveOnSurface } from "./contrast.js";
import { resolveContrast, targetFor } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";
import themeInputs from "../../theme.config.js";

const ramps = buildRamps(themeInputs);

describe("resolveSemantics — lean tokens", () => {
  const light = resolveSemantics(ramps, themeInputs, "light");
  it("resolves a fixed-step lean token to a primitive", () => {
    expect(light["color-bg-default"]).toEqual({ ref: "color-neutral-0" });
    expect(light["color-bg-accent"]).toEqual({ ref: "color-accent-500" });
  });
  it("no longer emits the dropped legacy families", () => {
    expect(light["color-background-surface-default"]).toBeUndefined();
    expect(light["color-action-primary-background"]).toBeUndefined();
    expect(light["color-text-default"]).toBeUndefined();
    expect(light["color-feedback-success-text"]).toBeUndefined();
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

describe("intent border tokens", () => {
  const expected = {
    "color-border-success":        { light: ["success", "600"], dark: ["success", "400"] },
    "color-border-success-subtle": { light: ["success", "200"], dark: ["success", "800"] },
    "color-border-error":          { light: ["error", "600"],   dark: ["error", "400"] },
    "color-border-error-subtle":   { light: ["error", "200"],   dark: ["error", "800"] },
    "color-border-warning":        { light: ["warning", "600"], dark: ["warning", "400"] },
    "color-border-warning-subtle": { light: ["warning", "200"], dark: ["warning", "800"] },
    "color-border-info":           { light: ["info", "600"],    dark: ["info", "400"] },
    "color-border-info-subtle":    { light: ["info", "200"],    dark: ["info", "800"] },
    "color-border-neutral":        { light: ["neutral", "300"], dark: ["neutral", "700"] },
    "color-border-neutral-subtle": { light: ["neutral", "200"], dark: ["neutral", "800"] },
  } as const;

  for (const [name, m] of Object.entries(expected)) {
    it(`${name} maps to the expected ramp/step in both modes`, () => {
      expect(SEMANTICS_LIGHT[name]).toEqual({ kind: "ref", ramp: m.light[0], step: m.light[1] });
      expect(SEMANTICS_DARK[name]).toEqual({ kind: "ref", ramp: m.dark[0], step: m.dark[1] });
    });
  }
});

describe("resolveSemantics — missing accent fallback", () => {
  it("resolves secondary-referencing tokens to the primary ramp when no secondary accent", () => {
    const oneAccent = { ...themeInputs, accents: { primary: themeInputs.accents.primary } };
    const ramps = buildRamps(oneAccent);
    const resolved = resolveSemantics(ramps, oneAccent, "light");
    // color-fg-secondary is ref("secondary", "700"); with no secondary accent it
    // falls back to the primary ramp at the same step.
    expect((resolved["color-fg-secondary"] as { ref: string }).ref).toBe("color-accent-700");
  });
});
