import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokenBundle } from "./figma-export.js";

export interface DriftReport {
  /** Names present in both Figma and the pipeline. */
  matched: string[];
  /** In Figma, not in the pipeline — new/renamed in Figma; reflect in engine or token files. */
  missingInPipeline: string[];
  /** In the pipeline, not in Figma — removed/renamed in Figma? */
  extraInPipeline: string[];
  /** Matched an ignore pattern; excluded from the drift buckets. */
  ignored: string[];
  /** True when missingInPipeline or extraInPipeline is non-empty. */
  hasDrift: boolean;
}

export function diffTokenNames(
  pipeline: Set<string>,
  figma: Set<string>,
  opts: { ignore?: (string | RegExp)[] } = {},
): DriftReport {
  const ignore = opts.ignore ?? [];
  const isIgnored = (name: string) =>
    ignore.some((p) => (typeof p === "string" ? p === name : p.test(name)));

  const matched: string[] = [];
  const missingInPipeline: string[] = [];
  const extraInPipeline: string[] = [];
  const ignored: string[] = [];

  for (const name of new Set([...pipeline, ...figma])) {
    if (isIgnored(name)) {
      ignored.push(name);
      continue;
    }
    const inPipeline = pipeline.has(name);
    const inFigma = figma.has(name);
    if (inPipeline && inFigma) matched.push(name);
    else if (inFigma) missingInPipeline.push(name);
    else extraInPipeline.push(name);
  }

  for (const arr of [matched, missingInPipeline, extraInPipeline, ignored]) arr.sort();

  return {
    matched,
    missingInPipeline,
    extraInPipeline,
    ignored,
    hasDrift: missingInPipeline.length + extraInPipeline.length > 0,
  };
}

/** A DTCG token node carries `$value` or `$type`. */
function isTokenNode(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && ("$value" in value || "$type" in value);
}

/**
 * Walk a DTCG file object, collecting leaf token names into `into`.
 * Files are flat in this repo, so names equal top-level keys; nested groups
 * (if ever present) are joined with "-" to match the flat naming convention.
 * `$`-prefixed metadata keys are skipped.
 */
export function collectTokenNames(
  node: Record<string, unknown>,
  into: Set<string>,
  prefix = "",
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const name = prefix ? `${prefix}-${key}` : key;
    if (isTokenNode(value)) into.add(name);
    else if (typeof value === "object" && value !== null)
      collectTokenNames(value as Record<string, unknown>, into, name);
  }
}

/** Names across every file of a Figma DTCG export bundle. */
export function namesFromBundle(bundle: TokenBundle): Set<string> {
  const names = new Set<string>();
  for (const file of Object.values(bundle.files)) {
    collectTokenNames(file as Record<string, unknown>, names);
  }
  return names;
}

interface Manifest {
  collections: Record<string, { modes: Record<string, string[]> }>;
}

/**
 * Names the pipeline emits, read from the committed token files referenced by
 * `manifest.json`'s `collections` block. The `styles` block is intentionally
 * not read (styles are not variables).
 */
export function namesFromManifest(tokensDir: string): Set<string> {
  const manifest = JSON.parse(readFileSync(join(tokensDir, "manifest.json"), "utf-8")) as Manifest;
  const names = new Set<string>();
  for (const collection of Object.values(manifest.collections)) {
    for (const files of Object.values(collection.modes)) {
      for (const filename of files) {
        const file = JSON.parse(readFileSync(join(tokensDir, filename), "utf-8"));
        collectTokenNames(file, names);
      }
    }
  }
  return names;
}
