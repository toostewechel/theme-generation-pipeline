import "./styles.css";
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { mountControls } from "./ui/controls.js";
import { renderPreview } from "./ui/preview.js";
import { serializeConfig } from "./serialize.js";
import { copyTokensForFigma } from "./export-figma.js";

let state: ThemeInputs = structuredClone(themeInputs);
let mode: "light" | "dark" = "light";

// Preview re-renders are coalesced to one per frame so dragging a slider stays
// smooth even though every input event updates state.
let frame = 0;
function schedulePreview(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderPreview(state, mode);
  });
}

// Build the controls ONCE. The control DOM is never rebuilt on input, so the
// slider you are dragging is never recreated mid-drag.
mountControls(state, (next) => {
  state = next;
  schedulePreview();
});

const modeToggle = document.getElementById("mode-toggle")!;
function syncMode() {
  modeToggle.textContent = mode === "light" ? "☀ Light" : "☾ Dark";
  // Drive app chrome (sidebar) theming too, not just the preview pane.
  document.documentElement.classList.toggle("mode-dark", mode === "dark");
}
modeToggle.addEventListener("click", () => {
  mode = mode === "light" ? "dark" : "light";
  syncMode();
  schedulePreview();
});

const saveBtn = document.getElementById("save-btn")!;
saveBtn.addEventListener("click", async () => {
  saveBtn.textContent = "Saving…";
  try {
    const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
    saveBtn.classList.toggle("btn--ok", res.ok);
    saveBtn.textContent = res.ok ? "Saved ✓" : "Save failed";
  } catch {
    saveBtn.textContent = "Save failed";
  }
  setTimeout(() => {
    saveBtn.classList.remove("btn--ok");
    saveBtn.textContent = "Save to config";
  }, 1600);
});

const exportBtn = document.getElementById("export-figma-btn")!;
exportBtn.addEventListener("click", async () => {
  exportBtn.textContent = "Copying…";
  const ok = await copyTokensForFigma(state);
  exportBtn.classList.toggle("btn--ok", ok);
  exportBtn.textContent = ok ? "Copied ✓" : "Copy failed";
  setTimeout(() => {
    exportBtn.classList.remove("btn--ok");
    exportBtn.textContent = "Copy for Figma";
  }, 1600);
});

syncMode();
renderPreview(state, mode);
