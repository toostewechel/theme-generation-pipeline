import { describe, it, expect } from "vitest";
import { hexOf, parseHex, nearestAlias, CONTRAST_ALIASES, hueTrack, chromaTrack } from "./controls-math.js";

describe("parseHex", () => {
  it("parses a valid hex into hue/chroma/l", () => {
    const p = parseHex("#3aa06a");
    expect(p).not.toBeNull();
    expect(p!.hue).toBeGreaterThan(120);
    expect(p!.hue).toBeLessThan(170);
    expect(p!.chroma).toBeGreaterThan(0);
  });
  it("snaps chroma to CHROMA_STEP and clamps to CHROMA_MAX", () => {
    const p = parseHex("#00ff00")!;
    expect(Math.round(p.chroma / 0.005)).toBeCloseTo(p.chroma / 0.005, 5);
    expect(p.chroma).toBeLessThanOrEqual(0.3);
  });
  it("returns null for garbage", () => {
    expect(parseHex("not-a-color")).toBeNull();
  });
});

describe("hexOf", () => {
  it("round-trips through parseHex within hue tolerance", () => {
    const hex = hexOf(150, 0.16, 0.62);
    const p = parseHex(hex)!;
    expect(Math.abs(p.hue - 150)).toBeLessThanOrEqual(2);
  });
});

describe("nearestAlias", () => {
  it("maps values to the nearest named alias", () => {
    expect(nearestAlias(0.0)).toBe("low");
    expect(nearestAlias(0.5)).toBe("default");
    expect(nearestAlias(0.95)).toBe("high");
  });
  it("exposes the three aliases", () => {
    expect(CONTRAST_ALIASES.map((a) => a[0])).toEqual(["low", "default", "high"]);
  });
});

describe("tracks", () => {
  it("hueTrack is a linear-gradient string", () => {
    expect(hueTrack()).toContain("linear-gradient");
  });
  it("chromaTrack embeds the hue", () => {
    expect(chromaTrack(150)).toContain("150");
  });
});
