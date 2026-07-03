import { describe, it, expect } from "vitest";
import {
  resolveToken,
  srgbToHex,
  formatPx,
  pxToRem,
  resolveTypographyStyle,
} from "./resolve.js";
import type { FlatTokenMap } from "./types.js";

const map: FlatTokenMap = {
  "neutral-800": {
    $type: "color",
    $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] },
  },
  "text-default": { $type: "color", $value: "{neutral-800}" },
  "alias-of-alias": { $type: "color", $value: "{text-default}" },
  "cycle-a": { $value: "{cycle-b}" },
  "cycle-b": { $value: "{cycle-a}" },
  dangling: { $value: "{does-not-exist}" },
};

describe("resolveToken", () => {
  it("returns a terminal token directly", () => {
    const { token, chain } = resolveToken(map, "neutral-800");
    expect(token.$type).toBe("color");
    expect(chain).toEqual(["neutral-800"]);
  });

  it("follows reference chains to the terminal token", () => {
    const { token, chain } = resolveToken(map, "alias-of-alias");
    expect(token.$value).toEqual({
      colorSpace: "srgb",
      components: [0.1, 0.2, 0.3],
    });
    expect(chain).toEqual(["alias-of-alias", "text-default", "neutral-800"]);
  });

  it("throws on missing tokens with the ref chain in the message", () => {
    expect(() => resolveToken(map, "dangling")).toThrowError(
      /dangling.*does-not-exist/s,
    );
  });

  it("throws on reference cycles", () => {
    expect(() => resolveToken(map, "cycle-a")).toThrowError(/cycle/i);
  });
});

describe("srgbToHex", () => {
  it("converts components to lowercase 6-digit hex", () => {
    expect(srgbToHex({ colorSpace: "srgb", components: [1, 1, 1] })).toBe(
      "#ffffff",
    );
    expect(srgbToHex({ colorSpace: "srgb", components: [0, 0, 0] })).toBe(
      "#000000",
    );
  });

  it("rounds channel values", () => {
    // 0.0353 * 255 = 9.0 -> 09
    expect(
      srgbToHex({ colorSpace: "srgb", components: [0.03529411926865578, 1, 0.21568627655506134] }),
    ).toBe("#09ff37");
  });

  it("appends an alpha byte when alpha < 1", () => {
    expect(
      srgbToHex({ colorSpace: "srgb", components: [0, 0, 0], alpha: 0.12999999523162842 }),
    ).toBe("#00000021");
  });

  it("omits the alpha byte when alpha is 1", () => {
    expect(
      srgbToHex({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
    ).toBe("#ffffff");
  });
});

describe("dimension formatting", () => {
  it("formats px dimensions, trimming float noise", () => {
    expect(formatPx({ value: 4, unit: "px" })).toBe("4px");
    expect(formatPx({ value: -0.3499999940395355, unit: "px" })).toBe("-0.35px");
  });

  it("converts px to rem at base 16", () => {
    expect(pxToRem({ value: 18, unit: "px" })).toBe("1.125rem");
    expect(pxToRem({ value: 64, unit: "px" })).toBe("4rem");
  });
});

describe("resolveTypographyStyle", () => {
  const typoMap: FlatTokenMap = {
    "font-family-heading": { $type: "string", $value: "Framna Serif" },
    "font-weight-medium": { $type: "number", $value: 500 },
    "font-size-1600": { $type: "dimension", $value: { value: 64, unit: "px" } },
    "font-line-height-1600": {
      $type: "dimension",
      $value: { value: 64, unit: "px" },
    },
    "font-letter-spacing-dense": {
      $type: "dimension",
      $value: { value: -0.10000000149011612, unit: "px" },
    },
    "text-heading-3xl-font-family": { $value: "{font-family-heading}" },
    "text-heading-3xl-font-weight": { $value: "{font-weight-medium}" },
    "text-heading-3xl-font-size": { $value: "{font-size-1600}" },
    "text-heading-3xl-font-line-height": { $value: "{font-line-height-1600}" },
    "text-heading-3xl-font-letter-spacing": {
      $value: "{font-letter-spacing-dense}",
    },
    "heading-3xl": {
      $type: "typography",
      $value: {
        fontFamily: "{text-heading-3xl-font-family}",
        fontWeight: "{text-heading-3xl-font-weight}",
        fontSize: "{text-heading-3xl-font-size}",
        lineHeight: "{text-heading-3xl-font-line-height}",
        letterSpacing: "{text-heading-3xl-font-letter-spacing}",
      },
    },
    "heading-display": {
      $type: "typography",
      $value: {
        fontFamily: "{text-heading-3xl-font-family}",
        fontWeight: "{text-heading-3xl-font-weight}",
        fontSizeMax: "{font-size-1600}",
        fontSizeMin: "{font-size-1600}",
        lineHeight: "{text-heading-3xl-font-line-height}",
        letterSpacing: "{text-heading-3xl-font-letter-spacing}",
      },
    },
  };

  it("resolves all five props through the ref chain", () => {
    expect(resolveTypographyStyle(typoMap, "heading-3xl")).toEqual({
      fontFamily: "Framna Serif",
      fontWeight: 500,
      fontSize: "4rem",
      lineHeight: "64px",
      letterSpacing: "-0.1px",
    });
  });

  it("throws a clear error for fluid styles without a fixed fontSize", () => {
    expect(() => resolveTypographyStyle(typoMap, "heading-display")).toThrowError(
      /fluid|fontSize/i,
    );
  });
});
