import { describe, it, expect } from "vitest";
import { serializeConfig } from "./serialize.js";

describe("serializeConfig", () => {
  const inputs = {
    neutral: { hue: 70, chroma: 0.006 },
    contrast: 0.5,
    accents: {
      primary: { hue: 138, chroma: 0.12 },
      secondary: { hue: 220, chroma: 0.11 },
      tertiary: { hue: 330, chroma: 0.1 },
    },
    status: {
      success: { hue: 150, chroma: 0.12 },
      error: { hue: 25, chroma: 0.17 },
      warning: { hue: 70, chroma: 0.15 },
      info: { hue: 240, chroma: 0.12 },
    },
  };

  it("produces a parseable default-export module string", () => {
    const src = serializeConfig(inputs);
    expect(src).toContain("const themeInputs: ThemeInputs");
    expect(src).toContain("export default themeInputs;");
    expect(src).toContain('"hue": 138');
  });

  it("round-trips the numbers via JSON embedded in the source", () => {
    const src = serializeConfig(inputs);
    const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    expect(JSON.parse(json).accents.primary.hue).toBe(138);
  });

  it("persists the alpha flag when enabled", () => {
    const base = { neutral: { hue: 70, chroma: 0.006 }, contrast: "default",
      accents: { primary: { hue: 138, chroma: 0.12 }, secondary: { hue: 220, chroma: 0.11 }, tertiary: { hue: 330, chroma: 0.1 } },
      status: { success: { hue: 150, chroma: 0.12 }, error: { hue: 25, chroma: 0.17 }, warning: { hue: 70, chroma: 0.15 }, info: { hue: 240, chroma: 0.12 } },
      alpha: true } as const;
    const out = serializeConfig(base as any);
    expect(out).toContain('"alpha": true');
  });
});
