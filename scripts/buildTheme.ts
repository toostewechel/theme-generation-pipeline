import { writeGeneratedTokens } from "../src/engine/emit-dtcg.js";
import themeInputs from "../theme.config.js";

function main() {
  try {
    console.log("🎨 Generating color tokens from theme.config.ts…");
    writeGeneratedTokens(themeInputs, "src/tokens");
    console.log("✅ src/tokens/primitives-color.mode-1.tokens.json");
    console.log("✅ src/tokens/color.light.tokens.json");
    console.log("✅ src/tokens/color.dark.tokens.json");
    console.log("\nNext: npm run build:tokens");
    process.exit(0);
  } catch (error) {
    console.error("Theme generation failed:", error);
    process.exit(1);
  }
}

main();
