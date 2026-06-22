import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles } from "./dtcg.js";

export interface TokenBundle {
  manifest: { name: string; collections: Record<string, { modes: Record<string, string[]> }> };
  files: Record<string, object>;
}

// The color slice of src/tokens/manifest.json — only the collections the studio
// generates. Drift from the canonical manifest is caught by figma-export.test.ts.
export const COLOR_MANIFEST: TokenBundle["manifest"] = {
  name: "Design Tokens",
  collections: {
    "primitives-color": { modes: { "mode-1": ["primitives-color.mode-1.tokens.json"] } },
    color: { modes: { light: ["color.light.tokens.json"], dark: ["color.dark.tokens.json"] } },
  },
};

export function buildTokenBundle(inputs: ThemeInputs): TokenBundle {
  return {
    manifest: structuredClone(COLOR_MANIFEST),
    files: buildGeneratedFiles(inputs),
  };
}

export function serializeTokenBundle(inputs: ThemeInputs): string {
  return JSON.stringify(buildTokenBundle(inputs), null, 2);
}
