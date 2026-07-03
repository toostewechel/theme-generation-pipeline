import { describe, it, expect } from "vitest";
import { extractDesignMdData } from "./extract.js";
import { loadTokenMap } from "./load-tokens.js";

describe("extractDesignMdData (real repo tokens)", () => {
  const map = loadTokenMap({ colorMode: "light", radiusMode: "medium" });
  const data = extractDesignMdData(map, {
    name: "Framna",
    mode: "light",
    radiusMode: "medium",
  });

  it("resolves every color slot to a hex value", () => {
    for (const [slot, hex] of Object.entries(data.colors)) {
      expect(hex, `colors.${slot}`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
    expect(Object.keys(data.colors)).toEqual([
      "primary",
      "secondary",
      "tertiary",
      "neutral",
      "surface",
      "accent-secondary",
      "on-accent",
      "border",
    ]);
  });

  it("resolves typography slots with Framna fonts", () => {
    expect(data.typography.h1.fontFamily).toBe("Framna Serif");
    expect(data.typography.h1.fontSize).toBe("4rem");
    expect(data.typography["body-md"].fontFamily).toBe("Framna Sans");
    expect(data.typography["body-md"].fontSize).toBe("1.125rem");
  });

  it("resolves the medium radius scale by direct lookup", () => {
    expect(data.rounded).toEqual({ sm: "3px", md: "4px", lg: "6px" });
  });

  it("resolves the spacing scale from space primitives", () => {
    expect(data.spacing).toEqual({
      xs: "4px",
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
    });
  });

  it("records provenance with source token and terminal primitive", () => {
    const p = data.provenance["colors.primary"];
    expect(p.sourceToken).toBe("text-default");
    expect(p.chain[p.chain.length - 1]).toBe("neutral-800");
    expect(p.resolved).toBe(data.colors.primary);
  });
});
