import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThemeInputs } from "./types.js";
import { buildGeneratedFiles } from "./dtcg.js";

export { oklchToDtcg, buildPrimitivesDtcg, buildSemanticDtcg, buildGeneratedFiles, BANNER } from "./dtcg.js";

export function writeGeneratedTokens(inputs: ThemeInputs, tokensDir: string): void {
  mkdirSync(tokensDir, { recursive: true });
  for (const [filename, content] of Object.entries(buildGeneratedFiles(inputs))) {
    writeFileSync(join(tokensDir, filename), JSON.stringify(content, null, 2) + "\n");
  }
}
