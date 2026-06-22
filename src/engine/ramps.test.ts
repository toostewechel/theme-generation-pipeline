import { describe, it, expect } from "vitest";
import { clampChroma, inGamut } from "culori";
import { buildRamps } from "./ramps.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";
import type { ThemeInputs } from "./types.js";

const INPUTS: ThemeInputs = {
  neutral: { hue: 70, chroma: 0.006 },
  contrast: "default",
  accents: {
    primary: { hue: 138, chroma: 0.12 },
    secondary: { hue: 220, chroma: 0.11 },
    tertiary: { hue: 330, chroma: 0.1 },
  },
  status: {
    success: { hue: 150, chroma: 0.12 },
    error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 },
    info: { hue: 240, chroma: 0.12 },
  },
};

const inP3 = inGamut("p3");

describe("hue ramp", () => {
  const ramp = buildRamps(INPUTS).accent;

  it("produces a color for every step", () => {
    for (const step of HUE_STEPS) {
      expect(ramp[step]).toBeDefined();
      expect(ramp[step].mode ?? "oklch").toBeTruthy();
    }
  });

  it("is monotonically decreasing in lightness from light to dark steps", () => {
    const ls = HUE_STEPS.map((s) => ramp[s].l);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });

  it("stays within the P3 gamut after clamping", () => {
    for (const step of HUE_STEPS) {
      const c = { mode: "oklch" as const, l: ramp[step].l, c: ramp[step].c, h: ramp[step].h };
      expect(inP3(clampChroma(c, "oklch", "p3"))).toBe(true);
    }
  });
});

describe("buildRamps", () => {
  const set = buildRamps(INPUTS);

  it("builds all eight named ramps", () => {
    for (const key of ["neutral", "accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const) {
      expect(set[key]).toBeDefined();
    }
  });

  it("includes the special neutral steps", () => {
    for (const step of ["0", "paper", "650", "850"]) {
      expect(set.neutral[step]).toBeDefined();
    }
    expect(NEUTRAL_STEPS).toContain("paper");
  });

  it("keeps neutral chroma low (reads as gray)", () => {
    for (const step of NEUTRAL_STEPS) {
      expect(set.neutral[step].c).toBeLessThan(0.02);
    }
  });
});

describe("strict monotonic lightness at high contrast", () => {
  for (const contrastValue of ["high" as const, 1 as const]) {
    const label = contrastValue === "high" ? '"high"' : "1";

    it(`hue ramp is strictly decreasing at contrast ${label}`, () => {
      const set = buildRamps({ ...INPUTS, contrast: contrastValue });
      const ls = HUE_STEPS.map((s) => set.accent[s].l);
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i]).toBeLessThan(ls[i - 1]);
      }
    });

    it(`neutral ramp is strictly decreasing at contrast ${label}`, () => {
      const set = buildRamps({ ...INPUTS, contrast: contrastValue });
      const ls = NEUTRAL_STEPS.map((s) => set.neutral[s].l);
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i]).toBeLessThan(ls[i - 1]);
      }
    });
  }
});
