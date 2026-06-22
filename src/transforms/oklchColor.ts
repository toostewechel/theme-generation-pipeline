import { oklch, clampChroma } from "culori";

interface DtcgColorValue {
  colorSpace: string;
  components: number[];
  alpha?: number;
}

/** Convert a DTCG color value (oklch or srgb components) to a culori oklch color. */
export function dtcgToCulori(value: DtcgColorValue) {
  const [a, b, c] = value.components;
  if (value.colorSpace === "oklch") {
    return clampChroma({ mode: "oklch", l: a, c: b, h: c }, "oklch", "p3");
  }
  // srgb (and anything else culori understands via rgb components)
  const conv = oklch({ mode: "rgb", r: a, g: b, b: c });
  return clampChroma({ mode: "oklch", l: conv!.l, c: conv!.c ?? 0, h: conv!.h ?? 0 }, "oklch", "p3");
}

const r = (n: number, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Format a DTCG color value as a CSS oklch() string. */
export function formatOklch(value: DtcgColorValue): string {
  const c = dtcgToCulori(value);
  const l = r(c.l);
  const ch = r(c.c ?? 0);
  const h = r(c.h ?? 0, 2);
  const alpha = value.alpha === undefined ? undefined : r(value.alpha);
  return alpha === undefined
    ? `oklch(${l} ${ch} ${h})`
    : `oklch(${l} ${ch} ${h} / ${alpha})`;
}

/** Style Dictionary transform object. */
export const oklchCssTransform = {
  name: "oklch/css",
  type: "value" as const,
  transitive: true,
  filter: (token: any) =>
    token.$type === "color" &&
    typeof token.$value === "object" &&
    token.$value?.components !== undefined,
  transform: (token: any) => formatOklch(token.$value as DtcgColorValue),
};
