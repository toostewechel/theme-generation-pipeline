import { buildRamps, type RampSet, type Oklch } from "@project/src/engine/index.js";
import themeInputs from "@project/theme.config.js";

function css(c: Oklch): string {
  const a = c.alpha === undefined ? "" : ` / ${c.alpha}`;
  return `oklch(${c.l} ${c.c} ${c.h}${a})`;
}

function renderRamps(set: RampSet) {
  const root = document.getElementById("ramps")!;
  root.innerHTML = "";
  for (const [name, ramp] of Object.entries(set)) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "4px";
    row.style.margin = "6px 0";
    const label = document.createElement("code");
    label.textContent = name.padEnd(10);
    label.style.width = "90px";
    row.appendChild(label);
    for (const [step, color] of Object.entries(ramp as Record<string, Oklch>)) {
      const chip = document.createElement("div");
      chip.title = `${name}-${step}`;
      chip.style.width = "34px";
      chip.style.height = "34px";
      chip.style.background = css(color);
      chip.style.borderRadius = "4px";
      row.appendChild(chip);
    }
    root.appendChild(row);
  }
}

renderRamps(buildRamps(themeInputs));
