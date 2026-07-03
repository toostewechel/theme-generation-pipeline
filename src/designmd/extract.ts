import {
  COLOR_SLOTS,
  ROUNDED_SLOTS,
  SPACING_SLOTS,
  TYPOGRAPHY_SLOTS,
} from "./mapping.js";
import { formatPx, resolveToken, resolveTypographyStyle, srgbToHex } from "./resolve.js";
import type {
  ColorMode,
  DesignMdData,
  DimensionValue,
  FlatTokenMap,
  RadiusMode,
  SlotProvenance,
  SrgbColorValue,
} from "./types.js";

export interface ExtractOptions {
  name: string;
  mode: ColorMode;
  radiusMode: RadiusMode;
}

export function extractDesignMdData(
  map: FlatTokenMap,
  opts: ExtractOptions,
): DesignMdData {
  const provenance: Record<string, SlotProvenance> = {};

  const record = (
    slot: string,
    sourceToken: string,
    chain: string[],
    resolved: string,
  ): string => {
    provenance[slot] = { sourceToken, chain, resolved };
    return resolved;
  };

  const colors: Record<string, string> = {};
  for (const [slot, name] of Object.entries(COLOR_SLOTS)) {
    const { token, chain } = resolveToken(map, name);
    if (token.$type !== "color") {
      throw new Error(`colors.${slot}: "${name}" resolved to $type "${token.$type}", expected color`);
    }
    colors[slot] = record(
      `colors.${slot}`,
      name,
      chain,
      srgbToHex(token.$value as SrgbColorValue),
    );
  }

  const typography: DesignMdData["typography"] = {};
  for (const [slot, name] of Object.entries(TYPOGRAPHY_SLOTS)) {
    const style = resolveTypographyStyle(map, name);
    typography[slot] = style;
    provenance[`typography.${slot}`] = {
      sourceToken: name,
      chain: [name],
      resolved: `${style.fontFamily} ${style.fontSize}/${style.lineHeight} w${style.fontWeight}`,
    };
  }

  const dimensionSlot = (slot: string, name: string): string => {
    const { token, chain } = resolveToken(map, name);
    return record(slot, name, chain, formatPx(token.$value as DimensionValue));
  };

  const spacing: Record<string, string> = {};
  for (const [slot, name] of Object.entries(SPACING_SLOTS)) {
    spacing[slot] = dimensionSlot(`spacing.${slot}`, name);
  }

  const rounded: Record<string, string> = {};
  for (const [slot, name] of Object.entries(ROUNDED_SLOTS)) {
    rounded[slot] = dimensionSlot(`rounded.${slot}`, name);
  }

  return {
    name: opts.name,
    mode: opts.mode,
    radiusMode: opts.radiusMode,
    colors,
    typography,
    rounded,
    spacing,
    provenance,
  };
}
