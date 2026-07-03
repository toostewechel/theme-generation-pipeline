import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ColorMode, FlatTokenMap, RadiusMode, TokenFile } from "./types.js";

interface Manifest {
  collections: Record<string, { modes: Record<string, string[]> }>;
  styles?: Record<string, string[]>;
}

export interface LoadOptions {
  colorMode: ColorMode;
  radiusMode: RadiusMode;
  tokensDir?: string;
}

const DEFAULT_TOKENS_DIR = "src/tokens";

function readTokenFile(dir: string, file: string): TokenFile {
  return JSON.parse(readFileSync(join(dir, file), "utf-8")) as TokenFile;
}

function pickMode(
  collection: string,
  modes: Record<string, string[]>,
  opts: LoadOptions,
): string {
  if (collection === "color") return opts.colorMode;
  if (collection === "primitives-radius") return opts.radiusMode;
  if (collection === "border") return "default";
  const names = Object.keys(modes);
  if (names.length !== 1) {
    throw new Error(
      `Collection "${collection}" has ${names.length} modes (${names.join(", ")}) and no selection rule`,
    );
  }
  return names[0];
}

export function loadTokenMap(opts: LoadOptions): FlatTokenMap {
  const dir = opts.tokensDir ?? DEFAULT_TOKENS_DIR;
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf-8"),
  ) as Manifest;

  const map: FlatTokenMap = {};

  for (const [collection, { modes }] of Object.entries(manifest.collections)) {
    const mode = pickMode(collection, modes, opts);
    const files = modes[mode];
    if (!files) {
      throw new Error(`Collection "${collection}" has no mode "${mode}"`);
    }
    const prefix = collection === "primitives-radius" ? "radius-" : "";
    for (const file of files) {
      for (const [name, token] of Object.entries(readTokenFile(dir, file))) {
        map[`${prefix}${name}`] = token;
      }
    }
  }

  for (const file of manifest.styles?.typography ?? []) {
    Object.assign(map, readTokenFile(dir, file));
  }

  return map;
}
