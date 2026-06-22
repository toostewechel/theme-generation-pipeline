import { oklch, formatHex } from "culori";
import type { ThemeInputs, HueSeed } from "@project/src/engine/index.js";

type OnChange = (next: ThemeInputs) => void;

// Representative lightness for the swatch + hex field. The seed only carries
// hue + chroma; the ramp generates every lightness step, so we show the seed's
// character at one fixed lightness.
const REP_L = 0.62;
const CHROMA_MAX = 0.3;
const CHROMA_STEP = 0.005;

function hexOf(hue: number, chroma: number): string {
  return formatHex({ mode: "oklch", l: REP_L, c: chroma, h: hue });
}

/** Parse a pasted hex into a seed. Keeps hue + chroma, discards lightness
 * (the ramp generates lightness). Returns null if unparseable. */
function parseHex(input: string): HueSeed | null {
  const c = oklch(input.trim());
  if (!c) return null;
  const hue = Math.round((((c.h ?? 0) % 360) + 360) % 360);
  const raw = Math.min(CHROMA_MAX, Math.max(0, c.c ?? 0));
  const chroma = Math.round(raw / CHROMA_STEP) * CHROMA_STEP;
  return { hue, chroma };
}

// Representative hue spectrum for a hue-slider track (fixed chroma/lightness).
function hueTrack(): string {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 30) stops.push(`oklch(0.72 0.15 ${h})`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
// Gray -> saturated at a given hue, for a chroma-slider track.
function chromaTrack(hue: number): string {
  return `linear-gradient(90deg, oklch(0.72 0 ${hue}), oklch(0.72 0.3 ${hue}))`;
}
// A mid-lightness sample of the seed, for the swatch.
function swatchColor(seed: HueSeed): string {
  return `oklch(0.62 ${seed.chroma} ${seed.hue})`;
}

const CONTRAST_ALIASES: [string, number][] = [["low", 0.25], ["default", 0.5], ["high", 0.85]];
function nearestAlias(v: number): string {
  let best = CONTRAST_ALIASES[0];
  for (const a of CONTRAST_ALIASES) if (Math.abs(a[1] - v) < Math.abs(best[1] - v)) best = a;
  return best[0];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function range(min: number, max: number, step: number, value: number): HTMLInputElement {
  const r = el("input", "rng");
  r.type = "range";
  r.min = String(min);
  r.max = String(max);
  r.step = String(step);
  r.value = String(value);
  return r;
}

/** A labeled hue + chroma control for one seed. Updates its own swatch + values
 * in place on input (never rebuilt), then emits the new seed upward. */
function seedControl(name: string, seed: HueSeed, onSeed: (s: HueSeed) => void): HTMLElement {
  const wrap = el("div", "seed");

  const head = el("div", "seed-head");
  const swatch = el("span", "swatch");
  swatch.style.background = swatchColor(seed);
  const hex = el("input", "hex") as HTMLInputElement;
  hex.type = "text";
  hex.spellcheck = false;
  hex.value = hexOf(seed.hue, seed.chroma);
  hex.title = "Paste a brand hex — its hue & chroma seed the ramp; lightness is generated";
  head.append(swatch, el("span", "seed-name", name), hex);
  wrap.appendChild(head);

  // hue row
  const hueRow = el("div", "slider-row");
  const hue = range(0, 360, 1, seed.hue);
  hue.style.backgroundImage = hueTrack();
  const hueVal = el("span", "val", `${seed.hue}°`);
  hueRow.append(el("span", "lbl", "hue"), hue, hueVal);

  // chroma row
  const chrRow = el("div", "slider-row");
  const chr = range(0, 0.3, 0.005, seed.chroma);
  chr.style.backgroundImage = chromaTrack(seed.hue);
  const chrVal = el("span", "val", seed.chroma.toFixed(3));
  chrRow.append(el("span", "lbl", "chr"), chr, chrVal);

  wrap.append(hueRow, chrRow);

  const emit = () => {
    const next: HueSeed = { hue: Number(hue.value), chroma: Number(chr.value) };
    swatch.style.background = swatchColor(next);
    hueVal.textContent = `${next.hue}°`;
    chrVal.textContent = next.chroma.toFixed(3);
    chr.style.backgroundImage = chromaTrack(next.hue); // keep chroma track in this hue
    hex.value = hexOf(next.hue, next.chroma);
    hex.classList.remove("hex--bad");
    onSeed(next);
  };
  hue.addEventListener("input", emit);
  chr.addEventListener("input", emit);

  // Paste / type a brand hex to seed this accent.
  hex.addEventListener("change", () => {
    const parsed = parseHex(hex.value);
    if (!parsed) {
      hex.classList.add("hex--bad");
      hex.value = hexOf(Number(hue.value), Number(chr.value));
      setTimeout(() => hex.classList.remove("hex--bad"), 900);
      return;
    }
    hue.value = String(parsed.hue);
    chr.value = String(parsed.chroma);
    emit();
  });

  return wrap;
}

function group(title: string, children: HTMLElement[]): HTMLElement {
  const g = el("div", "group");
  g.appendChild(el("h2", "group-title", title));
  for (const c of children) g.appendChild(c);
  return g;
}

/**
 * Build the controls DOM ONCE. Holds an internal `current` copy of the inputs;
 * each control mutates only its own DOM on drag and emits the full next state
 * through `onChange`. The control DOM is never rebuilt, so dragging stays smooth.
 */
export function mountControls(initial: ThemeInputs, onChange: OnChange): void {
  const root = document.getElementById("controls")!;
  root.innerHTML = "";
  let current = initial;

  // Foundation: neutral seed + contrast
  const neutral = seedControl("neutral", current.neutral, (s) => {
    current = { ...current, neutral: s };
    onChange(current);
  });

  const contrastRow = el("div", "slider-row wide");
  const contrastVal0 = typeof current.contrast === "number" ? current.contrast : 0.5;
  const contrast = range(0, 1, 0.01, contrastVal0);
  contrast.classList.add("rng-plain");
  const contrastVal = el("span", "val", `${contrastVal0.toFixed(2)} · ${nearestAlias(contrastVal0)}`);
  contrast.addEventListener("input", () => {
    const v = Number(contrast.value);
    contrastVal.textContent = `${v.toFixed(2)} · ${nearestAlias(v)}`;
    current = { ...current, contrast: v };
    onChange(current);
  });
  contrastRow.append(el("span", "lbl", "ctr"), contrast, contrastVal);

  root.appendChild(group("Foundation", [neutral, contrastRow]));

  // Accents
  const accentControls = (["primary", "secondary", "tertiary"] as const).map((key) =>
    seedControl(key, current.accents[key], (s) => {
      current = { ...current, accents: { ...current.accents, [key]: s } };
      onChange(current);
    }),
  );
  root.appendChild(group("Accents", accentControls));

  // Status
  const statusControls = (["success", "error", "warning", "info"] as const).map((key) =>
    seedControl(key, current.status[key], (s) => {
      current = { ...current, status: { ...current.status, [key]: s } };
      onChange(current);
    }),
  );
  root.appendChild(group("Status", statusControls));
}
