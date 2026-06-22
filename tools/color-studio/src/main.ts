import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderControls } from "./ui/controls.js";
import { renderPreview } from "./ui/preview.js";
import { serializeConfig } from "./serialize.js";

let state: ThemeInputs = structuredClone(themeInputs);
let mode: "light" | "dark" = "light";

function rerender() {
  renderControls(state, (next) => { state = next; rerender(); });
  renderPreview(state, mode);
  const toggle = document.getElementById("mode-toggle")!;
  toggle.textContent = `Mode: ${mode}`;
}

document.getElementById("mode-toggle")!.addEventListener("click", () => {
  mode = mode === "light" ? "dark" : "light";
  rerender();
});

document.getElementById("save-btn")!.addEventListener("click", async () => {
  const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
  const btn = document.getElementById("save-btn")!;
  btn.textContent = res.ok ? "Saved ✓" : "Save failed";
  setTimeout(() => (btn.textContent = "Save to theme.config.ts"), 1500);
});

rerender();
