import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildTokenBundle, serializeTokenBundle, COLOR_MANIFEST, STATIC_PRISM } from "./figma-export.js";
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

  it("has manifest + files with the four canonical filenames", () => {
    expect(bundle.manifest.name).toBe("Design Tokens");
    expect(Object.keys(bundle.files).sort()).toEqual([
      "color.dark.tokens.json",
      "color.light.tokens.json",
      "primitives-color.mode-1.tokens.json",
      "primitives-color.static.tokens.json",
    ]);
  });

  it("generated files equal buildGeneratedFiles, static prism carried verbatim", () => {
    const { "primitives-color.static.tokens.json": staticFile, ...generated } = bundle.files as Record<string, object>;
    expect(generated).toEqual(buildGeneratedFiles(INPUTS));
    expect(staticFile).toEqual(STATIC_PRISM);
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

  it("every semantic {ref} resolves to a primitive in the bundle", () => {
    const primNames = new Set([
      ...Object.keys(bundle.files["primitives-color.mode-1.tokens.json"] as object),
      ...Object.keys(bundle.files["primitives-color.static.tokens.json"] as object),
    ].filter((k) => k !== "$description"));
    for (const fname of ["color.light.tokens.json", "color.dark.tokens.json"]) {
      const file = bundle.files[fname] as Record<string, any>;
      for (const [name, token] of Object.entries(file)) {
        if (name === "$description") continue;
        const v = token.$value;
        if (typeof v === "string" && v.startsWith("{")) {
          const ref = v.slice(1, -1);
          expect(primNames.has(ref), `${fname} ${name} -> {${ref}} unresolved`).toBe(true);
        }
      }
    }
  });

  it("light and dark differ for at least one semantic token", () => {
    const light = bundle.files["color.light.tokens.json"] as Record<string, any>;
    const dark = bundle.files["color.dark.tokens.json"] as Record<string, any>;
    const differs = Object.keys(light).some(
      (k) => k !== "$description" && JSON.stringify(light[k]) !== JSON.stringify(dark[k]),
    );
    expect(differs).toBe(true);
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

  it("STATIC_PRISM matches src/tokens/primitives-color.static.tokens.json", () => {
    const onDisk = JSON.parse(
      readFileSync(new URL("../tokens/primitives-color.static.tokens.json", import.meta.url), "utf-8"),
    );
    expect(STATIC_PRISM).toEqual(onDisk);
  });
});
