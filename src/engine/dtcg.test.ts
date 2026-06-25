import { describe, it, expect } from "vitest";
import { buildGeneratedFiles, buildPrimitivesDtcg, buildSemanticDtcg, BANNER } from "./dtcg.js";
import { buildRamps } from "./ramps.js";
import type { ThemeInputs } from "./types.js";

const INPUTS: ThemeInputs = {
  neutral: { hue: 70, chroma: 0.006 },
  contrast: "default",
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

describe("buildGeneratedFiles", () => {
  const files = buildGeneratedFiles(INPUTS);

  it("contains exactly the three canonical filenames", () => {
    expect(Object.keys(files).sort()).toEqual([
      "color.dark.tokens.json",
      "color.light.tokens.json",
      "primitives-color.mode-1.tokens.json",
    ]);
  });

  it("each file carries the $description banner", () => {
    for (const content of Object.values(files)) {
      expect((content as any).$description).toBe(BANNER);
    }
  });

  it("file contents equal the per-builder output (minus the banner)", () => {
    const strip = (o: Record<string, unknown>) => {
      const { $description, ...rest } = o;
      return rest;
    };
    expect(strip(files["primitives-color.mode-1.tokens.json"] as any))
      .toEqual(buildPrimitivesDtcg(INPUTS));
    expect(strip(files["color.light.tokens.json"] as any))
      .toEqual(buildSemanticDtcg(INPUTS, "light"));
    expect(strip(files["color.dark.tokens.json"] as any))
      .toEqual(buildSemanticDtcg(INPUTS, "dark"));
  });
});

const ALPHA_TWIN = /^color-(neutral|accent|secondary|tertiary|success|error|warning|info)-alpha-/;

describe("alpha-over-white twins", () => {
  it("omitted alpha → no ramp alpha twins, output unchanged", () => {
    const out = buildPrimitivesDtcg(INPUTS);
    const twins = Object.keys(out).filter((k) => ALPHA_TWIN.test(k));
    expect(twins).toEqual([]);
  });

  it("alpha:true → one twin per solid step across the 8 ramps", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true });
    const set = buildRamps({ ...INPUTS, alpha: true });
    const ramps = ["neutral", "accent", "secondary", "tertiary", "success", "error", "warning", "info"] as const;
    const expected = ramps.reduce((n, r) => n + Object.keys(set[r]).length, 0);
    const twins = Object.keys(out).filter((k) => ALPHA_TWIN.test(k));
    expect(twins.length).toBe(expected);
  });

  it("each twin carries an alpha field and oklch colorSpace", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true }) as Record<string, any>;
    const twin = out["color-accent-alpha-500"];
    expect(twin).toBeDefined();
    expect(twin.$value.colorSpace).toBe("oklch");
    expect(typeof twin.$value.alpha).toBe("number");
    expect(twin.$value.alpha).toBeGreaterThan(0);
    expect(twin.$value.alpha).toBeLessThanOrEqual(1);
  });

  it("does not add twins for darkSurface or brand", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true });
    expect(out).not.toHaveProperty("color-neutral-dark-surface-alpha-1");
    expect(out).not.toHaveProperty("color-brand-primary-alpha");
  });
});
