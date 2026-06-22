import { describe, it, expect } from "vitest";
import { oklch, formatCss } from "culori";

describe("tooling smoke test", () => {
  it("culori converts a hex to oklch", () => {
    const c = oklch("#7db664");
    expect(c).toBeDefined();
    expect(c!.mode).toBe("oklch");
    expect(c!.l).toBeGreaterThan(0);
  });

  it("culori formats an oklch color to a css string", () => {
    const css = formatCss({ mode: "oklch", l: 0.73, c: 0.12, h: 138 });
    expect(css).toContain("oklch");
  });
});
