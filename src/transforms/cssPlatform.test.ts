import { describe, it, expect, beforeAll } from "vitest";
import { StyleDictionary } from "style-dictionary-utils";
import {
  cssPlatformConfig,
  dimensionEmTransform,
  dimensionUnitlessTransform,
} from "./cssPlatform.js";
import { oklchCssTransform } from "./oklchColor.js";

beforeAll(() => {
  StyleDictionary.registerTransform(dimensionUnitlessTransform);
  StyleDictionary.registerTransform(dimensionEmTransform);
  StyleDictionary.registerTransform(oklchCssTransform);
});

/** Run tokens through the real platform config and return the emitted CSS vars. */
async function transformTokens(
  tokens: Record<string, unknown>,
): Promise<Record<string, string>> {
  const sd = new StyleDictionary({
    tokens,
    log: { verbosity: "silent" },
    platforms: {
      css: {
        ...cssPlatformConfig,
        buildPath: "",
        files: [{ destination: "vars.css", format: "css/variables" }],
      },
    },
  });
  const [file] = await sd.formatPlatform("css");
  // Trailing `/* ... */` is the token's $description, emitted by css/variables.
  return Object.fromEntries(
    [...file.output.matchAll(/^\s*(--[\w-]+):\s*(.+?);/gm)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

const px = (value: number) => ({
  $type: "dimension" as const,
  $value: { value, unit: "px" },
});

describe("cssPlatformConfig transform order", () => {
  it("does not include size/rem", () => {
    // size/rem stringifies DTCG dimensions with their original unit ("14px"),
    // and dimension/css short-circuits on strings — so its presence silently
    // disables px -> rem conversion for every dimension token.
    expect(cssPlatformConfig.transforms).not.toContain("size/rem");
  });

  it("runs dimension/em before dimension/css", () => {
    const { transforms } = cssPlatformConfig;
    expect(transforms.indexOf("dimension/em")).toBeLessThan(
      transforms.indexOf("dimension/css"),
    );
  });

  it("runs dimension/unitless last", () => {
    const { transforms } = cssPlatformConfig;
    expect(transforms[transforms.length - 1]).toBe("dimension/unitless");
  });
});

describe("dimension output units", () => {
  it("converts px dimensions to rem at basePxFontSize", async () => {
    const vars = await transformTokens({
      "font-size-100": px(14),
      "font-line-height-700": px(28),
      "size-2": px(8),
      "size-4": px(16),
    });
    expect(vars["--font-size-100"]).toBe("0.875rem");
    expect(vars["--font-line-height-700"]).toBe("1.75rem");
    expect(vars["--size-2"]).toBe("0.5rem");
    expect(vars["--size-4"]).toBe("1rem");
  });

  it("keeps $description: 'unitless' tokens as bare numbers", async () => {
    const vars = await transformTokens({
      "radius-scale-sm": { ...px(0.75), $description: "unitless" },
      "radius-intensity": { ...px(1.5), $description: "unitless" },
    });
    expect(vars["--radius-scale-sm"]).toBe("0.75");
    expect(vars["--radius-intensity"]).toBe("1.5");
  });

  it("keeps $description: 'em' tokens in em", async () => {
    const vars = await transformTokens({
      "font-letter-spacing-tight": { ...px(-0.24), $description: "em" },
      "font-letter-spacing-normal": { ...px(0), $description: "em" },
    });
    expect(vars["--font-letter-spacing-tight"]).toBe("-0.015em");
    expect(vars["--font-letter-spacing-normal"]).toBe("0em");
  });

  it("converts px dimensions reached through references", async () => {
    const vars = await transformTokens({
      "font-size-200": px(16),
      "typography-body-font-size": {
        $type: "dimension",
        $value: "{font-size-200}",
      },
    });
    expect(vars["--typography-body-font-size"]).toBe("1rem");
  });
});
