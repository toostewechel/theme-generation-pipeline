import {
  type RadiusParams,
  type Mode,
  type Size,
  MODES,
  SIZES,
  computeAll,
  buildDefaultParams,
  getHardcodedDefaults,
} from "./compute.js";
import {
  renderModeColumns,
  renderValuesTable,
  renderGraph,
  renderCSSOutput,
} from "./render.js";
import "./styles.css";

// ─── Token Loading ──────────────────────────────────────────────────

const primitivesModules = import.meta.glob<{ default: Record<string, any> }>(
  "@project/src/tokens/primitives-radius.*.tokens.json",
  { eager: true },
);

const modeModules = import.meta.glob<{ default: Record<string, any> }>(
  "@project/src/tokens/radius.*.tokens.json",
  { eager: true },
);

function loadTokens(): RadiusParams {
  // Primitives
  const primEntries = Object.values(primitivesModules);
  if (primEntries.length === 0) {
    console.warn(
      "No primitives-radius tokens found. Using hardcoded defaults.",
    );
    return getHardcodedDefaults();
  }
  const primitives = primEntries[0].default;

  // Mode tokens — extract mode name from filename
  const modeTokens: Record<string, Record<string, any>> = {};
  for (const [path, mod] of Object.entries(modeModules)) {
    const match = path.match(/radius\.(\w+)\.tokens\.json$/);
    if (match) {
      modeTokens[match[1]] = mod.default;
    }
  }

  return buildDefaultParams(primitives, modeTokens);
}

// ─── State ──────────────────────────────────────────────────────────

let defaultParams: RadiusParams;
let params: RadiusParams;
let visibleModes: Set<Mode> = new Set(MODES);

try {
  defaultParams = loadTokens();
} catch (e) {
  console.warn("Error loading tokens, using defaults:", e);
  defaultParams = getHardcodedDefaults();
}
params = structuredClone(defaultParams);

// ─── DOM References ─────────────────────────────────────────────────

const $ = (id: string) => document.getElementById(id)!;

// ─── Render ─────────────────────────────────────────────────────────

function render(): void {
  const computed = computeAll(params);

  renderModeColumns($("mode-columns"), computed, params, visibleModes);
  renderValuesTable($("values-table-container"), computed, visibleModes);
  renderGraph($("graph-container"), $("graph-legend"), computed);
  renderCSSOutput($("css-output"), params);
}

// ─── Sync Form ← State ─────────────────────────────────────────────

function syncFormFromState(): void {
  const unitInput = $("param-unit") as HTMLInputElement;
  const unitSlider = $("param-unit-slider") as HTMLInputElement;
  unitInput.value = String(params.unit);
  unitSlider.value = String(params.unit);

  for (const mode of MODES) {
    const input = $(`param-mode-${mode}`) as HTMLInputElement;
    input.value = String(params.modes[mode]);
  }

  for (const size of SIZES) {
    const scaleInput = $(`param-scale-${size}`) as HTMLInputElement;
    scaleInput.value = String(params.scales[size]);
    const capInput = $(`param-cap-${size}`) as HTMLInputElement;
    capInput.value = String(params.caps[size]);
  }
}

// ─── Events ─────────────────────────────────────────────────────────

function setupEvents(): void {
  // Unit: slider ↔ number input
  const unitInput = $("param-unit") as HTMLInputElement;
  const unitSlider = $("param-unit-slider") as HTMLInputElement;

  unitSlider.addEventListener("input", () => {
    params.unit = parseFloat(unitSlider.value);
    unitInput.value = unitSlider.value;
    render();
  });

  unitInput.addEventListener("input", () => {
    const v = parseFloat(unitInput.value);
    if (!isNaN(v) && v >= 0) {
      params.unit = v;
      unitSlider.value = String(v);
      render();
    }
  });

  // Mode intensities
  for (const mode of MODES) {
    const input = $(`param-mode-${mode}`) as HTMLInputElement;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      if (!isNaN(v) && v >= 0) {
        params.modes[mode] = v;
        render();
      }
    });
  }

  // Scale multipliers
  for (const size of SIZES) {
    const input = $(`param-scale-${size}`) as HTMLInputElement;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      if (!isNaN(v) && v >= 0) {
        params.scales[size] = v;
        render();
      }
    });
  }

  // Geometric caps
  for (const size of SIZES) {
    const input = $(`param-cap-${size}`) as HTMLInputElement;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      if (!isNaN(v) && v >= 0) {
        params.caps[size] = v;
        render();
      }
    });
  }

  // Mode visibility toggles
  const toggles = document.querySelectorAll<HTMLInputElement>(
    ".mode-toggle input[data-mode]",
  );
  for (const toggle of toggles) {
    toggle.addEventListener("change", () => {
      const mode = toggle.dataset.mode as Mode;
      if (toggle.checked) {
        visibleModes.add(mode);
      } else {
        visibleModes.delete(mode);
      }
      render();
    });
  }

  // Reset
  $("reset-btn").addEventListener("click", (e) => {
    e.preventDefault();
    params = structuredClone(defaultParams);
    syncFormFromState();
    render();
  });

  // Copy CSS
  $("copy-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const output = $("css-output").textContent ?? "";
    navigator.clipboard.writeText(output).then(() => {
      const btn = $("copy-btn");
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy CSS"), 1500);
    });
  });
}

// ─── Init ───────────────────────────────────────────────────────────

syncFormFromState();
setupEvents();
render();
