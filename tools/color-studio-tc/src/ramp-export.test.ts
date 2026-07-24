import { describe, it, expect } from "vitest";
import { rampToHexMap } from "./ramp-export.js";
import type { Oklch } from "@project/src/engine/index.js";

describe("rampToHexMap", () => {
  const solid: Record<string, Oklch> = {
    "0": { l: 1, c: 0, h: 0 },
    "500": { l: 0.55, c: 0.2, h: 250 },
  };

  it("emits 6-digit hex for solid ramps", () => {
    const out = rampToHexMap(solid, { alpha: false });
    expect(out["0"]).toBe("#ffffff");
    expect(out["500"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("emits 8-digit hex for alpha ramps", () => {
    const alpha: Record<string, Oklch> = {
      "100": { l: 0.55, c: 0.2, h: 250, alpha: 0.5 },
    };
    const out = rampToHexMap(alpha, { alpha: true });
    expect(out["100"]).toMatch(/^#[0-9a-f]{8}$/);
  });

  it("preserves step order", () => {
    expect(Object.keys(rampToHexMap(solid, { alpha: false }))).toEqual(["0", "500"]);
  });
});
