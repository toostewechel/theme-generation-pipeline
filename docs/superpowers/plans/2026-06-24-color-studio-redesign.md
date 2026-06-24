# Color Studio Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Color Studio's vanilla-TS sidebar to a React + Base UI app with a sleeker, more legible "instrument" UI and clearer designer-facing copy, leaving the theme engine and the preview's visuals intact.

**Architecture:** A small React app mounted at `#root`. `App` owns the single `ThemeInputs` state plus the light/dark `mode`, captures the initial config as the "defaults" baseline, and re-renders the preview at most once per animation frame. Controls are Base UI primitives (Slider, NumberField, Collapsible, Toggle, Tooltip, Toast). The existing theme engine, the `serialize`/`export-figma` helpers, and the Vite `save-theme` middleware are reused unchanged; the preview is ported to a React component but not restyled.

**Tech Stack:** React 19, `@base-ui-components/react` 1.0.0-rc.0, Vite 6 + `@vitejs/plugin-react`, TypeScript 5.7, Vitest 2 (node environment), culori.

## Global Constraints

- **Scope:** only `tools/color-studio/`. Never modify `src/engine/`, `scripts/`, or token files.
- **Branch:** all work on `color-studio-redesign` (already checked out).
- **Engine is read-only:** import from `@project/src/engine/index.js`; do not edit it. Reuse `serializeConfig` (`src/serialize.ts`) and `copyTokensForFigma` (`src/export-figma.ts`) unchanged.
- **Preserve `vite.config.ts` `save-theme` plugin** (the `POST /__save-theme` middleware) and the `@project` alias + `server.fs.allow`. Only add the React plugin alongside it.
- **Performance:** dragging a slider must never unmount/remount controls; the preview re-render must be coalesced to **one update per `requestAnimationFrame`** (port the existing pattern in `src/main.ts`).
- **"Default" = the initial `ThemeInputs` loaded from `theme.config.ts` at startup.** Modified-detection compares current state against that captured baseline.
- **darkSurfaces fallback** when absent in config: `{ base: 0.13, step: 0.042 }` (matches current `main.ts`/`controls.ts`).
- **Base UI is compound-component / "parts" based** (e.g. `Slider.Root` → `Slider.Control` → `Slider.Track` → `Slider.Thumb`). This plan shows the expected shape for rc.0; before relying on a part name, confirm it against `node_modules/@base-ui-components/react` or the rc.0 docs and adjust the JSX if a part was renamed.
- **Resolved design choices** (from the spec's open list): "?" help uses Base UI **`Tooltip`**; the **global reset** is a small ghost "Reset all" button at the footer's left; the **contrast value box is read-only** (displays `0.50 · default`, not an editable NumberField).
- **Copy is fixed** — use the exact strings in Task 9's copy table; do not paraphrase.
- **Verify after each task:** `npm test` from the repo root must stay green.

---

## File Structure

**Created (under `tools/color-studio/`):**
- `src/main.tsx` — React entry; mounts `<App/>`, imports `styles.css`.
- `src/App.tsx` — state container, frame-throttled preview, save/copy handlers, Toast provider.
- `src/components/Sidebar.tsx` — header (title + mode Toggle), the four `Section`s, footer.
- `src/components/Section.tsx` — `Collapsible` wrapper + modified diamond + reset + open/closed persistence.
- `src/components/SeedControl.tsx` — swatch chip + hex field + hue/chroma `ParamSlider`s.
- `src/components/ParamSlider.tsx` — labeled Base UI Slider + value readout (NumberField or static) + optional gradient track, ticks, and "?" tooltip / inline description.
- `src/components/FigmaIcon.tsx` — inline multicolor Figma logo SVG.
- `src/lib/controls-math.ts` — pure helpers moved out of the old `controls.ts` (hex parse/format, tracks, alias).
- `src/lib/controls-math.test.ts` — tests for the above.
- `src/lib/theme-state.ts` — defaults baseline + pure modified-detection / reset helpers.
- `src/lib/theme-state.test.ts` — tests for the above.

**Modified:**
- `tools/color-studio/package.json` — add React/Base UI deps + plugin.
- `tools/color-studio/vite.config.ts` — add `@vitejs/plugin-react`.
- `tools/color-studio/tsconfig.json` — `"jsx": "react-jsx"`.
- `tools/color-studio/index.html` — replace `aside/main` markup with `<div id="root">`, script → `main.tsx`.
- `tools/color-studio/src/styles.css` — rewritten for the new structure.
- `tools/color-studio/src/ui/preview.ts` — `renderPreview` gains a `root` parameter.

**Deleted (after the port works):**
- `src/main.ts`, `src/ui/controls.ts`.

---

## Task 1: Scaffold React + Base UI app shell

**Files:**
- Modify: `tools/color-studio/package.json`
- Modify: `tools/color-studio/vite.config.ts`
- Modify: `tools/color-studio/tsconfig.json`
- Modify: `tools/color-studio/index.html`
- Create: `tools/color-studio/src/main.tsx`
- Create: `tools/color-studio/src/App.tsx`

**Interfaces:**
- Produces: `App` (default export, `() => JSX.Element`) — full sidebar+preview app, stubbed here.

- [ ] **Step 1: Install dependencies**

```bash
cd tools/color-studio
npm install react@^19 react-dom@^19 @base-ui-components/react@1.0.0-rc.0
npm install -D @vitejs/plugin-react @types/react @types/react-dom
```

- [ ] **Step 2: Enable JSX in tsconfig**

In `tools/color-studio/tsconfig.json`, ensure `compilerOptions` contains:

```json
"jsx": "react-jsx",
"lib": ["DOM", "DOM.Iterable", "ES2022"]
```

- [ ] **Step 3: Add the React plugin to Vite (keep save-theme + alias)**

Edit `tools/color-studio/vite.config.ts` — import the plugin and add it to the `plugins` array, leaving `saveThemePlugin()`, the `@project` alias, and `server.fs.allow` intact:

```ts
import react from "@vitejs/plugin-react";
// ...
export default defineConfig({
  root: ".",
  plugins: [react(), saveThemePlugin()],
  resolve: { alias: { "@project": projectRoot } },
  server: { open: true, fs: { allow: [projectRoot] } },
});
```

- [ ] **Step 4: Replace index.html body with a React root**

Replace the `<body>` of `tools/color-studio/index.html` with:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

- [ ] **Step 5: Create a stub App**

`tools/color-studio/src/App.tsx`:

```tsx
export default function App() {
  return <div id="app"><aside id="sidebar">Color Studio</aside><main id="preview" /></div>;
}
```

- [ ] **Step 6: Create the React entry**

`tools/color-studio/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Verify the dev server boots React**

Run: `npm run dev` (from `tools/color-studio`). Open the served URL.
Expected: page shows "Color Studio" with no console errors. Stop the server (Ctrl-C).

- [ ] **Step 8: Commit**

```bash
cd ../..
git add tools/color-studio/package.json tools/color-studio/package-lock.json tools/color-studio/vite.config.ts tools/color-studio/tsconfig.json tools/color-studio/index.html tools/color-studio/src/main.tsx tools/color-studio/src/App.tsx
git commit -m "feat(color-studio): scaffold React + Base UI app shell"
```

---

## Task 2: Pure control-math helpers (TDD)

Move the framework-agnostic math out of the old `controls.ts` into a tested module the components will import.

**Files:**
- Create: `tools/color-studio/src/lib/controls-math.ts`
- Test: `tools/color-studio/src/lib/controls-math.test.ts`

**Interfaces:**
- Produces:
  - `REP_L = 0.62`, `CHROMA_MAX = 0.3`, `CHROMA_STEP = 0.005` (consts)
  - `hexOf(hue: number, chroma: number, l: number): string`
  - `parseHex(input: string): { hue: number; chroma: number; l: number } | null`
  - `hueTrack(): string` — CSS gradient for a hue track
  - `chromaTrack(hue: number): string` — CSS gradient gray→saturated at a hue
  - `swatchCss(l: number, hue: number, chroma: number): string`
  - `CONTRAST_ALIASES: [string, number][]` = `[["low",0.25],["default",0.5],["high",0.85]]`
  - `nearestAlias(v: number): string`

- [ ] **Step 1: Write the failing tests**

`tools/color-studio/src/lib/controls-math.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hexOf, parseHex, nearestAlias, CONTRAST_ALIASES, hueTrack, chromaTrack } from "./controls-math.js";

