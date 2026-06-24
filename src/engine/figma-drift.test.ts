import { describe, it, expect } from "vitest";
import { diffTokenNames } from "./figma-drift.js";

describe("diffTokenNames", () => {
  it("reports no drift when name sets are identical", () => {
    const a = new Set(["color-fg-default", "color-bg-default"]);
    const report = diffTokenNames(a, new Set(a));
    expect(report.hasDrift).toBe(false);
    expect(report.matched).toEqual(["color-bg-default", "color-fg-default"]);
    expect(report.missingInPipeline).toEqual([]);
    expect(report.extraInPipeline).toEqual([]);
  });

  it("flags names present only in Figma as missingInPipeline", () => {
    const pipeline = new Set(["color-bg-default"]);
    const figma = new Set(["color-bg-default", "color-neutral-25"]);
    const report = diffTokenNames(pipeline, figma);
    expect(report.missingInPipeline).toEqual(["color-neutral-25"]);
    expect(report.hasDrift).toBe(true);
  });

  it("flags names present only in pipeline as extraInPipeline", () => {
    const pipeline = new Set(["color-bg-default", "color-bg"]);
    const figma = new Set(["color-bg-default"]);
    const report = diffTokenNames(pipeline, figma);
    expect(report.extraInPipeline).toEqual(["color-bg"]);
    expect(report.hasDrift).toBe(true);
  });

  it("excludes ignored names (string and regex) from drift", () => {
    const pipeline = new Set(["color-bg-default", "color-state-disabled-opacity"]);
    const figma = new Set(["color-bg-default", "color-prism-neon"]);
    const report = diffTokenNames(pipeline, figma, {
      ignore: ["color-state-disabled-opacity", /^color-prism-/],
    });
    expect(report.ignored).toEqual(["color-prism-neon", "color-state-disabled-opacity"]);
    expect(report.missingInPipeline).toEqual([]);
    expect(report.extraInPipeline).toEqual([]);
    expect(report.hasDrift).toBe(false);
  });

  it("returns sorted arrays", () => {
    const report = diffTokenNames(new Set(["b", "a"]), new Set(["b", "a"]));
    expect(report.matched).toEqual(["a", "b"]);
  });
});
