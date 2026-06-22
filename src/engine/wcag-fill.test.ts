import { describe, it, expect } from "vitest";
import { wcagContrast } from "culori";
import { buildRamps, FILL_STEP, LABEL_ON_FILL_TARGET } from "./ramps.js";
import themeInputs from "../../theme.config.js";

const WHITE = { mode: "oklch" as const, l: 1, c: 0, h: 0 };
const HUES = ["accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const;

function whiteOnFill(fill: { l: number; c: number; h: number }): number {
  return wcagContrast(WHITE, { mode: "oklch", l: fill.l, c: fill.c, h: fill.h });
}

describe("label-on-fill contrast holds across hues (the accessibility payoff)", () => {
  const set = buildRamps(themeInputs);
  const ratios = HUES.map((h) => whiteOnFill(set[h][FILL_STEP]));

  it("white-on-fill clears the target for every hue", () => {
    HUES.forEach((h, i) => {
      expect(ratios[i], `${h} white-on-fill = ${ratios[i].toFixed(2)}`).toBeGreaterThanOrEqual(
        LABEL_ON_FILL_TARGET - 0.1,
      );
    });
  });

  it("white-on-fill is nearly constant across hues (pass once, holds for the palette)", () => {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    expect(max - min, `spread ${min.toFixed(2)}..${max.toFixed(2)}`).toBeLessThan(0.25);
  });

  it("raising the contrast knob darkens the fill (higher target)", () => {
    const hi = buildRamps({ ...themeInputs, contrast: "high" });
    expect(whiteOnFill(hi.accent[FILL_STEP])).toBeGreaterThan(ratios[0]);
  });
});
