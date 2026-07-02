import { describe, it, expect } from "vitest";
import { hexToOklch, hexToHueSeed } from "./hex-input.js";

describe("hexToOklch", () => {
  it("converts a green hex to full-precision OKLCH", () => {
    const o = hexToOklch("#16a34a");
    expect(o.l).toBeCloseTo(0.627052, 4);
    expect(o.c).toBeCloseTo(0.169912, 4);
    expect(o.h).toBeCloseTo(149.213796, 3);
  });

  it("converts a blue hex to full-precision OKLCH", () => {
    const o = hexToOklch("#2563eb");
    expect(o.l).toBeCloseTo(0.54615, 4);
    expect(o.c).toBeCloseTo(0.215208, 4);
    expect(o.h).toBeCloseTo(262.880919, 3);
  });

  it("returns hue 0 and chroma 0 for pure gray", () => {
    const o = hexToOklch("#808080");
    expect(o.c).toBeCloseTo(0, 4);
    expect(o.h).toBe(0);
  });

  it("throws on an unparseable string", () => {
    expect(() => hexToOklch("not-a-color")).toThrow();
  });
});

describe("hexToHueSeed", () => {
  it("returns the hue and chroma of the hex", () => {
    const s = hexToHueSeed("#16a34a");
    expect(s.hue).toBeCloseTo(149.213796, 3);
    expect(s.chroma).toBeCloseTo(0.169912, 4);
  });
});
