import { describe, it, expect } from "vitest";
import { loadTokenMap } from "./load-tokens.js";
import { resolveToken } from "./resolve.js";

describe("loadTokenMap (real repo tokens)", () => {
  const light = loadTokenMap({ colorMode: "light", radiusMode: "medium" });

  it("merges semantic color, primitives, text styles and spacing", () => {
    expect(light["text-default"]).toBeDefined();
    expect(light["neutral-800"]).toBeDefined();
    expect(light["space-400"]).toBeDefined();
    expect(light["heading-3xl"]).toBeDefined();
    expect(light["font-family-heading"]).toBeDefined();
  });

  it("prefixes radius tokens with radius- per the chosen radius mode", () => {
    expect(light["radius-1"]).toBeDefined();
    expect(light["1"]).toBeUndefined();
    expect(light["radius-1"].$value).toEqual({ value: 3, unit: "px" });
  });

  it("selects radius values by radius mode", () => {
    const full = loadTokenMap({ colorMode: "light", radiusMode: "full" });
    expect(full["radius-1"].$value).not.toEqual(light["radius-1"].$value);
  });

  it("selects color values by color mode", () => {
    const dark = loadTokenMap({ colorMode: "dark", radiusMode: "medium" });
    const lightBg = resolveToken(light, "bg-default-default").token.$value;
    const darkBg = resolveToken(dark, "bg-default-default").token.$value;
    expect(lightBg).not.toEqual(darkBg);
  });

  it("resolves semantic color refs down to srgb primitives", () => {
    const { token } = resolveToken(light, "text-default");
    expect(token.$type).toBe("color");
    expect((token.$value as { colorSpace: string }).colorSpace).toBe("srgb");
  });
});
