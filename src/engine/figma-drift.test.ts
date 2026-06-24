import { describe, it, expect } from "vitest";
import { diffTokenNames, collectTokenNames, namesFromBundle, namesFromManifest } from "./figma-drift.js";
import type { TokenBundle } from "./figma-export.js";

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

describe("collectTokenNames", () => {
  it("collects flat token keys and skips $-metadata", () => {
    const names = new Set<string>();
    collectTokenNames(
      {
        $description: "auto-generated",
        "color-neutral-0": { $type: "color", $value: {} },
        "color-bg-default": { $value: "{color-neutral-0}" },
      },
      names,
    );
    expect([...names].sort()).toEqual(["color-bg-default", "color-neutral-0"]);
  });

  it("joins nested group paths with a hyphen (defensive)", () => {
    const names = new Set<string>();
    collectTokenNames({ color: { neutral: { "700": { $value: {} } } } }, names);
    expect([...names]).toEqual(["color-neutral-700"]);
  });
});

describe("namesFromBundle", () => {
  it("unions token names across all files", () => {
    const bundle: TokenBundle = {
      manifest: { name: "x", collections: {} },
      files: {
        "a.json": { "color-bg-default": { $value: {} } },
        "b.json": { $description: "meta", "radius-intensity": { $type: "dimension", $value: {} } },
      },
    };
    expect([...namesFromBundle(bundle)].sort()).toEqual(["color-bg-default", "radius-intensity"]);
  });
});

describe("namesFromManifest (real committed tokens)", () => {
  const names = namesFromManifest("src/tokens");

  it("includes semantic, primitive, and non-color collection names", () => {
    expect(names.has("color-bg-default")).toBe(true);
    expect(names.has("color-neutral-0")).toBe(true);
    expect(names.has("radius-intensity")).toBe(true);
  });

  it("excludes $-metadata keys", () => {
    expect(names.has("$description")).toBe(false);
  });
});
