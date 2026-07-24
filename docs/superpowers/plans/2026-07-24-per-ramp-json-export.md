# Per-ramp JSON Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-row "Export JSON" button to every solid and alpha ramp in the Color Studio preview that copies that ramp's steps to the clipboard as a `{ step: hex }` JSON map.

**Architecture:** A pure `rampToHexMap` helper converts one ramp to an ordered hex map (6-digit for solid, 8-digit for alpha). `renderPreview` fills a module-level payload registry each render; each `.ramp` row renders a trailing button carrying a `data-export-key`; the existing once-bound delegated click listener gains a branch that copies the registered payload and fires a sonner toast. CSS reveals the button on row hover/focus.

**Tech Stack:** TypeScript, Vite, culori (`formatHex`, `formatHex8`), sonner (toast), Vitest.

## Global Constraints

- Work inside `tools/color-studio-tc/` (its own npm package; run commands from there).
- Token/engine code (`../../src/engine/**`) is NOT modified.
- Preview rendering is imperative HTML-string based in `src/ui/preview.ts`; follow that pattern (no React rewrite).
- Reuse the existing delegated-listener + `data-*` idiom already used for per-chip hex copy.
- Solid rows → 6-digit `#rrggbb`; alpha rows → 8-digit `#rrggbbaa`.
- Scope: 9 solid ramp rows (`renderRamps`) + 8 alpha rows (`renderAlphaRamps`). Brand / dark-surface / label-on-fill sections untouched.

---

### Task 1: `rampToHexMap` helper

**Files:**
- Create: `tools/color-studio-tc/src/ramp-export.ts`
- Test: `tools/color-studio-tc/src/ramp-export.test.ts`

**Interfaces:**
- Consumes: `Oklch` type from `@project/src/engine/index.js`; culori `formatHex`, `formatHex8`.
- Produces: `rampToHexMap(ramp: Record<string, Oklch>, opts: { alpha: boolean }): Record<string, string>` — an object whose keys are the ramp's steps in their original order, values are hex strings. `formatHex` (6-digit) when `opts.alpha` is false, `formatHex8` (8-digit) when true.

- [ ] **Step 1: Write the failing test**

Create `tools/color-studio-tc/src/ramp-export.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rampToHexMap } from "./ramp-export.js";
import type { Oklch } from "@project/src/engine/index.js";

describe("rampToHexMap", () => {
  const solid: Record<string, Oklch> = {
    "0": { l: 1, c: 0, h: 0 },
    "500": { l: 0.55, c: 0.2, h: 250 },
  };

  it("emits 6-digit hex for solid ramps", () => {
    const out = rampToHexMap(solid, { alpha: false });
    expect(out["0"]).toBe("#ffffff");
    expect(out["500"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("emits 8-digit hex for alpha ramps", () => {
    const alpha: Record<string, Oklch> = {
      "100": { l: 0.55, c: 0.2, h: 250, alpha: 0.5 },
    };
    const out = rampToHexMap(alpha, { alpha: true });
    expect(out["100"]).toMatch(/^#[0-9a-f]{8}$/);
  });

  it("preserves step order", () => {
    expect(Object.keys(rampToHexMap(solid, { alpha: false }))).toEqual(["0", "500"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/color-studio-tc && npx vitest run src/ramp-export.test.ts`
Expected: FAIL — cannot resolve `./ramp-export.js` / `rampToHexMap is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/color-studio-tc/src/ramp-export.ts`:

```ts
import { formatHex, formatHex8 } from "culori";
import type { Oklch } from "@project/src/engine/index.js";

/** Convert one ramp to an ordered { step: hex } map.
 *  Solid ramps → 6-digit hex; alpha ramps → 8-digit hex (preserves transparency). */
export function rampToHexMap(
  ramp: Record<string, Oklch>,
  opts: { alpha: boolean },
): Record<string, string> {
  const fmt = opts.alpha ? formatHex8 : formatHex;
  const out: Record<string, string> = {};
  for (const [step, c] of Object.entries(ramp)) {
    out[step] = fmt({ mode: "oklch", l: c.l, c: c.c, h: c.h, alpha: c.alpha }) ?? "#000000";
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/color-studio-tc && npx vitest run src/ramp-export.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio-tc/src/ramp-export.ts tools/color-studio-tc/src/ramp-export.test.ts
git commit -m "feat(color-studio-tc): add rampToHexMap ramp-export helper"
```

---

### Task 2: Wire export button into the preview

**Files:**
- Modify: `tools/color-studio-tc/src/ui/preview.ts`

**Interfaces:**
- Consumes: `rampToHexMap` from Task 1 (`../ramp-export.js`); `toast` from `sonner`.
- Produces: rendered `.ramp` rows each containing exactly one `button.ramp-export[data-export-key]`; a module-level `exportPayloads` registry keyed `solid:<name>` / `alpha:<name>`; a click-handler branch that copies the payload and toasts.

- [ ] **Step 1: Add imports**

In `tools/color-studio-tc/src/ui/preview.ts`, change the culori import (line 1) and add the new imports below it:

```ts
import { formatHex } from "culori";
import { toast } from "sonner";
import { rampToHexMap } from "../ramp-export.js";
```

(Keep the existing `import { buildRamps, ... } from "@project/src/engine/index.js";` block as-is.)

- [ ] **Step 2: Add the export-button markup helper and payload registry**

Near the top of the module (just after the `COPY_ICON` constant, ~line 22), add:

```ts
// Braces glyph for the per-row "Export JSON" button.
const EXPORT_ICON =
  `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4H7a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1"/><path d="M16 4h1a2 2 0 0 1 2 2v3a2 2 0 0 1 2 2 2 2 0 0 1-2 2v3a2 2 0 0 1-2 2h-1"/></svg>`;

