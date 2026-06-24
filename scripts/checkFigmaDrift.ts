import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diffTokenNames,
  namesFromBundle,
  namesFromManifest,
} from "../src/engine/figma-drift.js";
import type { TokenBundle } from "../src/engine/figma-export.js";

function loadIgnore(path: string): (string | RegExp)[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8")) as string[];
  return raw.map((entry) =>
    entry.startsWith("/") && entry.endsWith("/") && entry.length > 2
      ? new RegExp(entry.slice(1, -1))
      : entry,
  );
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const exportPath = args.find((a) => !a.startsWith("--"));

  if (!exportPath) {
    console.error("Usage: npm run check:figma-drift <figma-export.json> [--json]");
    process.exit(2);
  }
  if (!existsSync(exportPath)) {
    console.error(`Export file not found: ${exportPath}`);
    process.exit(2);
  }

  let bundle: TokenBundle;
  try {
    bundle = JSON.parse(readFileSync(exportPath, "utf-8")) as TokenBundle;
  } catch (e) {
    console.error(`Could not parse JSON: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!bundle.files || typeof bundle.files !== "object") {
    console.error("Export JSON has no `files` object — expected a DTCG bundle { manifest, files }.");
    process.exit(2);
  }

  const figma = namesFromBundle(bundle);
  const pipeline = namesFromManifest("src/tokens");
  const ignore = loadIgnore(join("scripts", "figma-drift.ignore.json"));
  const report = diffTokenNames(pipeline, figma, { ignore });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.hasDrift ? 1 : 0);
  }

  console.log("Figma name-drift report");
  console.log(`  ✓ ${report.matched.length} names matched`);
  if (report.missingInPipeline.length) {
    console.log(
      `  ⚠ ${report.missingInPipeline.length} in Figma but missing from pipeline (add to engine/semantics or token files):`,
    );
    for (const n of report.missingInPipeline) console.log(`      ${n}`);
  }
  if (report.extraInPipeline.length) {
    console.log(
      `  ⚠ ${report.extraInPipeline.length} in pipeline but missing from Figma (renamed/removed in Figma?):`,
    );
    for (const n of report.extraInPipeline) console.log(`      ${n}`);
  }
  if (report.ignored.length) console.log(`  · ${report.ignored.length} ignored`);

  process.exit(report.hasDrift ? 1 : 0);
}

main();
