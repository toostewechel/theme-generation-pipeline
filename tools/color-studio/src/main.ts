import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderControls } from "./ui/controls.js";
import { renderPreview } from "./ui/preview.js";

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

rerender();
