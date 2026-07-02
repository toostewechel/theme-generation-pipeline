import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildTokenBundle, serializeTokenBundle, COLOR_MANIFEST, buildFigmaVariablePlan, dtcgColorToSrgb } from "./figma-export.js";
import { buildGeneratedFiles } from "./dtcg.js";
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

describe("buildTokenBundle", () => {
  const bundle = buildTokenBundle(INPUTS);

  it("has manifest + files with the single primitives filename", () => {
    expect(bundle.manifest.name).toBe("Design Tokens");
    expect(Object.keys(bundle.files).sort()).toEqual([
      "primitives-color.mode-1.tokens.json",
    ]);
  });

  it("generated files equal buildGeneratedFiles", () => {
    expect(bundle.files).toEqual(buildGeneratedFiles(INPUTS));
  });

  it("manifest is a subset of the canonical src/tokens/manifest.json (drift guard)", () => {
    const canonical = JSON.parse(
      readFileSync(new URL("../tokens/manifest.json", import.meta.url), "utf-8"),
    );
    for (const [coll, def] of Object.entries(COLOR_MANIFEST.collections)) {
      const canonColl = canonical.collections[coll];
      expect(canonColl, `collection ${coll} missing from manifest.json`).toBeDefined();
      for (const [modeName, fileList] of Object.entries(def.modes)) {
        const canonFiles: string[] = canonColl.modes[modeName];
        expect(canonFiles, `mode ${coll}/${modeName} missing`).toBeDefined();
        for (const f of fileList) expect(canonFiles).toContain(f);
      }
    }
  });

  it("export manifest intentionally omits the semantic color collection", () => {
    expect(COLOR_MANIFEST.collections).not.toHaveProperty("color");
  });

  it("no color value in any file is a hex string (exporter does no conversion)", () => {
    for (const file of Object.values(bundle.files)) {
      for (const [name, token] of Object.entries(file as Record<string, any>)) {
        if (name === "$description") continue;
        expect(typeof token.$value === "string" && token.$value.startsWith("#")).toBe(false);
      }
    }
  });

  it("serializeTokenBundle returns pretty-printed JSON of the bundle", () => {
    expect(serializeTokenBundle(INPUTS)).toBe(JSON.stringify(bundle, null, 2));
  });
});

describe("dtcgColorToSrgb", () => {
  it("converts an OKLCH value to clamped sRGB with default alpha 1", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(c.r).toBeCloseTo(0.271255, 4);
    expect(c.g).toBeCloseTo(0.440745, 4);
    expect(c.b).toBeCloseTo(0.210346, 4);
    expect(c.a).toBe(1);
  });

  it("passes alpha through", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.13, 0, 0], alpha: 0.12 });
    expect(c.a).toBeCloseTo(0.12, 4);
    expect(c.r).toBeCloseTo(0.028385, 4);
  });

  it("clamps out-of-sRGB-gamut channels into [0,1]", () => {
    const c = dtcgColorToSrgb({ colorSpace: "oklch", components: [0.99, 0.01, 208] });
    expect(c.b).toBe(1);
    for (const ch of [c.r, c.g, c.b]) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildFigmaVariablePlan", () => {
  const plan = buildFigmaVariablePlan(INPUTS);

  it("targets the primitives-color collection, mode-1 only", () => {
    expect(plan.collection).toBe("primitives-color");
    expect(plan.modes).toEqual(["mode-1"]);
  });

  it("emits one entry per primitive token, flat keys, all COLOR", () => {
    const keys = plan.variables.map((v) => v.tokenKey);
    expect(keys).toContain("color-accent-500");
    expect(keys).toContain("color-neutral-700");
    expect(keys.every((k) => !k.includes("/"))).toBe(true);
    expect(plan.variables.every((v) => v.type === "COLOR")).toBe(true);
  });

  it("every value is sRGB in [0,1] with an alpha", () => {
    for (const v of plan.variables) {
      const c = v.valuesByMode["mode-1"];
      for (const ch of [c.r, c.g, c.b, c.a]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });
});
