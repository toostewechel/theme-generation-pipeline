import { writeGeneratedTokens } from "../src/engine/emit-dtcg.js";
import themeInputs from "../theme.config.js";

function main() {
  try {
    console.log("🎨 Generating primitive color tokens from theme.config.ts…");
    writeGeneratedTokens(themeInputs, "src/tokens");
    console.log("✅ src/tokens/primitives-color.mode-1.tokens.json");
    console.log("\nNext: paste this file into Figma to seed the primitive color");
    console.log("variables, then export from Figma to update src/tokens/.");
    process.exit(0);
  } catch (error) {
    console.error("Theme generation failed:", error);
    process.exit(1);
  }
}

main();
