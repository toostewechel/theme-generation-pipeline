import { generateClamp, generateUnitlessClamp, interpolateAtViewport } from "./clamp.js";
import {
  buildTokenLookup,
  resolveConfig,
  type FluidTypographyConfig,
  type ResolvedFluidConfig,
  type ResolvedLineHeight,
} from "./resolveConfig.js";
import "./fonts.css";
import "./styles.css";

// Config — always exists in the repo, static import via alias
import defaultConfig from "@project/src/fluid-typography.config.json";

// Primitives — optional, may not exist if tokens haven't been exported from Figma.
// import.meta.glob returns {} if no files match (no error), unlike import() which
// Vite statically analyzes and fails on missing files.
const primitivesModules = import.meta.glob<{ default: Record<string, any> }>(
  "@project/src/tokens/primitives-font.*.tokens.json",
  { eager: true },
);

let primitives: Record<string, any> = {};
const entries = Object.values(primitivesModules);
if (entries.length > 0) {
  primitives = entries[0].default;
} else {
  console.warn(
    "No primitives-font tokens found in src/tokens/. " +
    "Token references like {font-size-1200} won't resolve. " +
    "Use raw px values (e.g. \"48px\") or place token files first."
  );
}

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";

// ─── State ──────────────────────────────────────────────────────────

let currentConfig: FluidTypographyConfig = defaultConfig as FluidTypographyConfig;
let resolved: ResolvedFluidConfig | null = null;
let viewportWidth = 960;
let parseError: string | null = null;

function tryResolve(): void {
  try {
    const lookup = buildTokenLookup(primitives);
    resolved = resolveConfig(currentConfig, lookup);
    parseError = null;
  } catch (e: any) {
    resolved = null;
    parseError = e.message;
  }
}

// ─── Render ─────────────────────────────────────────────────────────

function render(): void {
  const app = document.getElementById("app")!;

  // Viewport scrubber
  const scrubber = document.getElementById("viewport-scrubber") as HTMLInputElement;
  const vpLabel = document.getElementById("viewport-label")!;
  scrubber.min = String(currentConfig.viewports.min);
  scrubber.max = String(currentConfig.viewports.max);
  scrubber.value = String(viewportWidth);
  vpLabel.textContent = `${viewportWidth}px`;

  // Error display
  const errorEl = document.getElementById("error-display")!;
  if (parseError) {
    errorEl.textContent = parseError;
    errorEl.style.display = "block";
  } else {
    errorEl.style.display = "none";
  }

  // Specimen
  const specimen = document.getElementById("specimen")!;
  specimen.innerHTML = "";

  if (!resolved) return;

  // Clamp output
  const clampOutput: string[] = [];

  for (const [styleName, style] of Object.entries(resolved.styles)) {
    const block = document.createElement("div");
    block.className = "specimen-block";

    // Style label
    const label = document.createElement("div");
    label.className = "specimen-label";
    label.textContent = styleName;
    block.appendChild(label);

    // Sample text
    const text = document.createElement("div");
    text.className = "specimen-text";
    text.textContent = SAMPLE_TEXT;

    const computedFontSize = interpolateAtViewport(
      style.fontSize.minPx,
      style.fontSize.maxPx,
      style.viewports.min,
      style.viewports.max,
      viewportWidth,
    );
    text.style.fontSize = `${computedFontSize}px`;

    if (style.fontFamily) {
      text.style.fontFamily = style.fontFamily;
    }

    if (style.lineHeight !== undefined) {
      if (typeof style.lineHeight === "number") {
        // Unitless line-height — apply directly
        text.style.lineHeight = String(style.lineHeight);
      } else {
        // Range of unitless ratios — interpolate
        const computedLh = interpolateAtViewport(
          style.lineHeight.min,
          style.lineHeight.max,
          style.viewports.min,
          style.viewports.max,
          viewportWidth,
        );
        text.style.lineHeight = String(Math.round(computedLh * 1000) / 1000);
      }
    }

    block.appendChild(text);

    // Size info
    const info = document.createElement("div");
    info.className = "specimen-info";
    info.textContent = `${Math.round(computedFontSize)}px at ${viewportWidth}px viewport (${style.fontSize.minPx}px → ${style.fontSize.maxPx}px)`;
    block.appendChild(info);

    specimen.appendChild(block);

    // Build clamp output
    const fsClamp = generateClamp({
      minPx: style.fontSize.minPx,
      maxPx: style.fontSize.maxPx,
      minVwPx: style.viewports.min,
      maxVwPx: style.viewports.max,
      baseFontSize: resolved.baseFontSize,
    });

    let mixin = `@mixin ${styleName} {\n  font-size: ${fsClamp};`;
    if (style.lineHeight !== undefined) {
      if (typeof style.lineHeight === "number") {
        mixin += `\n  line-height: ${style.lineHeight};`;
      } else {
        const lhClamp = generateUnitlessClamp({
          min: style.lineHeight.min,
          max: style.lineHeight.max,
          minVwPx: style.viewports.min,
          maxVwPx: style.viewports.max,
        });
        mixin += `\n  line-height: ${lhClamp};`;
      }
    }
    mixin += "\n}";
    clampOutput.push(mixin);
  }

  // Render clamp output
  const outputEl = document.getElementById("clamp-output")!;
  outputEl.textContent = clampOutput.join("\n\n");
}

// ─── Event Handlers ─────────────────────────────────────────────────

function setupEvents(): void {
  const scrubber = document.getElementById("viewport-scrubber") as HTMLInputElement;
  scrubber.addEventListener("input", () => {
    viewportWidth = parseInt(scrubber.value, 10);
    render();
  });

  const editor = document.getElementById("config-editor") as HTMLTextAreaElement;
  editor.value = JSON.stringify(currentConfig, null, 2);
  editor.addEventListener("input", () => {
    try {
      currentConfig = JSON.parse(editor.value);
      tryResolve();
    } catch (e: any) {
      parseError = `Invalid JSON: ${e.message}`;
      resolved = null;
    }
    render();
  });

  const resetBtn = document.getElementById("reset-btn")!;
  resetBtn.addEventListener("click", () => {
    currentConfig = defaultConfig as FluidTypographyConfig;
    editor.value = JSON.stringify(currentConfig, null, 2);
    tryResolve();
    render();
  });

  const copyBtn = document.getElementById("copy-btn")!;
  copyBtn.addEventListener("click", () => {
    const output = document.getElementById("clamp-output")!.textContent ?? "";
    navigator.clipboard.writeText(output).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy SCSS"), 1500);
    });
  });
}

// ─── Init ───────────────────────────────────────────────────────────

tryResolve();
setupEvents();
render();
