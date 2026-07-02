import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  resolveInputs,
  validateInputs,
  serializeConfig,
  serializeTokenBundle,
  buildFigmaVariablePlan,
  type DeepPartialInputs,
} from "../src/engine/index.js";
import { writeGeneratedTokens } from "../src/engine/emit-dtcg.js";
import baseInputs from "../theme.config.js";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    "write-config": { type: "boolean" },
    build: { type: "boolean" },
    "emit-bundle": { type: "boolean" },
    "emit-figma-plan": { type: "boolean" },
  },
});

function readPartial(): DeepPartialInputs {
  const raw = values.input
    ? readFileSync(values.input, "utf-8")
    : readFileSync(0, "utf-8").trim(); // fd 0 = stdin
  if (!raw) return {};
  return JSON.parse(raw) as DeepPartialInputs;
}

function main(): void {
  const partial = readPartial();
  const resolved = resolveInputs(partial, baseInputs);

  const check = validateInputs(resolved);
  if (!check.ok) {
    console.error("✖ Invalid theme inputs:");
    for (const e of check.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (values["write-config"]) {
    writeFileSync("theme.config.ts", serializeConfig(resolved));
    console.error("✅ wrote theme.config.ts");
  }
  if (values.build) {
    writeGeneratedTokens(resolved, "src/tokens");
    console.error("✅ wrote src/tokens/ (primitives + semantic color)");
  }
  if (values["emit-bundle"]) {
    process.stdout.write(serializeTokenBundle(resolved));
  }
  if (values["emit-figma-plan"]) {
    process.stdout.write(JSON.stringify(buildFigmaVariablePlan(resolved), null, 2));
  }
}

main();
