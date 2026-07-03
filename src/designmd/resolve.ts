import type {
  DimensionValue,
  DtcgToken,
  FlatTokenMap,
  ResolvedTypography,
  SrgbColorValue,
} from "./types.js";

const REF_RE = /^\{(.+)\}$/;

export function resolveToken(
  map: FlatTokenMap,
  name: string,
): { token: DtcgToken; chain: string[] } {
  const chain: string[] = [];
  let current = name;
  for (;;) {
    if (chain.includes(current)) {
      throw new Error(
        `Reference cycle while resolving "${name}": ${[...chain, current].join(" -> ")}`,
      );
    }
    chain.push(current);
    const token = map[current];
    if (!token) {
      throw new Error(
        `Unresolved token reference: ${chain.join(" -> ")} ("${current}" not found)`,
      );
    }
    const ref = typeof token.$value === "string" && REF_RE.exec(token.$value);
    if (!ref) return { token, chain };
    current = ref[1];
  }
}

function resolveValue(map: FlatTokenMap, value: unknown): unknown {
  const ref = typeof value === "string" && REF_RE.exec(value);
  if (!ref) return value;
  return resolveToken(map, ref[1]).token.$value;
}

export function srgbToHex(color: SrgbColorValue): string {
  const byte = (n: number): string =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  const [r, g, b] = color.components;
  let hex = `#${byte(r)}${byte(g)}${byte(b)}`;
  if (color.alpha !== undefined && color.alpha < 1) hex += byte(color.alpha);
  return hex;
}

function trimFloat(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function formatPx(dim: DimensionValue): string {
  return `${trimFloat(dim.value)}px`;
}

export function pxToRem(dim: DimensionValue): string {
  return `${trimFloat(dim.value / 16)}rem`;
}

function asDimension(value: unknown, context: string): DimensionValue {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DimensionValue).value === "number"
  ) {
    return value as DimensionValue;
  }
  throw new Error(`Expected a dimension value for ${context}, got ${JSON.stringify(value)}`);
}

export function resolveTypographyStyle(
  map: FlatTokenMap,
  styleName: string,
): ResolvedTypography {
  const { token } = resolveToken(map, styleName);
  const props = token.$value as Record<string, unknown>;
  if (typeof props !== "object" || props === null || !("fontSize" in props)) {
    throw new Error(
      `Typography style "${styleName}" has no fixed fontSize (fluid styles are not supported in design.md)`,
    );
  }
  const fontFamilyRaw = resolveValue(map, props.fontFamily);
  const fontFamily = Array.isArray(fontFamilyRaw)
    ? fontFamilyRaw.join(", ")
    : String(fontFamilyRaw);
  const fontWeight = Number(resolveValue(map, props.fontWeight));
  const fontSize = pxToRem(
    asDimension(resolveValue(map, props.fontSize), `${styleName}.fontSize`),
  );
  const lineHeight = formatPx(
    asDimension(resolveValue(map, props.lineHeight), `${styleName}.lineHeight`),
  );
  const letterSpacing = formatPx(
    asDimension(
      resolveValue(map, props.letterSpacing),
      `${styleName}.letterSpacing`,
    ),
  );
  return { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing };
}
