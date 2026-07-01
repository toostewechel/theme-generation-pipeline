import { describe, it, expect } from "vitest";
import { buildGeneratedFiles, buildPrimitivesDtcg, BANNER } from "./dtcg.js";
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

  it("contains exactly the one canonical filename", () => {
    expect(Object.keys(files).sort()).toEqual([
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

  it("rounds emitted alpha to at most 4 decimal places", () => {
    const out = buildPrimitivesDtcg({ ...INPUTS, alpha: true }) as Record<string, any>;
    const alpha = out["color-accent-alpha-500"].$value.alpha;
    expect(alpha).toBe(Math.round(alpha * 1e4) / 1e4);
  });
});

describe("buildPrimitivesDtcg — variable accents", () => {
  const ONE = { ...INPUTS, accents: { primary: INPUTS.accents.primary } };

  it("omits secondary/tertiary ramp tokens when only primary is present", () => {
    const out = buildPrimitivesDtcg(ONE);
    expect(out["color-accent-500"]).toBeDefined();
    expect(out["color-secondary-500"]).toBeUndefined();
    expect(out["color-tertiary-500"]).toBeUndefined();
  });

  it("omits brand tokens for absent accent slots", () => {
    const out = buildPrimitivesDtcg(ONE);
    expect(out["color-brand-primary"]).toBeDefined();
    expect(out["color-brand-secondary"]).toBeUndefined();
    expect(out["color-brand-tertiary"]).toBeUndefined();
  });

  it("omits alpha twins for absent accent ramps", () => {
    const out = buildPrimitivesDtcg({ ...ONE, alpha: true });
    expect(out["color-accent-alpha-500"]).toBeDefined();
    expect(out["color-secondary-alpha-500"]).toBeUndefined();
    expect(out["color-tertiary-alpha-500"]).toBeUndefined();
  });
});
