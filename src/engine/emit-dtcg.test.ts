import { describe, it, expect } from "vitest";
import { oklchToDtcg, buildPrimitivesDtcg, buildSemanticDtcg } from "./emit-dtcg.js";
import themeInputs from "../../theme.config.js";

describe("oklchToDtcg", () => {
  it("emits a DTCG oklch color object", () => {
    const t = oklchToDtcg({ l: 0.5, c: 0.1, h: 138 });
    expect(t).toMatchObject({ $type: "color", $value: { colorSpace: "oklch" } });
    expect((t as any).$value.components).toEqual([0.5, 0.1, 138]);
  });
  it("includes alpha when present", () => {
    const t = oklchToDtcg({ l: 0.13, c: 0, h: 0, alpha: 0.12 });
    expect((t as any).$value.alpha).toBe(0.12);
  });
});

describe("buildPrimitivesDtcg", () => {
  const prims = buildPrimitivesDtcg(themeInputs);
  it("includes generated ramp, alpha and dark-surface tokens with frozen names", () => {
    expect(prims["color-neutral-0"]).toBeDefined();
    expect(prims["color-accent-500"]).toBeDefined();
    expect(prims["color-sky-500"]).toBeDefined();
    expect(prims["color-success-500"]).toBeDefined();
    expect(prims["color-black-alpha-12"]).toBeDefined();
    expect(prims["color-white-alpha-transparant"]).toBeDefined();
    expect(prims["color-neutral-dark-surface-2"]).toBeDefined();
  });
  it("does NOT include prism (static passthrough)", () => {
    expect(prims["color-prism-green"]).toBeUndefined();
  });
});

describe("buildSemanticDtcg", () => {
  it("emits reference values for semantic tokens", () => {
    const light = buildSemanticDtcg(themeInputs, "light");
    expect(light["color-background-surface-default"].$value).toBe("{color-neutral-0}");
  });
  it("emits raw DTCG dimension token verbatim for color-state-disabled-opacity (light)", () => {
    const light = buildSemanticDtcg(themeInputs, "light");
    expect(light["color-state-disabled-opacity"]).toEqual({
      $type: "dimension",
      $value: { value: 0.5, unit: "px" },
      $description: "unitless",
    });
  });
  it("emits per-mode raw value for color-state-hover-intensity (dark)", () => {
    const dark = buildSemanticDtcg(themeInputs, "dark");
    expect(dark["color-state-hover-intensity"].$value.value).toBe(1.0499999523162842);
  });
});
