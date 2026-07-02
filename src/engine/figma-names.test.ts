import { describe, it, expect } from "vitest";
import { normalizeName } from "./figma-names.js";

describe("normalizeName", () => {
  it("maps a slash path to the flat token key", () => {
    expect(normalizeName("color/neutral/700")).toBe("color-neutral-700");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("Color / Neutral / 700")).toBe("color-neutral-700");
  });

  it("leaves an already-flat key unchanged", () => {
    expect(normalizeName("color-accent-500")).toBe("color-accent-500");
  });

  it("collapses repeated separators and trims", () => {
    expect(normalizeName("/color//neutral/dark-surface/3/")).toBe("color-neutral-dark-surface-3");
  });
});
