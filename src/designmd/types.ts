export interface DtcgToken {
  $type?: string;
  $value: unknown;
  $description?: string;
}

export type TokenFile = Record<string, DtcgToken>;
export type FlatTokenMap = Record<string, DtcgToken>;

export type ColorMode = "light" | "dark";
export type RadiusMode = "small" | "medium" | "large" | "full";

export interface DimensionValue {
  value: number;
  unit: string;
}

export interface SrgbColorValue {
  colorSpace: string;
  components: number[];
  alpha?: number;
}

export interface ResolvedTypography {
  fontFamily: string;
  fontWeight: number;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
}

export interface SlotProvenance {
  sourceToken: string;
  chain: string[];
  resolved: string;
}

export interface DesignMdData {
  name: string;
  mode: ColorMode;
  radiusMode: RadiusMode;
  colors: Record<string, string>;
  typography: Record<string, ResolvedTypography>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  provenance: Record<string, SlotProvenance>;
}
