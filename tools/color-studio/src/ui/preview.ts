import { formatHex } from "culori";
import {
  buildRamps, resolveSemantics, buildAlphas, buildDarkSurfaces, contrastRatio,
  alphaOverWhite,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

// sRGB hex for the clipboard (formatHex clamps out-of-gamut OKLCH to sRGB).
function hexOf(c: Oklch): string {
  return formatHex({ mode: "oklch", l: c.l, c: c.c, h: c.h }) ?? "#000000";
}

// Copy + check icons, both present in every copy affordance; CSS swaps which is
// shown via a `.copied` class on the ancestor (toggled by the click handler).
const COPY_ICON =
  `<span class="ic ic-copy"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span>` +
  `<span class="ic ic-check"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12l5 5 9-10"/></svg></span>`;

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
  const darkSurf = buildDarkSurfaces(
    state.neutral.hue, state.neutral.chroma,
    state.darkSurfaces?.base, state.darkSurfaces?.step,
  );
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
        const hex = hexOf(color);
        return `<button type="button" class="chip${showContrast ? " tall" : ""}" data-hex="${hex}" title="${name}-${step} · ${ratio}:1 vs surface — copy ${hex}" aria-label="Copy ${name}-${step} ${hex}">
          <span class="chip-fill" style="background:${css(color)}">
            <span class="step" style="color:${ink}">${step}</span>${meta}
          </span>
          <span class="chip-copy" aria-hidden="true">${COPY_ICON}</span>
        </button>`;
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

// The 8 named ramps that get alpha twins (excludes darkSurface).
const ALPHA_RAMPS: (keyof RampSet)[] = [
  "neutral", "accent", "secondary", "tertiary",
  "success", "error", "warning", "info",
];

// Alpha-over-white twins on a white plate, so "matches the solid" reads at a
// glance regardless of the preview's light/dark mode (these are solved vs white).
function renderAlphaRamps(set: RampSet): string {
  const rows = ALPHA_RAMPS.map((name) => {
    const ramp = set[name] as Record<string, Oklch>;
    const chips = Object.entries(ramp).map(([step, color]) => {
      const twin = alphaOverWhite(color);
      return `<div class="chip" title="${name}-alpha-${step} · α ${twin.alpha?.toFixed(3)}">
        <span class="chip-fill" style="background:${css(twin)}">
          <span class="step" style="color:#111">${step}</span>
        </span>
      </div>`;
    }).join("");
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div></div>`;
  });
  return `<div class="pv-section pv-alpha"><div class="pv-section-title">Alpha over white <span class="pv-legend">each step solved to the most-transparent color that matches the solid over white</span></div>${rows.join("")}</div>`;
}

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

// Dark-mode surface elevation ramp, from the darkSurfaces base + step inputs.
function renderDarkSurfaces(state: ThemeInputs): string {
  const surfaces = buildDarkSurfaces(
    state.neutral.hue, state.neutral.chroma,
    state.darkSurfaces?.base, state.darkSurfaces?.step,
  );
  const chips = Object.entries(surfaces).map(([n, c]) =>
    `<div class="ds-chip" title="dark-surface-${n} · L ${c.l.toFixed(3)}" style="background:${css(c)}">${n}</div>`,
  ).join("");
  return `<div class="pv-section">
    <div class="pv-section-title">Dark surfaces <span class="pv-legend">elevation: base + step (deepest → highest)</span></div>
    <div class="ds-row">${chips}</div>
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
    const hex = hexOf(c);
    return `<div class="brand-item">
      <span class="swatch swatch--brand"><i style="background:${css(c)}"></i></span>
      <div>
        <div class="brand-name">color-brand-${label}</div>
        <div class="brand-hex-row">
          <code class="brand-hex">${hex}</code>
          <button type="button" class="copy-btn" data-hex="${hex}" title="Copy ${hex}" aria-label="Copy ${hex}">${COPY_ICON}</button>
        </div>
      </div>
    </div>`;
  }).join("");
  return `<div class="pv-section">
    <div class="pv-section-title">Brand <span class="pv-legend">exact source colors, verbatim in color-brand-*</span></div>
    <div class="brand-row">${items}</div>
  </div>`;
}

// The playground consumes only semantic tokens (var(--color-*)), never raw ramp
// steps — it is the proof that the semantic layer holds up in context. Structural
// styling (radius/spacing) is illustrative CSS; only color comes from tokens.
function renderPlaygroundTab(vars: string): string {
  const STATUSES = ["success", "error", "warning", "info"] as const;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  const alerts = STATUSES.map(
    (s) =>
      `<div class="pg-alert" style="background:var(--color-bg-${s}-subtle);color:var(--color-fg-${s})">
        <strong>${cap(s)}</strong> — styled from --color-bg-${s}-subtle and --color-fg-${s}.
      </div>`,
  ).join("");

  const badges = STATUSES.map(
    (s) =>
      `<span class="sample-chip" style="background:var(--color-bg-${s}-subtle);color:var(--color-fg-${s})">${s}</span>`,
  ).join("");

  return `<div class="pv-section">
    <div class="pv-section-title">Playground <span class="pv-legend">components styled entirely from semantic color tokens</span></div>
    <div class="sample" style="${vars}">
      <div class="pg-card" style="background:var(--color-bg);border-color:var(--color-border-default)">
        <h4 style="color:var(--color-fg-emphasis)">Tune the seed, read it in place</h4>
        <p style="color:var(--color-fg)">Body copy on the raised surface, styled entirely from the generated semantic tokens.</p>
        <p class="sample-muted" style="color:var(--color-fg-muted)">Muted annotation · <a href="#" style="color:var(--color-fg-link)">a link</a></p>
      </div>
      <div class="sample-row">
        <button class="sample-btn" style="background:var(--color-bg-accent);color:var(--color-fg-on-accent)">Primary action</button>
        <button class="sample-btn sample-btn--ghost" style="color:var(--color-fg-secondary);border-color:var(--color-border-default)">Secondary</button>
        <button class="sample-btn" style="background:var(--color-bg-accent);color:var(--color-fg-on-accent);opacity:0.45" disabled>Disabled</button>
      </div>
      <div class="pg-form">
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-border-default)">
          <span style="color:var(--color-fg-muted)">Input placeholder</span>
        </div>
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-fg-link)">
          <span style="color:var(--color-fg)">Focused value</span>
        </div>
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-fg-error)">
          <span style="color:var(--color-fg)">Invalid value</span>
        </div>
        <p class="pg-help" style="color:var(--color-fg-error)">This field is required.</p>
      </div>
      <div class="pg-alerts">${alerts}</div>
      <div class="sample-row">${badges}</div>
    </div></div>`;
}

// Set from renderPreview's options each render; read by renderRamps (which runs
// synchronously within the same call, so the module-level handoff is safe).
let showContrast = true;

// The "Color ramps" tab: every palette / token visualization.
function renderRampsTab(
  set: RampSet,
  surface: Oklch,
  state: ThemeInputs,
  mode: "light" | "dark",
): string {
  const caption = `<p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>`;
  return (
    caption +
    renderRamps(set, surface) +
    renderLabelOnFill(set) +
    renderDarkSurfaces(state) +
    renderBrand(state) +
    (state.alpha ? renderAlphaRamps(set) : "")
  );
}

export function renderPreview(
  state: ThemeInputs,
  mode: "light" | "dark",
  root: HTMLElement,
  opts: { showContrast?: boolean; tab?: "ramps" | "playground" } = {},
): void {
  showContrast = opts.showContrast ?? true;
  const tab = opts.tab ?? "ramps";
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  surfaceLabel = mode === "light" ? "neutral-0" : "dark surface";
  const vars = semanticVars(state, set, mode);

  // Delegated copy-to-clipboard for any swatch carrying a data-hex (ramp chips,
  // brand swatches). Bound once on the (React-owned, stable) content container;
  // survives innerHTML rebuilds.
  if (!root.dataset.copyBound) {
    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hex]");
      const hex = el?.getAttribute("data-hex");
      if (!el || !hex) return;
      navigator.clipboard.writeText(hex).then(() => {
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 1000);
      }).catch(() => {});
    });
    root.dataset.copyBound = "1";
  }

  root.innerHTML =
    tab === "playground"
      ? renderPlaygroundTab(vars)
      : renderRampsTab(set, surface, state, mode);
}
