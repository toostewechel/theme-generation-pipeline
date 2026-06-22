import { describe, it, expect } from "vitest";
import { buildRamps } from "./ramps.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";
import themeInputs from "../../theme.config.js";

// Adjacent ramp steps must differ in lightness by at least this much, so no two
// steps read as the same color. Would have caught the 400/500 collision (~0.013)
// that a single-step calibration introduced.
const MIN_ADJACENT_L = 0.025;

describe("ramp lightness spacing (no near-collisions)", () => {
  const set = buildRamps(themeInputs);

  // Skip the two deliberately near-white neutral anchors ("0", "paper").
  const neutralCore = NEUTRAL_STEPS.slice(2);

  it("neutral core steps stay perceptibly apart", () => {
    for (let i = 1; i < neutralCore.length; i++) {
      const prev = neutralCore[i - 1];
      const cur = neutralCore[i];
      const delta = set.neutral[prev].l - set.neutral[cur].l;
      expect(delta, `neutral ${prev}->${cur}`).toBeGreaterThanOrEqual(MIN_ADJACENT_L);
    }
  });

  for (const ramp of ["accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const) {
    it(`${ramp} steps stay perceptibly apart`, () => {
      for (let i = 1; i < HUE_STEPS.length; i++) {
        const prev = HUE_STEPS[i - 1];
        const cur = HUE_STEPS[i];
        const delta = set[ramp][prev].l - set[ramp][cur].l;
        expect(delta, `${ramp} ${prev}->${cur}`).toBeGreaterThanOrEqual(MIN_ADJACENT_L);
      }
    });
  }
});
