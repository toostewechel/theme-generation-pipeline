import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Guard: the pure engine modules must not import Node-only APIs.
const PURE = [
  "types.ts", "contrast-input.ts", "steps.ts", "ramps.ts",
  "contrast.ts", "derived.ts", "semantics.ts", "index.ts",
];

describe("engine isomorphism", () => {
  for (const file of PURE) {
    it(`${file} has no node-only imports`, () => {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf-8");
      expect(src).not.toMatch(/from\s+["']node:/);
      expect(src).not.toMatch(/from\s+["']fs["']/);
      expect(src).not.toMatch(/from\s+["']path["']/);
      expect(src).not.toMatch(/require\(["'](fs|path|node:)/);
    });
  }
});
