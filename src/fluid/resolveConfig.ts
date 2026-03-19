import { readFileSync, existsSync } from "fs";
import { glob } from "fs/promises";

export interface FluidRange {
  min: string;
  max: string;
}

/** Line-height: unitless number, or { min, max } unitless range for ratio shifts */
export type LineHeightConfig = number | { min: number; max: number };

export interface FluidStyleConfig {
  fontSize: FluidRange;
  lineHeight?: LineHeightConfig;
  viewports?: { min: number; max: number };
}

export interface FluidTypographyConfig {
  baseFontSize: number;
  viewports: { min: number; max: number };
  styles: Record<string, FluidStyleConfig>;
}

export interface ResolvedFluidRange {
  minPx: number;
  maxPx: number;
}

/** Resolved line-height: unitless number, or unitless range */
export type ResolvedLineHeight = number | { min: number; max: number };

export interface ResolvedFluidStyle {
  fontSize: ResolvedFluidRange;
  lineHeight?: ResolvedLineHeight;
  viewports: { min: number; max: number };
}

export interface ResolvedFluidConfig {
  baseFontSize: number;
  viewports: { min: number; max: number };
  styles: Record<string, ResolvedFluidStyle>;
}

/**
 * Builds a lookup map from token name to pixel value by reading
 * DTCG-format primitive token files.
 */
function buildTokenLookup(tokenFilePaths: string[]): Map<string, number> {
  const lookup = new Map<string, number>();

  for (const filePath of tokenFilePaths) {
    if (!existsSync(filePath)) continue;
    const content = JSON.parse(readFileSync(filePath, "utf-8"));

    for (const [key, token] of Object.entries(content)) {
      const t = token as any;
      if (t.$type === "dimension" && t.$value) {
        // DTCG dimension format: { value: number, unit: "px" }
        if (typeof t.$value === "object" && t.$value.value !== undefined) {
          lookup.set(key, t.$value.value);
        } else if (typeof t.$value === "number") {
          lookup.set(key, t.$value);
        }
      }
    }
  }

  return lookup;
}

/**
 * Resolves a token reference or raw px value to a number.
 * Accepts: "{font-size-1200}" or "14px" or "14"
 */
function resolveValue(
  value: string,
  tokenLookup: Map<string, number>,
): number {
  // Token reference: {token-name}
  const refMatch = value.match(/^\{(.+)\}$/);
  if (refMatch) {
    const tokenName = refMatch[1];
    const px = tokenLookup.get(tokenName);
    if (px === undefined) {
      throw new Error(`Token reference "${tokenName}" not found in primitives`);
    }
    return px;
  }

  // Raw px value: "14px" or "14"
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`Cannot parse value: "${value}"`);
  }
  return num;
}

function resolveRange(
  range: FluidRange,
  tokenLookup: Map<string, number>,
): ResolvedFluidRange {
  return {
    minPx: resolveValue(range.min, tokenLookup),
    maxPx: resolveValue(range.max, tokenLookup),
  };
}

export interface ResolveOptions {
  configPath: string;
  primitivesGlob: string;
}

/**
 * Reads the fluid typography config and resolves all token references
 * to pixel values. Line-height values are unitless and passed through as-is.
 */
export async function resolveFluidConfig(
  options: ResolveOptions,
): Promise<ResolvedFluidConfig | null> {
  const { configPath, primitivesGlob } = options;

  if (!existsSync(configPath)) {
    return null;
  }

  const config: FluidTypographyConfig = JSON.parse(
    readFileSync(configPath, "utf-8"),
  );

  // Find all primitive font token files matching the glob
  const tokenFiles: string[] = [];
  for await (const entry of glob(primitivesGlob)) {
    tokenFiles.push(entry);
  }

  const tokenLookup = buildTokenLookup(tokenFiles);

  const resolvedStyles: Record<string, ResolvedFluidStyle> = {};
  for (const [styleName, style] of Object.entries(config.styles)) {
    const resolved: ResolvedFluidStyle = {
      fontSize: resolveRange(style.fontSize, tokenLookup),
      viewports: style.viewports ?? config.viewports,
    };
    // Line-height is unitless — pass through directly (no token resolution)
    if (style.lineHeight !== undefined) {
      resolved.lineHeight = style.lineHeight;
    }
    resolvedStyles[styleName] = resolved;
  }

  return {
    baseFontSize: config.baseFontSize,
    viewports: config.viewports,
    styles: resolvedStyles,
  };
}
