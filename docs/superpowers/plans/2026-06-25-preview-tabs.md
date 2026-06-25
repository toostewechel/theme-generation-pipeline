# Preview Panel Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Color Studio preview into two tabs — "Color ramps" (all palette sections) and "Playground" (component specimens driven by semantic color tokens).

**Architecture:** `Preview.tsx` gains a Base UI `Tabs` header and owns the active-tab React state (persisted to `localStorage`); the mode class moves to React on `#preview`. `preview.ts` keeps its string-builder renderers — `renderPreview` takes an options arg and renders the active tab's group into a React-owned `#pv-content` container. Task 1 ships the working tab shell (Playground = today's sample moved verbatim); Task 2 enriches the Playground specimens.

**Tech Stack:** React, Base UI (`@base-ui-components/react/tabs`), TypeScript, Vite. The preview is a string-template renderer, not React.

## Global Constraints

- **Color ramps tab** = `renderRamps` + `renderLabelOnFill` + `renderDarkSurfaces` + `renderBrand` + `(state.alpha ? renderAlphaRamps : "")`. **Playground tab** = component specimens only.
- Active tab is React state in `Preview.tsx`, persisted to `localStorage["cs-preview-tab"]`, default `"ramps"`.
- `renderPreview`'s 4th arg is an options object: `{ showContrast?: boolean; tab?: "ramps" | "playground" }` (defaults: `showContrast` true, `tab` "ramps").
- The mode class (`mode-light`/`mode-dark`) is set by React on `#preview`. `renderPreview` must NOT set `root.className` (it renders into `#pv-content`, not `#preview`).
- Playground specimens use **semantic color tokens only** (`var(--color-*)`); radius/spacing/structure are illustrative plain CSS.
- Base UI Tabs imported from `@base-ui-components/react/tabs` (`Tabs.Root` / `Tabs.List` / `Tabs.Tab`). `Tabs.Panel` is NOT used — content is imperative. `Tabs.Root` props: `value`, `onValueChange`. The active tab exposes `data-selected`.
- Compile gate: `cd tools/color-studio && npm run build` (must succeed). Do NOT use `npx tsc --noEmit` — it is known-noisy with pre-existing `@project` alias / culori errors in this repo.
- No unit tests for the preview renderer: the test env is `node` with no DOM package, and the existing render functions have no tests. Verification is the build gate + a manual pass. (Matches the spec's testing section.)

---

### Task 1: Tabbed preview shell

**Files:**
- Modify: `tools/color-studio/src/ui/preview.ts` (options arg; split body into `renderRampsTab` + rename `renderSample` → `renderPlaygroundTab`; copy-handler rebind; drop the old header/`#pv-body` machinery)
- Modify: `tools/color-studio/src/components/Preview.tsx` (tab state + Base UI Tabs header + `#pv-content` container + mode className)
- Modify: `tools/color-studio/src/styles.css` (tab bar styling)

**Interfaces:**
- Consumes: existing `renderRamps(set, surface)`, `renderLabelOnFill(set)`, `renderDarkSurfaces(state)`, `renderBrand(state)`, `renderAlphaRamps(set)`, `semanticVars(state, set, mode)`, `buildRamps(state)` — all already in `preview.ts`.
- Produces:
  - `renderPreview(state: ThemeInputs, mode: "light" | "dark", root: HTMLElement, opts?: { showContrast?: boolean; tab?: "ramps" | "playground" }): void`
  - `renderRampsTab(set, surface, state, mode): string` (module-private)
  - `renderPlaygroundTab(vars: string): string` (module-private; Task 2 expands it)

- [ ] **Step 1: Rename `renderSample` to `renderPlaygroundTab`**

In `tools/color-studio/src/ui/preview.ts`, change the function declaration (the body stays identical):

```ts
// The playground consumes only semantic tokens (var(--color-*)), never raw ramp
// steps — it is the proof that the semantic layer holds up in context.
function renderPlaygroundTab(vars: string): string {
```

(was `function renderSample(vars: string): string {` — update the comment line above it too, as shown.)

- [ ] **Step 2: Replace the `renderPreview` block with the options-arg + tab-switch version**

In `tools/color-studio/src/ui/preview.ts`, replace this entire block:

```ts
// Set from renderPreview's argument each render; read by renderRamps (which
// runs synchronously within the same call, so the module-level handoff is safe).
let showContrast = true;

export function renderPreview(
  state: ThemeInputs,
  mode: "light" | "dark",
  root: HTMLElement = document.getElementById("preview")!,
  showContrastOpt = true,
): void {
  showContrast = showContrastOpt;
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  surfaceLabel = mode === "light" ? "neutral-0" : "dark surface";
  const vars = semanticVars(state, set, mode);
  root.className = mode === "light" ? "mode-light" : "mode-dark";

  let body = root.querySelector<HTMLElement>("#pv-body");
  if (!body) {
    root.innerHTML = `<h3 class="pv-title">Preview</h3>
      <p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>
      <div id="pv-body"></div>`;
    body = root.querySelector<HTMLElement>("#pv-body")!;
    // Delegated copy-to-clipboard for any swatch carrying a data-hex (ramp
    // chips, brand swatches). Attached once; survives body.innerHTML rebuilds.
    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hex]");
      const hex = el?.getAttribute("data-hex");
      if (!el || !hex) return;
      navigator.clipboard.writeText(hex).then(() => {
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 1000);
      }).catch(() => {});
    });
  } else {
    const sub = root.querySelector(".pv-sub");
    if (sub) sub.textContent = `Generated ${Object.keys(set).length} ramps · ${mode} surface`;
  }
  body.innerHTML =
    renderRamps(set, surface) + renderLabelOnFill(set) + renderDarkSurfaces(state) +
    renderBrand(state) + renderSample(vars) +
    (state.alpha ? renderAlphaRamps(set) : "");
}
```

with:

```ts
// Set from renderPreview's options each render; read by renderRamps (which runs
// synchronously within the same call, so the module-level handoff is safe).
let showContrast = true;

// The "Color ramps" tab: every palette / token visualization.
function renderRampsTab(
  set: RampSet,
  surface: Oklch,
  state: ThemeInputs,
  mode: "light" | "dark",
): string {
  const caption = `<p class="pv-sub">Generated ${Object.keys(set).length} ramps · ${mode} surface</p>`;
  return (
    caption +
    renderRamps(set, surface) +
    renderLabelOnFill(set) +
    renderDarkSurfaces(state) +
    renderBrand(state) +
    (state.alpha ? renderAlphaRamps(set) : "")
  );
}

export function renderPreview(
  state: ThemeInputs,
  mode: "light" | "dark",
  root: HTMLElement,
  opts: { showContrast?: boolean; tab?: "ramps" | "playground" } = {},
): void {
  showContrast = opts.showContrast ?? true;
  const tab = opts.tab ?? "ramps";
  const set = buildRamps(state);
  const surface = mode === "light" ? set.neutral["0"] : set.neutral["950"];
  surfaceLabel = mode === "light" ? "neutral-0" : "dark surface";
  const vars = semanticVars(state, set, mode);

  // Delegated copy-to-clipboard for any swatch carrying a data-hex (ramp chips,
  // brand swatches). Bound once on the (React-owned, stable) content container;
  // survives innerHTML rebuilds.
  if (!root.dataset.copyBound) {
    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hex]");
      const hex = el?.getAttribute("data-hex");
      if (!el || !hex) return;
      navigator.clipboard.writeText(hex).then(() => {
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 1000);
      }).catch(() => {});
    });
    root.dataset.copyBound = "1";
  }

  root.innerHTML =
    tab === "playground"
      ? renderPlaygroundTab(vars)
      : renderRampsTab(set, surface, state, mode);
}
```

- [ ] **Step 3: Rewrite `Preview.tsx` with the tab header**

Replace the entire contents of `tools/color-studio/src/components/Preview.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

type PreviewTab = "ramps" | "playground";
const TAB_KEY = "cs-preview-tab";

export function Preview({
  state,
  mode,
  showContrast,
}: {
  state: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PreviewTab>(
    () => (localStorage.getItem(TAB_KEY) as PreviewTab) || "ramps",
  );

  const onTab = (value: PreviewTab) => {
    setTab(value);
    localStorage.setItem(TAB_KEY, value);
  };

  useEffect(() => {
    if (contentRef.current) {
      renderPreview(state, mode, contentRef.current, { showContrast, tab });
    }
  }, [state, mode, showContrast, tab]);

  return (
    <main id="preview" className={mode === "dark" ? "mode-dark" : "mode-light"}>
      <Tabs.Root
        className="pv-tabs"
        value={tab}
        onValueChange={(value) => onTab(value as PreviewTab)}
      >
        <h3 className="pv-title">Preview</h3>
        <Tabs.List className="pv-tablist">
          <Tabs.Tab className="pv-tab" value="ramps">
            Color ramps
          </Tabs.Tab>
          <Tabs.Tab className="pv-tab" value="playground">
            Playground
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
      <div ref={contentRef} id="pv-content" />
    </main>
  );
}
```

- [ ] **Step 4: Add the tab-bar styling**

In `tools/color-studio/src/styles.css`, append:

```css
/* ---------- Preview tabs ---------- */
.pv-tabs {
  margin-bottom: 18px;
}
.pv-tablist {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  border-bottom: 1px solid var(--line);
}
.pv-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  color: var(--ink-faint);
  cursor: pointer;
  transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.pv-tab:hover {
  color: var(--ink-soft);
}
.pv-tab[data-selected] {
  color: var(--ink);
  border-bottom-color: var(--accent);
}
.pv-tab:focus-visible {
  outline: none;
  color: var(--ink);
  box-shadow: 0 0 0 3px var(--accent-soft);
  border-radius: 4px;
}
```

- [ ] **Step 5: Build to verify it compiles**

Run: `cd tools/color-studio && npm run build`
Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 6: Manual verification**

Run from repo root: `npm run preview:studio`, open the URL. Confirm:
1. The preview header shows a "Preview" title with two tabs: **Color ramps** and **Playground**.
2. **Color ramps** shows the "Generated N ramps" caption, ramps, label-on-fill, dark surfaces, brand (and alpha ramps when the Output toggle is on).
3. **Playground** shows the moved sample (heading, body, input, buttons, chips) and *not* the ramps.
4. Switching tabs, then reloading, restores the last-selected tab.
5. Copy-to-clipboard still works on ramp chips and brand swatches.
6. The dark-mode toggle still restyles the panel and the tabs.

Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add tools/color-studio/src/ui/preview.ts tools/color-studio/src/components/Preview.tsx tools/color-studio/src/styles.css
git commit -m "feat(color-studio): split preview into Color ramps / Playground tabs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Expand the Playground specimens

**Files:**
- Modify: `tools/color-studio/src/ui/preview.ts` (`renderPlaygroundTab` markup)
- Modify: `tools/color-studio/src/styles.css` (specimen styling)

**Interfaces:**
- Consumes: `renderPlaygroundTab(vars: string): string` from Task 1; the existing `.sample`, `.sample-row`, `.sample-btn`, `.sample-btn--ghost`, `.sample-field`, `.sample-muted`, `.sample-chip` classes; the semantic tokens `--color-fg-emphasis`, `--color-fg`, `--color-fg-muted`, `--color-fg-link`, `--color-fg-secondary`, `--color-fg-on-accent`, `--color-bg`, `--color-bg-accent`, `--color-border-default`, and per status `--color-bg-{success,error,warning,info}-subtle` / `--color-fg-{success,error,warning,info}` (all verified present in the generated token files).
- Produces: no signature change — richer markup only.

- [ ] **Step 1: Replace `renderPlaygroundTab`'s body with the expanded specimens**

In `tools/color-studio/src/ui/preview.ts`, replace the whole `renderPlaygroundTab` function with:

```ts
// The playground consumes only semantic tokens (var(--color-*)), never raw ramp
// steps — it is the proof that the semantic layer holds up in context. Structural
// styling (radius/spacing) is illustrative CSS; only color comes from tokens.
function renderPlaygroundTab(vars: string): string {
  const STATUSES = ["success", "error", "warning", "info"] as const;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  const alerts = STATUSES.map(
    (s) =>
      `<div class="pg-alert" style="background:var(--color-bg-${s}-subtle);color:var(--color-fg-${s})">
        <strong>${cap(s)}</strong> — styled from --color-bg-${s}-subtle and --color-fg-${s}.
      </div>`,
  ).join("");

  const badges = STATUSES.map(
    (s) =>
      `<span class="sample-chip" style="background:var(--color-bg-${s}-subtle);color:var(--color-fg-${s})">${s}</span>`,
  ).join("");

  return `<div class="pv-section">
    <div class="pv-section-title">Playground <span class="pv-legend">components styled entirely from semantic color tokens</span></div>
    <div class="sample" style="${vars}">
      <div class="pg-card" style="background:var(--color-bg);border-color:var(--color-border-default)">
        <h4 style="color:var(--color-fg-emphasis)">Tune the seed, read it in place</h4>
        <p style="color:var(--color-fg)">Body copy on the raised surface, styled entirely from the generated semantic tokens.</p>
        <p class="sample-muted" style="color:var(--color-fg-muted)">Muted annotation · <a href="#" style="color:var(--color-fg-link)">a link</a></p>
      </div>
      <div class="sample-row">
        <button class="sample-btn" style="background:var(--color-bg-accent);color:var(--color-fg-on-accent)">Primary action</button>
        <button class="sample-btn sample-btn--ghost" style="color:var(--color-fg-secondary);border-color:var(--color-border-default)">Secondary</button>
        <button class="sample-btn" style="background:var(--color-bg-accent);color:var(--color-fg-on-accent);opacity:0.45" disabled>Disabled</button>
      </div>
      <div class="pg-form">
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-border-default)">
          <span style="color:var(--color-fg-muted)">Input placeholder</span>
        </div>
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-fg-link)">
          <span style="color:var(--color-fg)">Focused value</span>
        </div>
        <div class="sample-field" style="background:var(--color-bg);border-color:var(--color-fg-error)">
          <span style="color:var(--color-fg)">Invalid value</span>
        </div>
        <p class="pg-help" style="color:var(--color-fg-error)">This field is required.</p>
      </div>
      <div class="pg-alerts">${alerts}</div>
      <div class="sample-row">${badges}</div>
    </div></div>`;
}
```