describe("parseHex", () => {
  it("parses a valid hex into hue/chroma/l", () => {
    const p = parseHex("#3aa06a");
    expect(p).not.toBeNull();
    expect(p!.hue).toBeGreaterThan(120);
    expect(p!.hue).toBeLessThan(170);
    expect(p!.chroma).toBeGreaterThan(0);
  });
  it("snaps chroma to CHROMA_STEP and clamps to CHROMA_MAX", () => {
    const p = parseHex("#00ff00")!;
    expect(Math.round(p.chroma / 0.005)).toBeCloseTo(p.chroma / 0.005, 5);
    expect(p.chroma).toBeLessThanOrEqual(0.3);
  });
  it("returns null for garbage", () => {
    expect(parseHex("not-a-color")).toBeNull();
  });
});

describe("hexOf", () => {
  it("round-trips through parseHex within hue tolerance", () => {
    const hex = hexOf(150, 0.16, 0.62);
    const p = parseHex(hex)!;
    expect(Math.abs(p.hue - 150)).toBeLessThanOrEqual(2);
  });
});

describe("nearestAlias", () => {
  it("maps values to the nearest named alias", () => {
    expect(nearestAlias(0.0)).toBe("low");
    expect(nearestAlias(0.5)).toBe("default");
    expect(nearestAlias(0.95)).toBe("high");
  });
  it("exposes the three aliases", () => {
    expect(CONTRAST_ALIASES.map((a) => a[0])).toEqual(["low", "default", "high"]);
  });
});

