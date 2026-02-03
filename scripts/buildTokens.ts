import { StyleDictionary } from "style-dictionary-utils";
import { rmSync } from "fs";

// Clean dist directory before build
try {
  rmSync("./dist", { recursive: true, force: true });
} catch {
  // Directory doesn't exist, that's fine
}

const basePlatformConfig = {
  prefix: "",
  buildPath: "./dist/css/",
  transformGroup: "css/extended",
  colorOutputFormat: "hex",
};

// Shared primitives (always included)
const primitives = [
  "./src/tokens/primitives-color.mode-1.tokens.json",
  "./src/tokens/primitives-font.mode-1.tokens.json",
  "./src/tokens/primitives-dimension.mode-1.tokens.json",
  "./src/tokens/primitives-radius.mode-1.tokens.json", // Note: typo in original filename
];

// Semantic tokens that don't have modes
const semanticSingleMode = [
  "./src/tokens/typography.mode-1.tokens.json",
  "./src/tokens/typography.styles.tokens.json",
  "./src/tokens/dimension.mode-1.tokens.json",
];

// ============================================
// Build 1: Base tokens (primitives + light mode + default radius)
// ============================================
const lightSd = new StyleDictionary();
const lightBuild = await lightSd.extend({
  source: [
    ...primitives,
    ...semanticSingleMode,
    "./src/tokens/color.light.tokens.json",
    "./src/tokens/radius.default.tokens.json",
  ],
  platforms: {
    css: {
      ...basePlatformConfig,
      files: [
        {
          destination: "base.css",
          format: "css/advanced",
          options: {
            selector: ":root",
            outputReferences: true,
          },
        },
      ],
    },
  },
});
await lightBuild.buildAllPlatforms();
console.log("✔ Built base.css (light mode + default radius)");

// ============================================
// Build 2: Dark mode semantic tokens only
// ============================================
const darkSd = new StyleDictionary();
const darkBuild = await darkSd.extend({
  log: {
    verbosity: "silent",
  },
  include: primitives, // Include primitives for reference resolution
  source: ["./src/tokens/color.dark.tokens.json"],
  platforms: {
    css: {
      ...basePlatformConfig,
      files: [
        {
          destination: "theme-dark.css",
          format: "css/advanced",
          filter: "isSource", // Filtering is intentional for token references; only output source tokens, not included primitives
          options: {
            selector: '[data-theme="dark"]',
            outputReferences: true,
          },
        },
      ],
    },
  },
});
await darkBuild.buildAllPlatforms();
console.log("✔ Built theme-dark.css");

// ============================================
// Build 3: Radius variants (only the intensity value changes)
// ============================================
const radiusModes = [
  {
    file: "radius.sharp.tokens.json",
    selector: '[data-radius="sharp"]',
    output: "radius-sharp.css",
  },
  {
    file: "radius.rounded.tokens.json",
    selector: '[data-radius="rounded"]',
    output: "radius-rounded.css",
  },
  {
    file: "radius.pill.tokens.json",
    selector: '[data-radius="pill"]',
    output: "radius-pill.css",
  },
];

for (const mode of radiusModes) {
  const radiusSd = new StyleDictionary();
  const radiusBuild = await radiusSd.extend({
    include: ["./src/tokens/primtives-radius.mode-1.tokens.json"], // Include for reference
    source: [`./src/tokens/${mode.file}`],
    platforms: {
      css: {
        ...basePlatformConfig,
        files: [
          {
            destination: mode.output,
            format: "css/advanced",
            filter: "isSource",
            options: {
              selector: mode.selector,
              outputReferences: true,
            },
          },
        ],
      },
    },
  });
  await radiusBuild.buildAllPlatforms();
  console.log(`✔ Built ${mode.output}`);
}

console.log("\n✅ All tokens built successfully!");
