import { describe, it, expect } from "vitest";
import { formatOklch, dtcgToCulori } from "./oklchColor.js";

describe("dtcgToCulori", () => {
  it("parses an oklch component value", () => {
    const c = dtcgToCulori({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(c).toMatchObject({ mode: "oklch", l: 0.5, c: 0.1, h: 138 });
  });
  it("parses an srgb component value (prism passthrough)", () => {
    const c = dtcgToCulori({ colorSpace: "srgb", components: [0.165, 0.596, 0.169] });
    expect(c.mode).toBe("oklch");
    expect(c.l).toBeGreaterThan(0);
  });
});

describe("formatOklch", () => {
  it("formats without alpha", () => {
    const css = formatOklch({ colorSpace: "oklch", components: [0.5, 0.1, 138] });
    expect(css).toMatch(/^oklch\(0\.5 0\.1 138\)$/);
  });
  it("formats with alpha", () => {
    const css = formatOklch({ colorSpace: "oklch", components: [0.13, 0, 0], alpha: 0.12 });
    expect(css).toMatch(/\/ 0\.12\)$/);
  });
});