describe("tracks", () => {
  it("hueTrack is a linear-gradient string", () => {
    expect(hueTrack()).toContain("linear-gradient");
  });
  it("chromaTrack embeds the hue", () => {
    expect(chromaTrack(150)).toContain("150");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- controls-math` (from repo root)
Expected: FAIL — cannot resolve `./controls-math.js`.

- [ ] **Step 3: Implement the module**

`tools/color-studio/src/lib/controls-math.ts` (lift verbatim from the old `controls.ts`):

```ts
import { oklch, formatHex } from "culori";

export const REP_L = 0.62;
export const CHROMA_MAX = 0.3;
export const CHROMA_STEP = 0.005;

export function hexOf(hue: number, chroma: number, l: number): string {
  return formatHex({ mode: "oklch", l, c: chroma, h: hue });
}

export interface ParsedHex { hue: number; chroma: number; l: number; }

export function parseHex(input: string): ParsedHex | null {
  const c = oklch(input.trim());
  if (!c) return null;
  const hue = Math.round((((c.h ?? 0) % 360) + 360) % 360);
  const raw = Math.min(CHROMA_MAX, Math.max(0, c.c ?? 0));
  const chroma = Math.round(raw / CHROMA_STEP) * CHROMA_STEP;
  const l = Math.min(1, Math.max(0, c.l ?? REP_L));
  return { hue, chroma, l };
}

export function hueTrack(): string {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 30) stops.push(`oklch(0.72 0.15 ${h})`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function chromaTrack(hue: number): string {
  return `linear-gradient(90deg, oklch(0.72 0 ${hue}), oklch(0.72 0.3 ${hue}))`;
}

export function swatchCss(l: number, hue: number, chroma: number): string {
  return `oklch(${l} ${chroma} ${hue})`;
}

export const CONTRAST_ALIASES: [string, number][] = [["low", 0.25], ["default", 0.5], ["high", 0.85]];

export function nearestAlias(v: number): string {
  let best = CONTRAST_ALIASES[0];
  for (const a of CONTRAST_ALIASES) if (Math.abs(a[1] - v) < Math.abs(best[1] - v)) best = a;
  return best[0];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- controls-math`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio/src/lib/controls-math.ts tools/color-studio/src/lib/controls-math.test.ts
git commit -m "feat(color-studio): extract tested control-math helpers"
```

---

## Task 3: Defaults baseline + modified-detection (TDD)

**Files:**
- Create: `tools/color-studio/src/lib/theme-state.ts`
- Test: `tools/color-studio/src/lib/theme-state.test.ts`

**Interfaces:**
- Consumes: `ThemeInputs`, `HueSeed` from `@project/src/engine/index.js` (types only).
- Produces:
  - `type SectionKey = "foundation" | "accents" | "status" | "darkSurfaces"`
  - `withDarkSurfaceFallback(t: ThemeInputs): ThemeInputs` — returns a clone guaranteeing `darkSurfaces` is set (fallback `{base:0.13, step:0.042}`).
  - `isSectionModified(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): boolean`
  - `resetSection(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): ThemeInputs` — returns a new `ThemeInputs` with that section's values restored from baseline (other sections untouched).

`isSectionModified` compares only the relevant slice: `foundation` → `{neutral, contrast}`; `accents` → `accents`; `status` → `status`; `darkSurfaces` → `darkSurfaces`. Compare by `JSON.stringify` of the slice.

- [ ] **Step 1: Write the failing tests**

`tools/color-studio/src/lib/theme-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isSectionModified, resetSection, withDarkSurfaceFallback } from "./theme-state.js";
import type { ThemeInputs } from "@project/src/engine/types.js";

const base: ThemeInputs = {
  neutral: { hue: 110, chroma: 0.01 },
  contrast: 0.5,
  accents: { primary: { hue: 150, chroma: 0.16 }, secondary: { hue: 235, chroma: 0.16 }, tertiary: { hue: 330, chroma: 0.16 } },
  status: { success: { hue: 150, chroma: 0.16 }, error: { hue: 25, chroma: 0.19 }, warning: { hue: 80, chroma: 0.16 }, info: { hue: 235, chroma: 0.14 } },
  darkSurfaces: { base: 0.13, step: 0.042 },
};

describe("withDarkSurfaceFallback", () => {
  it("fills missing darkSurfaces with the default", () => {
    const t = withDarkSurfaceFallback({ ...base, darkSurfaces: undefined });
    expect(t.darkSurfaces).toEqual({ base: 0.13, step: 0.042 });
  });
});

describe("isSectionModified", () => {
  it("is false when nothing changed", () => {
    expect(isSectionModified("accents", base, base)).toBe(false);
  });
  it("detects a changed accent hue", () => {
    const cur = { ...base, accents: { ...base.accents, primary: { hue: 200, chroma: 0.16 } } };
    expect(isSectionModified("accents", cur, base)).toBe(true);
    expect(isSectionModified("status", cur, base)).toBe(false);
  });
  it("foundation tracks neutral and contrast", () => {
    const cur = { ...base, contrast: 0.85 as const };
    expect(isSectionModified("foundation", cur, base)).toBe(true);
  });
});

describe("resetSection", () => {
  it("restores only the named section", () => {
    const cur = { ...base, contrast: 0.85 as const, status: { ...base.status, error: { hue: 5, chroma: 0.2 } } };
    const out = resetSection("foundation", cur, base);
    expect(out.contrast).toBe(0.5);
    expect(out.status.error).toEqual({ hue: 5, chroma: 0.2 }); // untouched
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- theme-state`
Expected: FAIL — cannot resolve `./theme-state.js`.

- [ ] **Step 3: Implement the module**

`tools/color-studio/src/lib/theme-state.ts`:

```ts
import type { ThemeInputs } from "@project/src/engine/index.js";

export type SectionKey = "foundation" | "accents" | "status" | "darkSurfaces";

const DARK_SURFACE_FALLBACK = { base: 0.13, step: 0.042 };

export function withDarkSurfaceFallback(t: ThemeInputs): ThemeInputs {
  return { ...t, darkSurfaces: { ...DARK_SURFACE_FALLBACK, ...(t.darkSurfaces ?? {}) } };
}

function slice(section: SectionKey, t: ThemeInputs): unknown {
  switch (section) {
    case "foundation": return { neutral: t.neutral, contrast: t.contrast };
    case "accents": return t.accents;
    case "status": return t.status;
    case "darkSurfaces": return t.darkSurfaces ?? DARK_SURFACE_FALLBACK;
  }
}

export function isSectionModified(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): boolean {
  return JSON.stringify(slice(section, current)) !== JSON.stringify(slice(section, baseline));
}

export function resetSection(section: SectionKey, current: ThemeInputs, baseline: ThemeInputs): ThemeInputs {
  switch (section) {
    case "foundation": return { ...current, neutral: { ...baseline.neutral }, contrast: baseline.contrast };
    case "accents": return { ...current, accents: structuredClone(baseline.accents), brand: structuredClone(baseline.brand) };
    case "status": return { ...current, status: structuredClone(baseline.status) };
    case "darkSurfaces": return { ...current, darkSurfaces: { ...(baseline.darkSurfaces ?? DARK_SURFACE_FALLBACK) } };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- theme-state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio/src/lib/theme-state.ts tools/color-studio/src/lib/theme-state.test.ts
git commit -m "feat(color-studio): add defaults + modified-detection helpers"
```

---

## Task 4: Port the preview to React

Refactor `renderPreview` to accept a root element, then drive it from a React component. No visual changes.

**Files:**
- Modify: `tools/color-studio/src/ui/preview.ts`
- Create: `tools/color-studio/src/components/Preview.tsx`

**Interfaces:**
- Consumes: `renderPreview(state, mode, root)` (modified signature).
- Produces: `Preview` (`(props: { state: ThemeInputs; mode: "light" | "dark" }) => JSX.Element`).

- [ ] **Step 1: Make `renderPreview` accept a root element**

In `tools/color-studio/src/ui/preview.ts`, change the signature and the lookup. Replace the `export function renderPreview(state, mode)` line and its `const root = document.getElementById("preview")!;` line with:

```ts
export function renderPreview(
  state: ThemeInputs,
  mode: "light" | "dark",
  root: HTMLElement = document.getElementById("preview")!,
): void {
  lastState = state;
  lastMode = mode;
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  surfaceLabel = mode === "light" ? "neutral-0" : "dark surface";
  const vars = semanticVars(state, set, mode);
  // root is now the passed-in element
```

Leave the rest of the function body unchanged. The internal contrast-toggle handler calls `renderPreview(lastState, lastMode)` — keep it; it will default to the same element only if `#preview` exists. To stay self-contained, capture the root: add `let lastRoot: HTMLElement | null = null;` near the other module lets, set `lastRoot = root;` at the top of `renderPreview`, and change the contrast `change` handler to call `renderPreview(lastState!, lastMode, lastRoot!)`.

- [ ] **Step 2: Create the Preview component**

`tools/color-studio/src/components/Preview.tsx`:

```tsx
import { useEffect, useRef } from "react";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

export function Preview({ state, mode }: { state: ThemeInputs; mode: "light" | "dark" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) renderPreview(state, mode, ref.current);
  }, [state, mode]);
  return <main id="preview" ref={ref} />;
}
```

- [ ] **Step 3: Render Preview from the stub App**

Replace `tools/color-studio/src/App.tsx` body with a minimal wiring that proves the preview renders (temporary; replaced in Task 9):

```tsx
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Preview } from "./components/Preview.js";

export default function App() {
  const state = structuredClone(themeInputs) as ThemeInputs;
  return (
    <div id="app">
      <aside id="sidebar">Color Studio</aside>
      <Preview state={state} mode="light" />
    </div>
  );
}
```

- [ ] **Step 4: Verify the preview renders**

Run: `npm run dev` (from `tools/color-studio`). Open the URL.
Expected: the full preview (ramps, label-on-fill, dark surfaces, brand, in-context sample) renders to the right of the placeholder sidebar; the in-preview "Contrast" checkbox toggles the contrast badges. No console errors. Stop the server.

- [ ] **Step 5: Commit**

```bash
cd ../.. && git add tools/color-studio/src/ui/preview.ts tools/color-studio/src/components/Preview.tsx tools/color-studio/src/App.tsx
git commit -m "feat(color-studio): port preview to a React component"
```

---

## Task 5: Rewrite the stylesheet for the new structure

Write the full chrome stylesheet the components will use. Classes here are referenced by Tasks 6–9. Keep the OKLCH token palette and dark-mode block from the current `styles.css`; replace the control-specific rules.

**Files:**
- Modify: `tools/color-studio/src/styles.css`

**Interfaces:**
- Produces: CSS classes — `.head`, `.mode-toggle`, `.sec`, `.sec-head`, `.sec-title`, `.sec-desc`, `.sec-diamond`, `.sec-reset`, `.sec-body`, `.seed`, `.seed-head`, `.swatch`, `.swatch > i`, `.seed-name`, `.hex`, `.hex--bad`, `.ctl`, `.ctl-top`, `.ctl-name`, `.ctl-help`, `.ctl-val`, `.vbox`, `.track`, `.track--gradient`, `.track--plain`, `.thumb`, `.tick`, `.tick-row`, `.tick-lbl`, `.ctl-desc`, `.foot`, `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--icon`, `.fig-btn`, `.tooltip`, `.toast`.

- [ ] **Step 1: Keep the token + reset preamble**

Retain lines 1–61 of the current `styles.css` (`:root` tokens, `html.mode-dark` overrides, `*{box-sizing}`, `html,body`, `#app` grid). Keep the entire `/* ---------- Preview ---------- */` section (everything from `#preview` onward) **unchanged** — the preview is not restyled.

- [ ] **Step 2: Replace the sidebar/control CSS**

Replace everything between the `#app` rule and the `/* ---------- Preview ---------- */` marker with the new chrome. Write these rules (values match the approved v3 mockup):

```css
/* ---------- Sidebar shell ---------- */
#sidebar {
  display: flex; flex-direction: column; min-height: 0;
  background: var(--chrome); border-right: 1px solid var(--line);
  overflow-y: auto;
}
.head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  padding: 15px 16px 13px; border-bottom: 1px solid var(--line);
}
.head h1 { margin: 0; font-size: 14px; font-weight: 650; letter-spacing: -0.01em; }
.head p { margin: 3px 0 0; font-size: 11px; color: var(--ink-faint); }
.mode-toggle {
  flex: none; width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink-soft);
  cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; justify-content: center;
}
.mode-toggle:hover { border-color: var(--ink-faint); }

/* ---------- Section ---------- */
.sec { border-top: 1px solid var(--line); }
.sec:first-of-type { border-top: none; }
.sec-head {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 11px 16px 9px; background: none; border: none; cursor: pointer;
  font: inherit; color: var(--ink); text-align: left;
}
.sec-chevron { font-size: 8px; opacity: 0.5; transition: transform 0.15s var(--ease); }
.sec[data-open="false"] .sec-chevron { transform: rotate(-90deg); }
.sec-title { font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
.sec-diamond { width: 7px; height: 7px; background: oklch(0.68 0.19 45); transform: rotate(45deg); flex: none; }
.sec-reset { margin-left: auto; font-size: 12px; color: var(--ink-faint); background: none; border: none; cursor: pointer; }
.sec-reset:hover { color: var(--ink); }
.sec-desc { margin: 0; padding: 0 16px 4px 30px; font-size: 10.5px; line-height: 1.4; color: var(--ink-faint); }
.sec-body { padding: 2px 16px 14px; }

/* ---------- Seed ---------- */
.seed-head { display: flex; align-items: center; gap: 9px; margin: 11px 0 2px; }
.swatch { background: oklch(0.99 0 0); padding: 2px; border-radius: 6px; box-shadow: 0 1px 3px oklch(0 0 0 / 0.16); flex: none; line-height: 0; }
.swatch > i { display: block; width: 14px; height: 14px; border-radius: 4px; }
.seed-name { font-size: 12px; font-weight: 500; }
.hex {
  margin-left: auto; width: 82px; text-align: right; font-family: var(--mono);
  font-size: 10.5px; text-transform: lowercase; color: var(--ink-soft);
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 3px 7px;
}
.hex:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); color: var(--ink); }
.hex--bad { border-color: oklch(0.62 0.19 25); color: oklch(0.55 0.19 25); }

/* ---------- Control (slider + value) ---------- */
.ctl { margin-top: 9px; }
.ctl-top { display: flex; align-items: baseline; gap: 6px; }
.ctl-name { font-size: 11px; font-weight: 600; }
.ctl-val { margin-left: auto; }
.vbox {
  border-radius: var(--radius-sm); padding: 2px 7px; min-width: 50px; text-align: right;
  font-family: var(--mono); font-size: 10.5px; font-variant-numeric: tabular-nums;
  color: var(--ink-soft); background: var(--panel); border: 1px solid var(--line);
}
.vbox:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.ctl-desc { margin: 3px 0 0; font-size: 10.5px; line-height: 1.4; color: var(--ink-faint); }
.ctl-help {
  width: 13px; height: 13px; border-radius: 50%; border: 1px solid var(--line-strong);
  color: var(--ink-faint); font-size: 9px; background: none; cursor: help;
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}

/* ---------- Base UI Slider ---------- */
.track { position: relative; margin-top: 7px; display: flex; align-items: center; width: 100%; }
.track--gradient { height: 12px; border-radius: 999px; }
.track--plain { height: 6px; border-radius: 999px; background: var(--track); }
.thumb {
  width: 17px; height: 17px; border-radius: 50%; background: oklch(0.99 0.003 110);
  border: 1px solid var(--line-strong); box-shadow: 0 1px 2.5px oklch(0 0 0 / 0.22); z-index: 3;
}
.track--plain .thumb { width: 15px; height: 15px; }
.thumb:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.tick { position: absolute; top: -3px; width: 1.5px; height: 12px; background: var(--line-strong); transform: translateX(-50%); border-radius: 1px; z-index: 1; }
.tick-row { position: relative; height: 13px; margin-top: 5px; }
.tick-lbl { position: absolute; transform: translateX(-50%); font-size: 8.5px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }

/* ---------- Footer ---------- */
.foot { display: flex; gap: 8px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--chrome); }
.btn { font: inherit; font-size: 11.5px; font-weight: 550; padding: 8px 11px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); cursor: pointer; }
.btn:hover { border-color: var(--ink-faint); }
.btn--primary { flex: 1; background: var(--accent); border-color: var(--accent); color: oklch(0.99 0.01 150); }
.btn--primary:hover { background: oklch(0.55 0.13 150); border-color: oklch(0.55 0.13 150); }
.btn--ghost { border-color: transparent; color: var(--ink-faint); padding: 8px 8px; }
.btn--ghost:hover { color: var(--ink); border-color: var(--line); }
.btn--icon { padding: 8px 10px; }
.fig-btn svg { width: 15px; height: auto; display: block; }

/* ---------- Tooltip / Toast (Base UI popups) ---------- */
.tooltip { background: oklch(0.22 0.01 110); color: oklch(0.95 0.005 110); font-size: 10.5px; line-height: 1.42; padding: 6px 9px; border-radius: 7px; max-width: 190px; box-shadow: 0 6px 18px oklch(0 0 0 / 0.2); }
.toast { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line-strong); border-radius: 9px; padding: 10px 13px; font-size: 12px; box-shadow: 0 6px 20px oklch(0 0 0 / 0.12); }
.toast[data-type="success"] { border-color: var(--accent); color: var(--accent); }
.toast[data-type="error"] { border-color: oklch(0.62 0.19 25); color: oklch(0.55 0.19 25); }
.toast-viewport { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; }
```

- [ ] **Step 3: Verify the app still compiles and the preview is unaffected**

Run: `npm run dev`. Expected: preview still renders correctly (its CSS is untouched); the placeholder sidebar may look unstyled — that's fine until Task 9. No build errors. Stop the server.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add tools/color-studio/src/styles.css
git commit -m "feat(color-studio): rewrite sidebar chrome stylesheet"
```

---

## Task 6: ParamSlider component

A labeled Base UI Slider with a value readout, plus optional gradient track, ticks, "?" tooltip, and inline description.

**Files:**
- Create: `tools/color-studio/src/components/ParamSlider.tsx`

**Interfaces:**
- Consumes: nothing from sibling components.
- Produces: `ParamSlider` with props:

```ts
interface ParamSliderProps {
  name: string;
  min: number; max: number; step: number;
  value: number;
  onValueChange: (v: number) => void;
  trackStyle?: string;            // CSS background for a gradient track; omit → plain track
  format?: (v: number) => string; // display string for the readout; default String(v)
  editable?: boolean;             // true → NumberField; false/omit → static .vbox span
  help?: string;                  // "?" tooltip text
  description?: string;           // always-visible inline description
  ticks?: { pos: number; label: string }[]; // pos as 0..1 fraction of the track width
}
```

- [ ] **Step 1: Implement the component**

`tools/color-studio/src/components/ParamSlider.tsx`:

```tsx
import { Slider } from "@base-ui-components/react/slider";
import { NumberField } from "@base-ui-components/react/number-field";
import { Tooltip } from "@base-ui-components/react/tooltip";

interface ParamSliderProps {
  name: string;
  min: number; max: number; step: number;
  value: number;
  onValueChange: (v: number) => void;
  trackStyle?: string;
  format?: (v: number) => string;
  editable?: boolean;
  help?: string;
  description?: string;
  ticks?: { pos: number; label: string }[];
}

export function ParamSlider(props: ParamSliderProps) {
  const { name, min, max, step, value, onValueChange, trackStyle, format = String, editable, help, description, ticks } = props;
  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-name">{name}</span>
        {help && (
          <Tooltip.Root>
            <Tooltip.Trigger className="ctl-help" aria-label={`${name} help`}>?</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="top" sideOffset={6}>
                <Tooltip.Popup className="tooltip">{help}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <span className="ctl-val">
          {editable ? (
            <NumberField.Root value={value} min={min} max={max} step={step}
              onValueChange={(v) => v != null && onValueChange(v)}>
              <NumberField.Group>
                <NumberField.Input className="vbox" />
              </NumberField.Group>
            </NumberField.Root>
          ) : (
            <span className="vbox">{format(value)}</span>
          )}
        </span>
      </div>
      {description && <p className="ctl-desc">{description}</p>}
      <Slider.Root value={value} min={min} max={max} step={step}
        onValueChange={(v) => onValueChange(Array.isArray(v) ? v[0] : v)}>
        <Slider.Control
          className={trackStyle ? "track track--gradient" : "track track--plain"}
          style={trackStyle ? { backgroundImage: trackStyle } : undefined}>
          <Slider.Track>
            {ticks?.map((t) => (
              <span key={t.label} className="tick" style={{ left: `${t.pos * 100}%` }} />
            ))}
            <Slider.Thumb className="thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      {ticks && (
        <div className="tick-row">
          {ticks.map((t) => (
            <span key={t.label} className="tick-lbl" style={{ left: `${t.pos * 100}%` }}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm Base UI part names against rc.0**

Open `node_modules/@base-ui-components/react/slider` and `.../number-field` and `.../tooltip` (or the rc.0 docs). Verify the imported parts exist with these names: `Slider.Root/Control/Track/Thumb`, `NumberField.Root/Group/Input`, `Tooltip.Root/Trigger/Portal/Positioner/Popup`. If a part was renamed in rc.0, update the JSX to match. Note `Tooltip` requires a `Tooltip.Provider` ancestor — it will be added in App (Task 9).

- [ ] **Step 3: Typecheck**

Run: `cd tools/color-studio && npx tsc --noEmit`
Expected: no errors in `ParamSlider.tsx`.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add tools/color-studio/src/components/ParamSlider.tsx
git commit -m "feat(color-studio): add ParamSlider (Base UI Slider + NumberField)"
```

---

## Task 7: SeedControl component

**Files:**
- Create: `tools/color-studio/src/components/SeedControl.tsx`

**Interfaces:**
- Consumes: `ParamSlider`; `hexOf`, `parseHex`, `hueTrack`, `chromaTrack`, `swatchCss`, `REP_L` from `../lib/controls-math.js`; `HueSeed`, `Oklch` from `@project/src/engine/index.js`.
- Produces: `SeedControl` with props:

```ts
interface SeedControlProps {
  name: string;
  seed: HueSeed;                                   // { hue, chroma }
  onSeed: (seed: HueSeed, source: Oklch) => void;  // emit new seed + verbatim source color
}
```

`source` is the verbatim brand color: on slider tuning it is the swatch color at the current display lightness; on hex paste it is the exact parsed color. (Mirrors the old `seedControl` emit contract.)

- [ ] **Step 1: Implement the component**

`tools/color-studio/src/components/SeedControl.tsx`:

```tsx
import { useState } from "react";
import { oklch } from "culori";
import type { HueSeed, Oklch } from "@project/src/engine/index.js";
import { ParamSlider } from "./ParamSlider.js";
import { hexOf, parseHex, hueTrack, chromaTrack, swatchCss, REP_L } from "../lib/controls-math.js";

interface SeedControlProps {
  name: string;
  seed: HueSeed;
  onSeed: (seed: HueSeed, source: Oklch) => void;
}

export function SeedControl({ name, seed, onSeed }: SeedControlProps) {
  // displayL echoes a pasted hex's lightness; it never affects generation.
  const [displayL, setDisplayL] = useState(REP_L);
  const [hexBad, setHexBad] = useState(false);
  const hexValue = hexOf(seed.hue, seed.chroma, displayL);

  const emit = (next: HueSeed, source?: Oklch) =>
    onSeed(next, source ?? { l: displayL, c: next.chroma, h: next.hue });

  const onHexCommit = (raw: string) => {
    const parsed = parseHex(raw);
    const exact = oklch(raw.trim());
    if (!parsed || !exact) {
      setHexBad(true);
      setTimeout(() => setHexBad(false), 900);
      return;
    }
    setDisplayL(parsed.l);
    emit({ hue: parsed.hue, chroma: parsed.chroma }, { l: exact.l!, c: exact.c ?? 0, h: exact.h ?? 0 });
  };

  return (
    <div className="seed">
      <div className="seed-head">
        <span className="swatch"><i style={{ background: swatchCss(displayL, seed.hue, seed.chroma) }} /></span>
        <span className="seed-name">{name}</span>
        <input
          className={"hex" + (hexBad ? " hex--bad" : "")}
          type="text" spellCheck={false} defaultValue={hexValue} key={hexValue}
          onBlur={(e) => onHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          title="Paste a brand hex — hue & chroma seed the ramp; the lightness shown just echoes your paste"
        />
      </div>
      <ParamSlider
        name="Hue" min={0} max={360} step={1} value={seed.hue}
        trackStyle={hueTrack()} format={(v) => `${v}°`} editable
        help="Drag right to walk the color wheel — warm reds → greens → cool blues."
        onValueChange={(v) => emit({ hue: v, chroma: seed.chroma })}
      />
      <ParamSlider
        name="Chroma" min={0} max={0.3} step={0.005} value={seed.chroma}
        trackStyle={chromaTrack(seed.hue)} format={(v) => v.toFixed(3)} editable
        help="Drag right for more vivid; left fades toward gray."
        onValueChange={(v) => emit({ hue: seed.hue, chroma: v })}
      />
    </div>
  );
}
```

Note: the `key={hexValue}` forces the uncontrolled hex input to re-sync when sliders change the seed; this keeps the field showing the live value without making it a controlled input (which would fight cursor position while typing).

- [ ] **Step 2: Typecheck**

Run: `cd tools/color-studio && npx tsc --noEmit`
Expected: no errors in `SeedControl.tsx`.

- [ ] **Step 3: Commit**

```bash
cd ../.. && git add tools/color-studio/src/components/SeedControl.tsx
git commit -m "feat(color-studio): add SeedControl (swatch + hex + hue/chroma)"
```

---

## Task 8: Section component

**Files:**
- Create: `tools/color-studio/src/components/Section.tsx`

**Interfaces:**
- Consumes: `Collapsible` from `@base-ui-components/react/collapsible`.
- Produces: `Section` with props:

```ts
interface SectionProps {
  id: string;            // localStorage key suffix, e.g. "foundation"
  title: string;
  description: string;
  modified: boolean;     // show the orange diamond
  onReset: () => void;
  children: React.ReactNode;
}
```

Open/closed state persists in `localStorage` under `cs-section-<id>` (default open).

- [ ] **Step 1: Implement the component**

`tools/color-studio/src/components/Section.tsx`:

```tsx
import { useState } from "react";
import { Collapsible } from "@base-ui-components/react/collapsible";

interface SectionProps {
  id: string;
  title: string;
  description: string;
  modified: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

export function Section({ id, title, description, modified, onReset, children }: SectionProps) {
  const storageKey = `cs-section-${id}`;
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== "false");
  const handleOpen = (next: boolean) => {
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  };
  return (
    <Collapsible.Root open={open} onOpenChange={handleOpen} render={<section className="sec" data-open={open} />}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Collapsible.Trigger className="sec-head">
          <span className="sec-chevron">▼</span>
          <span className="sec-title">{title}</span>
          {modified && <span className="sec-diamond" title="modified from default" />}
        </Collapsible.Trigger>
        <button className="sec-reset" title="Reset section"
          onClick={onReset} aria-label={`Reset ${title}`}>↺</button>
      </div>
      <p className="sec-desc">{description}</p>
      <Collapsible.Panel>
        <div className="sec-body">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
```

- [ ] **Step 2: Confirm Collapsible parts against rc.0**

Verify `Collapsible.Root/Trigger/Panel` exist and that `Root` accepts `open`/`onOpenChange` and a `render` prop in rc.0. Adjust if renamed. (If `render` isn't supported, wrap in a plain `<section>` and move `className`/`data-open` there.)

- [ ] **Step 3: Typecheck**

Run: `cd tools/color-studio && npx tsc --noEmit`
Expected: no errors in `Section.tsx`.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add tools/color-studio/src/components/Section.tsx
git commit -m "feat(color-studio): add Section (Collapsible + modified + reset)"
```

---

## Task 9: FigmaIcon + Sidebar assembly

**Files:**
- Create: `tools/color-studio/src/components/FigmaIcon.tsx`
- Create: `tools/color-studio/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `Section`, `SeedControl`, `ParamSlider`, `FigmaIcon`; `nearestAlias`, `CONTRAST_ALIASES` from `../lib/controls-math.js`; `isSectionModified`, `resetSection`, `SectionKey` from `../lib/theme-state.js`; `Tooltip`, `Toggle` from Base UI; `ThemeInputs`, `HueSeed`, `Oklch` from the engine.
- Produces: `Sidebar` with props:

```ts
interface SidebarProps {
  state: ThemeInputs;
  baseline: ThemeInputs;
  mode: "light" | "dark";
  onChange: (next: ThemeInputs) => void;
  onModeToggle: () => void;
  onSave: () => void;
  onCopyFigma: () => void;
  onResetAll: () => void;
}
```

- [ ] **Step 1: Implement FigmaIcon**

`tools/color-studio/src/components/FigmaIcon.tsx`:

```tsx
export function FigmaIcon() {
  return (
    <svg viewBox="0 0 38 57" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
    </svg>
  );
}
```

- [ ] **Step 2: Implement Sidebar**

`tools/color-studio/src/components/Sidebar.tsx` — uses the exact approved copy:

```tsx
import { Toggle } from "@base-ui-components/react/toggle";
import { Tooltip } from "@base-ui-components/react/tooltip";
import type { ThemeInputs, HueSeed, Oklch } from "@project/src/engine/index.js";
import { Section } from "./Section.js";
import { SeedControl } from "./SeedControl.js";
import { ParamSlider } from "./ParamSlider.js";
import { FigmaIcon } from "./FigmaIcon.js";
import { nearestAlias } from "../lib/controls-math.js";
import { isSectionModified, resetSection, type SectionKey } from "../lib/theme-state.js";

interface SidebarProps {
  state: ThemeInputs;
  baseline: ThemeInputs;
  mode: "light" | "dark";
  onChange: (next: ThemeInputs) => void;
  onModeToggle: () => void;
  onSave: () => void;
  onCopyFigma: () => void;
  onResetAll: () => void;
}

const ACCENTS = ["primary", "secondary", "tertiary"] as const;
const STATUS = ["success", "error", "warning", "info"] as const;

export function Sidebar(props: SidebarProps) {
  const { state, baseline, mode, onChange, onModeToggle, onSave, onCopyFigma, onResetAll } = props;
  const mod = (s: SectionKey) => isSectionModified(s, state, baseline);
  const reset = (s: SectionKey) => onChange(resetSection(s, state, baseline));
  const contrast = typeof state.contrast === "number" ? state.contrast : 0.5;

  return (
    <aside id="sidebar">
      <div className="head">
        <div>
          <h1>Color Studio</h1>
          <p>Tune the seeds — watch the theme rebuild live.</p>
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Toggle pressed={mode === "dark"} onPressedChange={onModeToggle}
                className="mode-toggle" aria-label="Toggle dark preview">
                {mode === "dark" ? "☀" : "☾"}
              </Toggle>
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="bottom" sideOffset={6}>
              <Tooltip.Popup className="tooltip">{mode === "dark" ? "Switch to light" : "Switch to dark"}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>

      <Section id="foundation" title="Foundation"
        description="The gray and contrast every other color is built on."
        modified={mod("foundation")} onReset={() => reset("foundation")}>
        <SeedControl name="neutral" seed={state.neutral}
          onSeed={(seed) => onChange({ ...state, neutral: seed })} />
        <ParamSlider name="Contrast" min={0} max={1} step={0.01} value={contrast}
          help="How far apart the light and dark steps sit. Higher = punchier, more separation."
          format={(v) => `${v.toFixed(2)} · ${nearestAlias(v)}`}
          ticks={[{ pos: 0.25, label: "low" }, { pos: 0.5, label: "default" }, { pos: 0.85, label: "high" }]}
          onValueChange={(v) => onChange({ ...state, contrast: v })} />
      </Section>

      <Section id="accents" title="Accents"
        description="Your brand colors — each hue seeds a full tint & shade ramp."
        modified={mod("accents")} onReset={() => reset("accents")}>
        {ACCENTS.map((key) => (
          <SeedControl key={key} name={key} seed={state.accents[key]}
            onSeed={(seed: HueSeed, source: Oklch) => onChange({
              ...state,
              accents: { ...state.accents, [key]: seed },
              brand: { ...state.brand, [key]: source },
            })} />
        ))}
      </Section>

      <Section id="status" title="Status"
        description="Feedback colors — success, error, warning, info."
        modified={mod("status")} onReset={() => reset("status")}>
        {STATUS.map((key) => (
          <SeedControl key={key} name={key} seed={state.status[key]}
            onSeed={(seed) => onChange({ ...state, status: { ...state.status, [key]: seed } })} />
        ))}
      </Section>

      <Section id="darkSurfaces" title="Dark surfaces"
        description="How deep dark mode goes, and how raised layers separate."
        modified={mod("darkSurfaces")} onReset={() => reset("darkSurfaces")}>
        <ParamSlider name="Base depth" min={0.05} max={0.4} step={0.005}
          value={state.darkSurfaces!.base}
          description="Lightness of the darkest surface (the page background). Lower is darker."
          format={(v) => `${Math.round(v * 100)}% light`}
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, base: v } })} />
        <ParamSlider name="Elevation step" min={0} max={0.08} step={0.002}
          value={state.darkSurfaces!.step}
          description="Lightness added per raised layer — more = stronger separation."
          format={(v) => `+${(v * 100).toFixed(1)}% / level`}
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, step: v } })} />
      </Section>

      <div className="foot">
        <button className="btn btn--ghost" onClick={onResetAll} title="Reset everything to defaults">↺ Reset all</button>
        <button className="btn btn--primary" onClick={onSave}>Save theme</button>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={<button className="btn btn--icon fig-btn" onClick={onCopyFigma} aria-label="Copy for Figma"><FigmaIcon /></button>}
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6}>
              <Tooltip.Popup className="tooltip">Copy for Figma</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd tools/color-studio && npx tsc --noEmit`
Expected: no errors in `Sidebar.tsx` / `FigmaIcon.tsx`.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add tools/color-studio/src/components/FigmaIcon.tsx tools/color-studio/src/components/Sidebar.tsx
git commit -m "feat(color-studio): assemble Sidebar with header, sections, footer"
```

---

## Task 10: Wire App, toasts, save/copy; remove old files; final verification

**Files:**
- Modify: `tools/color-studio/src/App.tsx`
- Delete: `tools/color-studio/src/main.ts`, `tools/color-studio/src/ui/controls.ts`

**Interfaces:**
- Consumes: `Sidebar`, `Preview`; `serializeConfig` (`./serialize.js`), `copyTokensForFigma` (`./export-figma.js`); `withDarkSurfaceFallback` (`./lib/theme-state.js`); `Toast` from Base UI; `themeInputs` from `@project/theme.config.js`.

- [ ] **Step 1: Implement the full App**

Replace `tools/color-studio/src/App.tsx`:

```tsx
import { useMemo, useRef, useState } from "react";
import { Tooltip } from "@base-ui-components/react/tooltip";
import { Toast } from "@base-ui-components/react/toast";
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Sidebar } from "./components/Sidebar.js";
import { Preview } from "./components/Preview.js";
import { serializeConfig } from "./serialize.js";
import { copyTokensForFigma } from "./export-figma.js";
import { withDarkSurfaceFallback } from "./lib/theme-state.js";

function AppInner() {
  const baseline = useMemo(() => withDarkSurfaceFallback(structuredClone(themeInputs) as ThemeInputs), []);
  const [state, setState] = useState<ThemeInputs>(() => structuredClone(baseline));
  const [mode, setMode] = useState<"light" | "dark">("light");
  const toast = Toast.useToastManager();

  // Coalesce preview re-renders to one per frame (Preview's effect runs on state change;
  // React batches, but we also guard rapid drags by keying the rendered state via a ref).
  const frame = useRef(0);
  const [rafState, setRafState] = useState(state);
  const update = (next: ThemeInputs) => {
    setState(next);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setRafState(next);
    });
  };

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.classList.toggle("mode-dark", next === "dark");
  };

  const onSave = async () => {
    try {
      const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
      toast.add({ title: res.ok ? "Saved ✓" : "Save failed", data: { type: res.ok ? "success" : "error" } });
    } catch {
      toast.add({ title: "Save failed", data: { type: "error" } });
    }
  };

  const onCopyFigma = async () => {
    const ok = await copyTokensForFigma(state);
    toast.add({ title: ok ? "Copied ✓" : "Copy failed", data: { type: ok ? "success" : "error" } });
  };

  const onResetAll = () => update(structuredClone(baseline));

  return (
    <div id="app">
      <Sidebar
        state={state} baseline={baseline} mode={mode}
        onChange={update} onModeToggle={toggleMode}
        onSave={onSave} onCopyFigma={onCopyFigma} onResetAll={onResetAll}
      />
      <Preview state={rafState} mode={mode} />
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <Toast.Root className="toast" data-type-from="data">
            <Toast.Title />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Portal>
    </div>
  );
}

export default function App() {
  return (
    <Tooltip.Provider delay={150}>
      <Toast.Provider>
        <AppInner />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
```

Note on the throttle: `state` updates immediately (controls stay responsive and never remount), while `rafState` — what the Preview consumes — advances at most once per frame, preserving the original one-paint-per-frame behavior.

- [ ] **Step 2: Confirm Toast API against rc.0 and bind the toast type to the class**

Verify in rc.0: `Toast.Provider`, `Toast.useToastManager()` with `.add({ title, data })`, `Toast.Portal/Viewport/Root/Title`. If the data→DOM attribute wiring differs, set the toast color by reading the manager's current toast and applying `data-type` on `Toast.Root` (e.g. via the render-prop form `Toast.Root` exposes). Adjust the `.toast[data-type=...]` selector in `styles.css` to match the actual attribute. The functional requirement: success toasts read green, failures red.

- [ ] **Step 3: Delete the obsolete vanilla files**

```bash
git rm tools/color-studio/src/main.ts tools/color-studio/src/ui/controls.ts
```

- [ ] **Step 4: Typecheck and run all tests**

Run: `cd tools/color-studio && npx tsc --noEmit && cd ../.. && npm test`
Expected: no type errors; all tests (`serialize`, `controls-math`, `theme-state`) PASS.

- [ ] **Step 5: Manual end-to-end verification**

Run: `cd tools/color-studio && npm run dev`. In the browser, confirm:
- Sidebar renders with the four collapsible sections; chevrons expand/collapse and the open/closed state survives a reload.
- Dragging a hue/chroma slider updates the swatch, value box, gradient, and preview smoothly (no jank, no flicker).
- Typing a value into a NumberField box (e.g. hue `200`) moves the slider and preview.
- Pasting a hex into a seed's hex field reseeds it; an invalid hex flashes the error state and reverts.
- The Contrast slider shows low/default/high ticks under the track with the thumb riding above them.
- Changing a value lights the section's orange diamond; the section ↺ reset clears it; footer "Reset all" restores everything.
- The header toggle flips the preview (and chrome) between light and dark.
- "Save theme" writes `theme.config.ts` (check the file) and fires a green "Saved ✓" toast; "Copy for Figma" (logo button, tooltip on hover) copies and fires "Copied ✓".

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(color-studio): wire App with state, toasts, save/copy; remove vanilla UI"
```

---

## Self-Review

**Spec coverage:**
- React + Base UI rewrite → Tasks 1, 6–10. Engine/helpers/middleware preserved → Global Constraints + Tasks 1, 4, 10.
- Hybrid visual direction → Task 5 (stylesheet) + components.
- Collapsible sections → Task 8. Mode toggle in header → Task 9. Two-item-plus-reset footer → Task 9.
- 12px gradient tracks vs slim plain tracks → Task 5 (`.track--gradient`/`.track--plain`) + Task 6 (`trackStyle`).
- Editable NumberField value boxes → Task 6; contrast read-only → Task 9 (no `editable`).
- White-padded swatch chips → Task 5 (`.swatch`) + Task 7.
- Contrast zone ticks behind thumb → Task 5 (z-index) + Tasks 6/9 (`ticks` prop).
- "?" tooltip on seed sliders, inline description on dark-surface dials → Tasks 6/7/9.
- Modified diamond + per-section reset + global reset + persistence → Tasks 3, 8, 9.
- Figma icon button + tooltip + aria-label → Tasks 5, 9.
- Toast feedback → Tasks 5, 10.
- Copy table → Task 9 (verbatim).
- Performance (one paint/frame, no remount) → Task 10 throttle + Global Constraints.
- Preview ported, not restyled → Task 4 + Task 5 Step 1.
- Tests (alias mapping, modified-vs-default, hex round-trip) → Tasks 2, 3.

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output.

**Type consistency:** `ThemeInputs`/`HueSeed`/`Oklch` from the engine used consistently; `SectionKey` defined in Task 3 and consumed in Task 9; `ParamSlider`/`SeedControl`/`Section` prop interfaces match their call sites; `renderPreview(state, mode, root)` signature consistent between Task 4 definition and Task 4 Preview consumer.

**Known risk:** Base UI rc.0 part/prop names (Slider, NumberField, Tooltip, Collapsible, Toggle, Toast) are the one place reality may diverge from this plan — each consuming task includes an explicit "confirm against rc.0" step. The component structure and props are otherwise framework-stable.
