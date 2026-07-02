import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles, buildPrimitivesDtcg } from "./dtcg.js";
import { rgb } from "culori";

export interface TokenBundle {
  manifest: { name: string; collections: Record<string, { modes: Record<string, string[]> }> };
  files: Record<string, object>;
}

// The color slice of src/tokens/manifest.json — only the primitive collection
// the studio generates. Semantic mapping (the `color` collection) is owned in
// Figma, so it is intentionally absent here. Drift from the canonical manifest
// is caught by figma-export.test.ts.
export const COLOR_MANIFEST: TokenBundle["manifest"] = {
  name: "Design Tokens",
  collections: {
    "primitives-color": { modes: { "mode-1": [
      "primitives-color.mode-1.tokens.json",
    ] } },
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

export interface FigmaVariablePlanEntry {
  tokenKey: string;
  type: "COLOR";
  valuesByMode: { "mode-1": { r: number; g: number; b: number; a: number } };
}

export interface FigmaVariablePlan {
  collection: "primitives-color";
  modes: ["mode-1"];
  variables: FigmaVariablePlanEntry[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** OKLCH DTCG value → sRGB {r,g,b,a}, channels clamped to [0,1], alpha default 1. */
export function dtcgColorToSrgb(value: {
  colorSpace: string;
  components: number[];
  alpha?: number;
}): { r: number; g: number; b: number; a: number } {
  const [l, c, h] = value.components;
  const srgb = rgb({ mode: "oklch", l, c, h });
  return {
    r: clamp01(srgb.r),
    g: clamp01(srgb.g),
    b: clamp01(srgb.b),
    a: value.alpha ?? 1,
  };
}

/** Flat, Figma-write-ready plan for the primitives-color collection. */
export function buildFigmaVariablePlan(inputs: ThemeInputs): FigmaVariablePlan {
  const primitives = buildPrimitivesDtcg(inputs) as Record<
    string,
    { $value: { colorSpace: string; components: number[]; alpha?: number } }
  >;
  const variables: FigmaVariablePlanEntry[] = Object.entries(primitives).map(
    ([tokenKey, token]) => ({
      tokenKey,
      type: "COLOR",
      valuesByMode: { "mode-1": dtcgColorToSrgb(token.$value) },
    }),
  );
  return { collection: "primitives-color", modes: ["mode-1"], variables };
}
