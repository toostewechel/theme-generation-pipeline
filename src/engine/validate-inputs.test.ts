import { describe, it, expect } from "vitest";
import { validateInputs } from "./validate-inputs.js";
import type { ThemeInputs } from "./types.js";

const OK: ThemeInputs = {
  neutral: { hue: 208, chroma: 0.01 },
  contrast: "default",
  accents: { primary: { hue: 151, chroma: 0.19 } },
  status: {
    success: { hue: 148, chroma: 0.18 },
    error: { hue: 40, chroma: 0.185 },
    warning: { hue: 65, chroma: 0.195 },
    info: { hue: 229, chroma: 0.17 },
  },
};

describe("validateInputs", () => {
  it("accepts a complete, in-range input", () => {
    expect(validateInputs(OK)).toEqual({ ok: true });
  });

  it("accepts a numeric contrast in [0,1]", () => {
    expect(validateInputs({ ...OK, contrast: 0.5 })).toEqual({ ok: true });
  });

  it("rejects an out-of-range hue", () => {
    const r = validateInputs({ ...OK, neutral: { hue: 400, chroma: 0.01 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/hue/);
  });

  it("rejects a negative chroma", () => {
    const r = validateInputs({ ...OK, accents: { primary: { hue: 151, chroma: -0.1 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/chroma/);
  });

  it("rejects an out-of-range numeric contrast", () => {
    const r = validateInputs({ ...OK, contrast: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/contrast/);
  });

  it("rejects a missing required status seed", () => {
    const bad = { ...OK, status: { ...OK.status } } as ThemeInputs;
    // @ts-expect-error deliberately drop a required seed
    delete bad.status.error;
    const r = validateInputs(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/error/);
  });
});
