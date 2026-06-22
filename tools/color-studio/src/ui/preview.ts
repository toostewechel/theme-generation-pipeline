import { formatHex } from "culori";
import {
  buildRamps, resolveSemantics, buildAlphas, buildDarkSurfaces, contrastRatio,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function readableOn(bg: Oklch, set: RampSet): string {
  return contrastRatio(set.neutral["0"], bg) >= contrastRatio(set.neutral["950"], bg)
    ? css(set.neutral["0"])
    : css(set.neutral["950"]);
}

// Map a primitive reference (what resolveSemantics emits) back to its color, so
// the sample can consume the semantic layer the way a real app does.
const FAMILY: Record<string, keyof RampSet> = {
  neutral: "neutral", accent: "accent", sky: "secondary", pink: "tertiary",
  success: "success", error: "error", warning: "warning", info: "info",
};
type Derived = { black: Record<string, Oklch>; white: Record<string, Oklch> };

function refToColor(
  ref: string, set: RampSet, alphas: Derived, darkSurf: Record<string, Oklch>,
): Oklch | null {
  let m = ref.match(/^color-neutral-dark-surface-(\d+)$/);
  if (m) return darkSurf[m[1]] ?? null;
  m = ref.match(/^color-black-alpha-(.+)$/);
  if (m) return alphas.black[m[1]] ?? null;
  m = ref.match(/^color-white-alpha-(.+)$/);
  if (m) return alphas.white[m[1]] ?? null;
  m = ref.match(/^color-(neutral|accent|sky|pink|success|error|warning|info)-(.+)$/);
  if (m) return set[FAMILY[m[1]]]?.[m[2]] ?? null;
  return null; // prism (static passthrough) or unknown — not resolvable in-engine
}

type Resolved = Record<string, { ref: string } | { raw: object }>;

// Follow a token's ref chain (legacy → lean → primitive) until a primitive
// resolves. Legacy tokens now alias lean tokens, so resolution can be 2+ hops.
function colorForToken(
  name: string, resolved: Resolved, set: RampSet,
  alphas: ReturnType<typeof buildAlphas>, darkSurf: Record<string, Oklch>, depth = 0,
): Oklch | null {
  const tok = resolved[name];
  if (!tok || "raw" in tok || depth > 8) return null;
  const direct = refToColor(tok.ref, set, alphas, darkSurf);
  if (direct) return direct;
  return colorForToken(tok.ref, resolved, set, alphas, darkSurf, depth + 1);
}

/** All semantic tokens as a CSS-variable declaration block, so the sample is
 * driven by the resolved theme (re-resolves on mode flip, contrast change, …). */
function semanticVars(state: ThemeInputs, set: RampSet, mode: "light" | "dark"): string {
  const resolved = resolveSemantics(set, state, mode) as Resolved;
  const alphas = buildAlphas();
  const darkSurf = buildDarkSurfaces(state.neutral.hue, state.neutral.chroma);
  const decls: string[] = [];
  for (const [name, tok] of Object.entries(resolved)) {
    if ("raw" in tok) {
      const v = (tok.raw as { $value?: { value?: number } })?.$value?.value;
      if (typeof v === "number") decls.push(`--${name}:${v}`);
      continue;
    }
    const color = colorForToken(name, resolved, set, alphas, darkSurf);
    if (color) decls.push(`--${name}:${css(color)}`);
  }
  return decls.join(";");
}

// WCAG grade of a contrast ratio: AAA >=7, AA >=4.5 (normal text),
// L >=3 (large text / UI components). Below 3 has no badge.
function grade(ratio: number): { label: string; tier: string } | null {
  if (ratio >= 7) return { label: "AAA", tier: "aaa" };
  if (ratio >= 4.5) return { label: "AA", tier: "aa" };
  if (ratio >= 3) return { label: "L", tier: "large" };
  return null;
}

function renderRamps(set: RampSet, surface: Oklch): string {
  const rows = Object.entries(set).map(([name, ramp]) => {
    const chips = Object.entries(ramp as Record<string, Oklch>)
      .map(([step, color]) => {
        const ink = readableOn(color, set);
        const r = contrastRatio(color, surface);
        const ratio = r.toFixed(2);
        const g = grade(r);
        const meta = showContrast
          ? `<span class="cr" style="color:${ink}">${ratio}${g ? ` <b class="g-${g.tier}">${g.label}</b>` : ""}</span>`
          : "";
        return `<div class="chip${showContrast ? " tall" : ""}" title="${name}-${step} · ${ratio}:1 vs surface" style="background:${css(color)}">
          <span class="step" style="color:${ink}">${step}</span>${meta}
        </div>`;
      })
      .join("");
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div></div>`;
  });
  const legend = showContrast
    ? ` <span class="pv-legend">contrast vs ${surfaceLabel} · AA ≥ 4.5 · AAA ≥ 7 · L ≥ 3</span>`
    : "";
  return `<div class="pv-section"><div class="pv-section-title">Ramps${legend}</div>${rows.join("")}</div>`;
}

let surfaceLabel = "surface";

// Demonstrates the accessibility payoff: a white label on each intent's fill
// clears the same WCAG ratio, because every fill is anchored to that target.
function renderLabelOnFill(set: RampSet): string {
  const white: Oklch = { l: 1, c: 0, h: 0 };
  const intents: [string, keyof RampSet][] = [
    ["Primary", "accent"], ["Secondary", "secondary"], ["Tertiary", "tertiary"],
    ["Success", "success"], ["Error", "error"], ["Warning", "warning"], ["Info", "info"],
  ];
  const pills = intents.map(([label, fam]) => {
    const fill = set[fam]["500"];
    const r = contrastRatio(fill, white).toFixed(2);
    return `<span class="fill-pill" style="background:${css(fill)}" title="white on ${label} fill = ${r}:1">Label</span>`;
  }).join("");
  const ratio = contrastRatio(set.accent["500"], white).toFixed(1);
  return `<div class="pv-section">
    <div class="pv-section-title">Label on fill <span class="pv-legend">white label clears ${ratio}:1 on every intent — one check, whole palette</span></div>
    <div class="fill-row">${pills}</div>
  </div>`;
}

// Verbatim brand colors — exact, separate from the derived ramp (color-brand-*).
function renderBrand(state: ThemeInputs): string {
  const slots: [string, "primary" | "secondary" | "tertiary"][] = [
    ["primary", "primary"], ["secondary", "secondary"], ["tertiary", "tertiary"],
  ];
  const items = slots.map(([label, slot]) => {
    const seed = state.accents[slot];
    const c = state.brand?.[slot] ?? { l: 0.62, c: seed.chroma, h: seed.hue };
    const hex = formatHex({ mode: "oklch", l: c.l, c: c.c, h: c.h });
    return `<div class="brand-item">
      <span class="brand-sw" style="background:${css(c)}"></span>
      <div><div class="brand-name">color-brand-${label}</div><code class="brand-hex">${hex}</code></div>
    </div>`;
  }).join("");
  return `<div class="pv-section">
    <div class="pv-section-title">Brand <span class="pv-legend">exact source colors, verbatim in color-brand-*</span></div>
    <div class="brand-row">${items}</div>
  </div>`;
}

// The sample consumes only semantic tokens (var(--color-*)), never raw ramp
// steps — it is the proof that the semantic layer holds up in context.
function renderSample(vars: string): string {
  return `<div class="pv-section">
    <div class="pv-section-title">In context · semantic tokens</div>
    <div class="sample" style="${vars}">
      <h4 style="color:var(--color-text-emphasis)">Tune the seed, read it in place</h4>
      <p style="color:var(--color-text-default)">Body copy on the raised surface, styled entirely from the generated semantic tokens.</p>
      <p class="sample-muted" style="color:var(--color-text-muted)">Muted annotation · <a href="#" style="color:var(--color-text-link)">a link</a></p>
      <div class="sample-field" style="background:var(--color-background-surface-default);border-color:var(--color-border-default)">
        <span style="color:var(--color-text-muted)">Input placeholder</span>
      </div>
      <div class="sample-row">
        <button class="sample-btn" style="background:var(--color-action-primary-background);color:var(--color-action-primary-on-bg)">Primary action</button>
        <button class="sample-btn sample-btn--ghost" style="color:var(--color-action-secondary-text);border-color:var(--color-border-default)">Secondary</button>
        <span class="sample-chip" style="background:var(--color-feedback-success-background);color:var(--color-feedback-success-text)">Success</span>
        <span class="sample-chip" style="background:var(--color-feedback-error-background);color:var(--color-feedback-error-text)">Error</span>
      </div>
    </div></div>`;
}

let showContrast = true;
let lastState: ThemeInputs | null = null;
let lastMode: "light" | "dark" = "light";

export function renderPreview(state: ThemeInputs, mode: "light" | "dark"): void {
  lastState = state;
  lastMode = mode;
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  surfaceLabel = mode === "light" ? "neutral-0" : "dark surface";
  const vars = semanticVars(state, set, mode);

  const root = document.getElementById("preview")!;
  root.className = mode === "light" ? "mode-light" : "mode-dark";

  let body = document.getElementById("pv-body");
  if (!body) {
    root.innerHTML = `<h3 class="pv-title">Preview</h3>
      <div class="pv-head-row">
        <p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>
        <label class="pv-toggle"><input type="checkbox" id="contrast-toggle" checked /> Contrast</label>
      </div>
      <div id="pv-body"></div>`;
    body = document.getElementById("pv-body")!;
    const cb = document.getElementById("contrast-toggle") as HTMLInputElement;
    cb.addEventListener("change", () => {
      showContrast = cb.checked;
      if (lastState) renderPreview(lastState, lastMode);
    });
  } else {
    const sub = root.querySelector(".pv-sub");
    if (sub) sub.textContent = `Generated ${Object.keys(set).length} ramps · ${mode} surface`;
  }
  body.innerHTML =
    renderRamps(set, surface) + renderLabelOnFill(set) + renderBrand(state) + renderSample(vars);
}
