import { describe, it, expect } from "vitest";
import { serializeConfig } from "./config-source.js";
import type { ThemeInputs } from "./types.js";

const INPUTS: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: 0.5,
  accents: { primary: { hue: 151, chroma: 0.19 } },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
};

describe("serializeConfig", () => {
  it("produces a parseable default-export module string", () => {
    const src = serializeConfig(INPUTS);
    expect(src).toContain("const themeInputs: ThemeInputs");
    expect(src).toContain("export default themeInputs;");
    expect(src).toContain('"hue": 151');
  });

  it("round-trips the numbers via the embedded JSON", () => {
    const src = serializeConfig(INPUTS);
    const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    expect(JSON.parse(json)).toEqual(INPUTS);
  });
});
