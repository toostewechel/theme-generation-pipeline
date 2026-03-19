export interface FluidRange {
  min: string;
  max: string;
}

/** Line-height: unitless number, or { min, max } unitless range for ratio shifts */
export type LineHeightConfig = number | { min: number; max: number };

export interface FluidStyleConfig {
  fontSize: FluidRange;
  lineHeight?: LineHeightConfig;
  fontFamily?: string;
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
  fontFamily?: string;
  viewports: { min: number; max: number };
}

export interface ResolvedFluidConfig {
  baseFontSize: number;
  viewports: { min: number; max: number };
  styles: Record<string, ResolvedFluidStyle>;
}

/**
 * Builds a token-name → px-value lookup from a DTCG primitives object.
 */
export function buildTokenLookup(primitives: Record<string, any>): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const [key, token] of Object.entries(primitives)) {
    if (token.$type === "dimension" && token.$value) {
      if (typeof token.$value === "object" && token.$value.value !== undefined) {
        lookup.set(key, token.$value.value);
      } else if (typeof token.$value === "number") {
        lookup.set(key, token.$value);
      }
    }
  }
  return lookup;
}

function resolveValue(value: string, lookup: Map<string, number>): number {
  const refMatch = value.match(/^\{(.+)\}$/);
  if (refMatch) {
    const px = lookup.get(refMatch[1]);
    if (px === undefined) {
      throw new Error(`Token "${refMatch[1]}" not found`);
    }
    return px;
  }
  const num = parseFloat(value);
  if (isNaN(num)) throw new Error(`Cannot parse: "${value}"`);
  return num;
}

/**
 * Resolves a fluid typography config against a token lookup.
 * Line-height is unitless and passed through directly (no token resolution).
 */
export function resolveConfig(
  config: FluidTypographyConfig,
  tokenLookup: Map<string, number>,
): ResolvedFluidConfig {
  const styles: Record<string, ResolvedFluidStyle> = {};

  for (const [name, style] of Object.entries(config.styles)) {
    const resolved: ResolvedFluidStyle = {
      fontSize: {
        minPx: resolveValue(style.fontSize.min, tokenLookup),
        maxPx: resolveValue(style.fontSize.max, tokenLookup),
      },
      viewports: style.viewports ?? config.viewports,
    };
    if (style.lineHeight !== undefined) {
      resolved.lineHeight = style.lineHeight;
    }
    if (style.fontFamily) {
      resolved.fontFamily = style.fontFamily;
    }
    styles[name] = resolved;
  }

  return {
    baseFontSize: config.baseFontSize,
    viewports: config.viewports,
    styles,
  };
}
