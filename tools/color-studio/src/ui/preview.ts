import {
  buildRamps, resolveSemantics, contrastRatio,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function readableOn(bg: Oklch, set: RampSet): string {
  // pick black/white-ish neutral text that reads on a chip, for the step label
  return contrastRatio(set.neutral["0"], bg) >= contrastRatio(set.neutral["950"], bg)
    ? css(set.neutral["0"])
    : css(set.neutral["950"]);
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

function renderSample(set: RampSet, mode: "light" | "dark"): string {
  const text = mode === "light" ? set.neutral["800"] : set.neutral["100"];
  const muted = mode === "light" ? set.neutral["600"] : set.neutral["400"];
  return `<div class="pv-section"><div class="pv-section-title">In context</div>
    <div class="sample">
      <h4 style="color:${css(text)}">Tune the seed, read it in place</h4>
      <p style="color:${css(muted)}">Body copy on the default surface, with a primary action and a status pill below.</p>
      <div class="sample-row">
        <button class="sample-btn" style="background:${css(set.accent["500"])};color:${css(set.neutral["0"])}">Primary action</button>
        <span class="sample-chip" style="background:${css(set.success["100"])};color:${css(set.success["700"])}">Success</span>
        <span class="sample-chip" style="background:${css(set.error["100"])};color:${css(set.error["700"])}">Error</span>
      </div>
    </div></div>`;
}

export function renderPreview(state: ThemeInputs, mode: "light" | "dark"): void {
  const set = buildRamps(state);
  resolveSemantics(set, state, mode); // exercises the resolver path
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];

  const root = document.getElementById("preview")!;
  root.className = mode === "light" ? "mode-light" : "mode-dark";

  // Header + sections. The mode bar / footer live in the sidebar, so the
  // preview pane is pure output.
  const head = `<h3 class="pv-title">Preview</h3>
    <p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>`;

  // Keep the header element stable; only swap the generated body.
  let body = document.getElementById("pv-body");
  if (!body) {
    root.innerHTML = `${head}<div id="pv-body"></div>`;
    body = document.getElementById("pv-body")!;
  } else {
    // refresh the subtitle count/mode without clobbering scroll of the whole pane
    const sub = root.querySelector(".pv-sub");
    if (sub) sub.textContent = `Generated ${Object.keys(set).length} ramps · ${mode} surface`;
  }
  body.innerHTML = renderRamps(set, surface) + renderSample(set, mode);
}
