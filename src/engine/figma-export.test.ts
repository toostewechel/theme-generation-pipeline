import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildTokenBundle, serializeTokenBundle, COLOR_MANIFEST } from "./figma-export.js";
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
