import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGeneratedTokens } from "./emit-dtcg.js";
import themeInputs from "../../theme.config.js";

describe("writeGeneratedTokens (the core of build:theme)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "theme-"));
    writeGeneratedTokens(themeInputs, dir);
  });

  it("writes the three generated color files", () => {
    expect(existsSync(join(dir, "primitives-color.mode-1.tokens.json"))).toBe(true);
    expect(existsSync(join(dir, "color.light.tokens.json"))).toBe(true);
    expect(existsSync(join(dir, "color.dark.tokens.json"))).toBe(true);
  });

  it("primitives file contains an oklch color value", () => {
    const prims = JSON.parse(readFileSync(join(dir, "primitives-color.mode-1.tokens.json"), "utf-8"));
    expect(prims["color-accent-500"].$value.colorSpace).toBe("oklch");
  });

  it("light semantics reference primitives (lean tokens)", () => {
    const light = JSON.parse(readFileSync(join(dir, "color.light.tokens.json"), "utf-8"));
    expect(light["color-bg"].$value).toBe("{color-neutral-0}");
    expect(light["color-action-primary-background"]).toBeUndefined(); // legacy dropped
  });
});