// Per-render registry: data-export-key -> pretty-printed JSON hex map.
// Rebuilt at the top of every renderPreview call; read at click time by the
// once-bound delegated listener, so it is always current across innerHTML rebuilds.
const exportPayloads: Record<string, string> = {};

function registerExport(kind: "solid" | "alpha", name: string, ramp: Record<string, Oklch>): string {
  const key = `${kind}:${name}`;
  exportPayloads[key] = JSON.stringify(rampToHexMap(ramp, { alpha: kind === "alpha" }), null, 2);
  const verb = kind === "alpha" ? "alpha ramp" : "ramp";
  return `<button type="button" class="ramp-export" data-export-key="${key}" title="Export ${name} ${verb} as JSON" aria-label="Export ${name} ${verb} as JSON">${EXPORT_ICON}</button>`;
}
```

- [ ] **Step 3: Emit the button in the solid ramp rows**

In `renderRamps` (~line 118), change the row template to register + append the button:

```ts
    const btn = registerExport("solid", name, ramp as Record<string, Oklch>);
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div>${btn}</div>`;
```

- [ ] **Step 4: Emit the button in the alpha ramp rows**

In `renderAlphaRamps` (~line 151), change the row template the same way:

```ts
    const btn = registerExport("alpha", name, ramp);
    return `<div class="ramp"><span class="ramp-name">${name}</span><div class="ramp-chips">${chips}</div>${btn}</div>`;
```

- [ ] **Step 5: Add the click-handler branch**

Inside the delegated listener in `renderPreview` (the `if (!root.dataset.copyBound)` block, ~line 305), add an export branch at the very start of the callback, before the `data-hex` lookup:

```ts
    root.addEventListener("click", (e) => {
      const exportEl = (e.target as HTMLElement).closest<HTMLElement>("[data-export-key]");
      if (exportEl) {
        const key = exportEl.getAttribute("data-export-key")!;
        const payload = exportPayloads[key];
        if (!payload) return;
        const name = key.split(":")[1];
        navigator.clipboard.writeText(payload)
          .then(() => toast.success(`Copied ${name} ramp ✓`))
          .catch(() => toast.error("Copy failed"));
        return;
      }
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hex]");
      // ...existing hex-copy logic unchanged...
```

Leave the rest of the existing `data-hex` handler body exactly as-is.

- [ ] **Step 6: Typecheck and build**

Run: `cd tools/color-studio-tc && npx tsc --noEmit && npx vite build`
Expected: no type errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add tools/color-studio-tc/src/ui/preview.ts
git commit -m "feat(color-studio-tc): per-ramp Export JSON button copies hex map"
```

---

### Task 3: Style the export button

**Files:**
- Modify: `tools/color-studio-tc/src/preview.css`

**Interfaces:**
- Consumes: `.ramp` grid (currently `grid-template-columns: 96px 1fr` at line 69), `button.ramp-export` markup from Task 2.
- Produces: a hover/focus-revealed trailing button matching the `.chip-copy` affordance.

- [ ] **Step 1: Add a third grid column to `.ramp`**

Change the `.ramp` rule (line 69–75) so the button has its own trailing track:

```css
.ramp {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 14px;
  margin: 7px 0;
}
```

- [ ] **Step 2: Add `.ramp-export` styles**

Append after the `.chip.copied .chip-copy` block (~line 168):

```css
/* Per-row Export JSON button: hidden until the row is hovered/focused. */
.ramp-export {
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ink-soft);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s var(--ease), background 0.12s var(--ease);
}
.ramp:hover .ramp-export,
.ramp-export:focus-visible {
  opacity: 1;
}
.ramp-export:hover {
  background: oklch(0 0 0 / 0.08);
}
#preview.mode-dark .ramp-export {
  color: oklch(0.7 0.01 250);
}
#preview.mode-dark .ramp-export:hover {
  background: oklch(1 0 0 / 0.12);
}
```

- [ ] **Step 3: Verify in the running app**

Run: `cd tools/color-studio-tc && npm run dev`
Expected: dev server starts. In the "Color ramps" tab, hovering a solid or alpha ramp row reveals a braces button at the right; clicking it shows a "Copied <name> ramp ✓" toast. Paste to confirm JSON is `{ "step": "#hex" }` (8-digit hex on alpha rows). Stop the server (Ctrl-C) when done.

- [ ] **Step 4: Commit**

```bash
git add tools/color-studio-tc/src/preview.css
git commit -m "style(color-studio-tc): reveal per-ramp Export JSON button on hover"
```

---

## Self-Review

**Spec coverage:**
- Copy-to-clipboard + toast → Task 2 Step 5. ✓
- Simple hex map, 6-digit solid / 8-digit alpha → Task 1 (`rampToHexMap`). ✓
- Solid + alpha rows only → Task 2 Steps 3–4; brand/dark-surface/label-on-fill untouched. ✓
- Trailing icon button, hover/focus reveal, keyboard-accessible aria-label → Task 2 Step 2 (`aria-label`, `<button>`), Task 3. ✓
- Payload registry keyed solid:/alpha:, rebuilt each render → Task 2 Step 2. ✓
- Error path `toast.error("Copy failed")` → Task 2 Step 5. ✓
- Unit test for `rampToHexMap` (both modes, ordering) → Task 1. ✓

**Placeholder scan:** No TBD/TODO; all code blocks are complete.

**Type consistency:** `rampToHexMap(ramp, { alpha })` signature identical across Task 1 (definition) and Task 2 (`registerExport` caller). `data-export-key` / `exportPayloads` / `.ramp-export` names consistent across Tasks 2–3.
