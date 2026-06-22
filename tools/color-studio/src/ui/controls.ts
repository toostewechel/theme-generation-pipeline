import type { ThemeInputs, HueSeed } from "@project/src/engine/index.js";

type OnChange = (next: ThemeInputs) => void;

function seedControl(
  label: string,
  seed: HueSeed,
  onInput: (s: HueSeed) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.margin = "8px 0";
  const title = document.createElement("div");
  title.textContent = label;
  title.style.fontSize = "12px";
  wrap.appendChild(title);

  const hue = document.createElement("input");
  hue.type = "range"; hue.min = "0"; hue.max = "360"; hue.step = "1";
  hue.value = String(seed.hue);
  const chroma = document.createElement("input");
  chroma.type = "range"; chroma.min = "0"; chroma.max = "0.3"; chroma.step = "0.005";
  chroma.value = String(seed.chroma);

  const emit = () => onInput({ hue: Number(hue.value), chroma: Number(chroma.value) });
  hue.addEventListener("input", emit);
  chroma.addEventListener("input", emit);
  wrap.append(hue, chroma);
  return wrap;
}

export function renderControls(state: ThemeInputs, onChange: OnChange): void {
  const root = document.getElementById("controls")!;
  root.innerHTML = "<h2 style='font-size:14px'>Inputs</h2>";

  root.appendChild(seedControl("neutral", state.neutral, (s) => onChange({ ...state, neutral: s })));

  const contrast = document.createElement("input");
  contrast.type = "range"; contrast.min = "0"; contrast.max = "1"; contrast.step = "0.01";
  contrast.value = String(typeof state.contrast === "number" ? state.contrast : 0.5);
  contrast.addEventListener("input", () => onChange({ ...state, contrast: Number(contrast.value) }));
  const cl = document.createElement("div"); cl.textContent = "contrast"; cl.style.fontSize = "12px";
  root.append(cl, contrast);

  for (const key of ["primary", "secondary", "tertiary"] as const) {
    root.appendChild(
      seedControl(`accent.${key}`, state.accents[key], (s) =>
        onChange({ ...state, accents: { ...state.accents, [key]: s } })),
    );
  }
  for (const key of ["success", "error", "warning", "info"] as const) {
    root.appendChild(
      seedControl(`status.${key}`, state.status[key], (s) =>
        onChange({ ...state, status: { ...state.status, [key]: s } })),
    );
  }
}
