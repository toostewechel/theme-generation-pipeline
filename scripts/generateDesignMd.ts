import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadTokenMap } from "../src/designmd/load-tokens.js";
import { extractDesignMdData } from "../src/designmd/extract.js";
import { mergeDesignMd } from "../src/designmd/emit.js";
import type { ColorMode, RadiusMode } from "../src/designmd/types.js";

const COLOR_MODES = ["light", "dark"] as const;
const RADIUS_MODES = ["small", "medium", "large", "full"] as const;

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    mode: { type: "string", default: "light" },
    radius: { type: "string", default: "medium" },
    out: { type: "string" },
    "emit-context": { type: "boolean" },
    force: { type: "boolean" },
  },
});

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function main(): void {
  if (!values.name) fail('Missing required --name "Theme Name"');
  if (!COLOR_MODES.includes(values.mode as ColorMode)) {
    fail(`--mode must be one of: ${COLOR_MODES.join(", ")}`);
  }
  if (!RADIUS_MODES.includes(values.radius as RadiusMode)) {
    fail(`--radius must be one of: ${RADIUS_MODES.join(", ")}`);
  }
  const mode = values.mode as ColorMode;
  const radiusMode = values.radius as RadiusMode;

  const map = loadTokenMap({ colorMode: mode, radiusMode });
  const data = extractDesignMdData(map, { name: values.name, mode, radiusMode });

  if (values["emit-context"]) {
    process.stdout.write(JSON.stringify(data, null, 2));
    return;
  }

  const slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const out =
    values.out ?? `themes/${slug}${mode === "dark" ? ".dark" : ""}.design.md`;

  const existing = existsSync(out) ? readFileSync(out, "utf-8") : null;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, mergeDesignMd(existing, data, { force: values.force }));

  if (existing === null) {
    console.error(`✅ created ${out} (front matter + skeleton body — author the prose next)`);
  } else if (values.force) {
    console.error(`✅ rewrote ${out} (front matter + skeleton body, previous body discarded)`);
  } else {
    console.error(`✅ refreshed front matter in ${out} (body preserved)`);
  }
}

try {
  main();
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
