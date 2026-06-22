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

/** All semantic tokens as a CSS-variable declaration block, so the sample is
 * driven by the resolved theme (re-resolves on mode flip, contrast change, …). */
function semanticVars(state: ThemeInputs, set: RampSet, mode: "light" | "dark"): string {
  const resolved = resolveSemantics(set, state, mode);
  const alphas = buildAlphas();
  const darkSurf = buildDarkSurfaces(state.neutral.hue, state.neutral.chroma);
  const decls: string[] = [];
  for (const [name, tok] of Object.entries(resolved)) {
    if ("ref" in tok) {
      const color = refToColor(tok.ref, set, alphas, darkSurf);
      if (color) decls.push(`--${name}:${css(color)}`);
    } else if ("raw" in tok) {
      const v = (tok.raw as { $value?: { value?: number } })?.$value?.value;
      if (typeof v === "number") decls.push(`--${name}:${v}`);
    }
  }
  return decls.join(";");
}

function renderRamps(set: RampSet, surface: Oklch): string {
  const rows = Object.entries(set).map(([name, ramp]) => {
    const chips = Object.entries(ramp as Record<string, Oklch>)
      .map(([step, color]) => {
        const ratio = contrastRatio(color, surface).toFixed(2);
        return `<div class="chip" title="${name}-${step} · ${ratio}:1 vs surface" style="background:${css(color)}">
          <span class="step" style="color:${readableOn(color, set)}">${step}</span>
        </div>`;
      })
      .join("");
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div></div>`;
  });
  return `<div class="pv-section"><div class="pv-section-title">Ramps</div>${rows.join("")}</div>`;
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

export function renderPreview(state: ThemeInputs, mode: "light" | "dark"): void {
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  const vars = semanticVars(state, set, mode);

  const root = document.getElementById("preview")!;
  root.className = mode === "light" ? "mode-light" : "mode-dark";

  let body = document.getElementById("pv-body");
  if (!body) {
    root.innerHTML = `<h3 class="pv-title">Preview</h3>
      <p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>
      <div id="pv-body"></div>`;
    body = document.getElementById("pv-body")!;
  } else {
    const sub = root.querySelector(".pv-sub");
    if (sub) sub.textContent = `Generated ${Object.keys(set).length} ramps · ${mode} surface`;
  }
  body.innerHTML = renderRamps(set, surface) + renderSample(vars);
}
