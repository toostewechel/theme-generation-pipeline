import { describe, it, expect } from "vitest";
import { resolveContrast, targetFor } from "./contrast-input.js";

describe("resolveContrast", () => {
  it("maps word aliases to numbers", () => {
    expect(resolveContrast("low")).toBe(0.25);
    expect(resolveContrast("default")).toBe(0.5);
    expect(resolveContrast("high")).toBe(0.85);
  });

  it("passes numbers through", () => {
    expect(resolveContrast(0.63)).toBe(0.63);
  });

  it("clamps numbers to [0,1]", () => {
    expect(resolveContrast(-1)).toBe(0);
    expect(resolveContrast(5)).toBe(1);
  });
});

describe("targetFor", () => {
  it("returns the base minimum at or below default contrast", () => {
    expect(targetFor(4.5, 0.5)).toBeCloseTo(4.5, 5);
    expect(targetFor(4.5, 0.25)).toBeCloseTo(4.5, 5);
  });

  it("never drops below the base minimum", () => {
    expect(targetFor(4.5, 0)).toBeGreaterThanOrEqual(4.5);
  });

  it("raises the minimum toward 7 as contrast approaches 1", () => {
    expect(targetFor(4.5, 1)).toBeCloseTo(7, 1);
    expect(targetFor(4.5, 0.85)).toBeGreaterThan(4.5);
  });
});
