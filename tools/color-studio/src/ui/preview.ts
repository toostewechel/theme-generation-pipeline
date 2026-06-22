import {
  buildRamps, resolveSemantics, contrastRatio,
  type ThemeInputs, type Oklch, type RampSet,
} from "@project/src/engine/index.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function renderRamps(set: RampSet, surface: Oklch) {
  const root = document.getElementById("ramps")!;
  root.innerHTML = "<h3 style='font-size:13px'>Ramps</h3>";
  for (const [name, ramp] of Object.entries(set)) {
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "4px"; row.style.margin = "4px 0";
    const label = document.createElement("code");
    label.textContent = name; label.style.width = "90px";
    row.appendChild(label);
    for (const [step, color] of Object.entries(ramp as Record<string, Oklch>)) {
      const chip = document.createElement("div");
      chip.style.width = "40px"; chip.style.height = "40px";
      chip.style.background = css(color); chip.style.borderRadius = "4px";
      chip.style.fontSize = "8px"; chip.style.color = "white";
      chip.title = `${name}-${step}: ${contrastRatio(color, surface).toFixed(2)}:1 vs surface`;
      row.appendChild(chip);
    }
    root.appendChild(row);
  }
}

function renderSample(set: RampSet, surface: Oklch) {
  const root = document.getElementById("sample")!;
  root.innerHTML = "<h3 style='font-size:13px'>Sample UI</h3>";
  const card = document.createElement("div");
  card.style.background = css(surface);
  card.style.padding = "16px";
  card.style.borderRadius = "8px";
  card.style.maxWidth = "320px";
  card.innerHTML = `
    <p style="color:${css(set.neutral["800"])}">Body text on the default surface.</p>
    <button style="background:${css(set.accent["500"])};color:white;border:none;padding:8px 14px;border-radius:6px">Primary</button>
  `;
  root.appendChild(card);
}

export function renderPreview(state: ThemeInputs, mode: "light" | "dark"): void {
  const set = buildRamps(state);
  resolveSemantics(set, state, mode); // exercises the resolver path
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  document.body.style.background = mode === "light" ? "#fff" : "#111";
  renderRamps(set, surface);
  renderSample(set, surface);
}
