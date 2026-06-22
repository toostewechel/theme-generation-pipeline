import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles } from "./dtcg.js";

export interface TokenBundle {
  manifest: { name: string; collections: Record<string, { modes: Record<string, string[]> }> };
  files: Record<string, object>;
}

// Static prism palette — verbatim from src/tokens/primitives-color.static.tokens.json.
// Carried as a passthrough so semantic retro/marker tokens (which alias {color-prism-*})
// resolve within the exported bundle. A drift-guard test asserts this matches the file.
export const STATIC_PRISM: Record<string, object> = {
  "color-prism-green": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.16470588743686676, 0.5960784554481506, 0.16862745583057404] },
  },
  "color-prism-yellow": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [1, 0.7607843279838562, 0.054901961237192154] },
  },
  "color-prism-orange": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [1, 0.5490196347236633, 0] },
  },
  "color-prism-red": {
    $type: "color",
    $value: {
      colorSpace: "srgb",
      components: [0.9843137264251709, 0.14509804546833038, 0.007843137718737125],
    },
  },
  "color-prism-magenta": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.7450980544090271, 0.03921568766236305, 0.47843137383461] },
  },
  "color-prism-purple": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.46666666865348816, 0.12156862765550613, 0.7215686440467834] },
  },
  "color-prism-blue": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.01568627543747425, 0.32156863808631897, 0.7490196228027344] },
  },
  "color-prism-cyan": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.08235294371843338, 0.6941176652908325, 0.8196078538894653] },
  },
};

// The color slice of src/tokens/manifest.json — only the collections the studio
// generates. Drift from the canonical manifest is caught by figma-export.test.ts.
export const COLOR_MANIFEST: TokenBundle["manifest"] = {
  name: "Design Tokens",
  collections: {
    "primitives-color": { modes: { "mode-1": [
      "primitives-color.mode-1.tokens.json",
      "primitives-color.static.tokens.json",
    ] } },
    color: { modes: { light: ["color.light.tokens.json"], dark: ["color.dark.tokens.json"] } },
  },
};

export function buildTokenBundle(inputs: ThemeInputs): TokenBundle {
  return {
    manifest: structuredClone(COLOR_MANIFEST),
    files: {
      ...buildGeneratedFiles(inputs),
      "primitives-color.static.tokens.json": STATIC_PRISM,
    },
  };
}

export function serializeTokenBundle(inputs: ThemeInputs): string {
  return JSON.stringify(buildTokenBundle(inputs), null, 2);
}