- [ ] **Step 2: Add the specimen styling**

In `tools/color-studio/src/styles.css`, append:

```css
/* ---------- Playground specimens ---------- */
.pg-card {
  border: 1px solid;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.pg-card h4 {
  margin: 0 0 6px;
  font-size: 14px;
}
.pg-card p {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.5;
}
.pg-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
  max-width: 320px;
}
.pg-help {
  margin: 0;
  font-size: 11px;
}
.pg-alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
}
.pg-alert {
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
}
```

- [ ] **Step 3: Build to verify it compiles**

Run: `cd tools/color-studio && npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 4: Manual verification**

Run `npm run preview:studio`, open the **Playground** tab. Confirm:
1. A card, a button row (primary / secondary / disabled), three input states (default / focused / invalid) with a red helper line, four status alerts (success/error/warning/info), and four status badges all render.
2. Changing accent/status seeds in the sidebar recolors the specimens live (they consume `var(--color-*)`).
3. Dark mode restyles them via the semantic tokens.

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio/src/ui/preview.ts tools/color-studio/src/styles.css
git commit -m "feat(color-studio): expand Playground with card, form states, alerts, badges

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes / deliberate choices

- **No automated tests.** The studio test env is `node` with no DOM package; the preview render functions have never had unit tests. Adding jsdom solely to test string output is scope creep. Gate is `npm run build` + manual pass, exactly as the spec's testing section states.
- **Mode class ownership.** Task 1 moves the `mode-*` class to React on `#preview` and removes `root.className` from `renderPreview` (which now writes into `#pv-content`). The existing `#preview.mode-dark …` selectors keep matching because `#preview` still carries the class.
- **Uncontrolled container.** `#pv-content` is rendered by React with no JSX children, so `renderPreview` owning its `innerHTML` is safe — React never reconciles children it didn't create. The node is stable across renders, so the `dataset.copyBound` guard holds.
