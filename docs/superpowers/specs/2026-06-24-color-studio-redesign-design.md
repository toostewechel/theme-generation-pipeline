# Color Studio sidebar redesign — design spec

**Date:** 2026-06-24
**Status:** Approved, ready for implementation planning
**Scope:** `tools/color-studio/` only. The theme engine (`src/engine/`) and all token build scripts are untouched.

## Goal

Professionalize the Color Studio's interface so it reads like a precision design tool, not a dev scratchpad. Three asks from the user:

1. **Use real components** — adopt [Base UI](https://base-ui.com) (the headless React component library) instead of hand-built DOM.
2. **Sleeker sidebar** — restyle the controls panel toward the supplied inspiration (collapsible sections, value-box sliders, tight rhythm), while keeping it legible for designers.
3. **Better copy** — clearer, more intuitive, designer-facing labels and descriptions.

## Foundational decision: vanilla TS → React + Base UI

The studio is currently a vanilla-TypeScript + Vite app: the sidebar DOM is built imperatively in `src/ui/controls.ts` and the preview in `src/ui/preview.ts`. Base UI is a React library, so adopting it means porting the studio to React. This was an explicit, approved decision. It is a contained rewrite (a dev tool, ~1000 lines) and the theme engine is not affected.

**What stays exactly as-is (ported, not redesigned):**
- The theme engine and all its exports (`buildRamps`, `resolveSemantics`, `buildAlphas`, `buildDarkSurfaces`, `contrastRatio`, `serializeTokenBundle`, types).
- `serialize.ts` (`serializeConfig`) and `export-figma.ts` (`copyTokensForFigma`) — pure helpers, reused unchanged.
- The Vite `save-theme` plugin in `vite.config.ts` (the `POST /__save-theme` middleware that writes `theme.config.ts`). Only the React plugin is added alongside it.
- The **preview pane's visuals**. It is purpose-built so generated colors are judged on a calm neutral shell. It gets ported to a React component but is not restyled.

## Visual direction: "Hybrid"

Chosen over a literal copy of the inspiration ("Pro instrument") and over a minimal refresh ("Refined evolution").

- **Readable sans** for labels, section titles, and descriptions — designers scan these constantly; all-caps mono hurts that.
- **Monospace** reserved for **numbers** (value boxes, hex fields) where tabular alignment earns its place.
- Keep the existing calm, low-chroma OKLCH chrome so swatches are judged accurately. The redesign energy goes into structure and rhythm, not loud chrome.
- Light and dark chrome both follow the preview mode toggle, as today.

## Sidebar structure

Top to bottom:

### Header
- Title "Color Studio" + tagline.
- **Light/dark mode toggle moved here**, top-right of the header (Base UI `Toggle` / icon button). It drives both the preview and the app chrome (as today via the `mode-dark` class on `<html>`).

### Collapsible sections (Base UI `Collapsible`)
Four sections, each with a chevron, an optional "modified" diamond, and a reset control:

1. **Foundation** — `neutral` seed (hue, chroma) + **Contrast** slider.
2. **Accents** — `primary`, `secondary`, `tertiary` seeds. Each seed also records its verbatim source color as the brand token (unchanged engine behavior).
3. **Status** — `success`, `error`, `warning`, `info` seeds.
4. **Dark surfaces** — `Base depth` and `Elevation step` dials.

Section open/closed state persists across reloads (localStorage).

### Footer
Two items only: **Save theme** (primary button) and the **Figma icon button** (see below).

## Components and controls

### Seed control
Per seed: a **swatch chip + name + hex field** row, then a **Hue** slider and a **Chroma** slider.

- **Swatch chip** — colored square inside a **white container with 2px padding and a soft drop shadow**, so light / low-chroma seeds remain visible against the panel.
- **Hex field** — monospace, right-aligned. Paste/type a brand hex to seed the ramp (hue + chroma) while preserving the verbatim color as the brand token. Invalid input flashes an error state then reverts. (Behavior unchanged from today.)

### Sliders (Base UI `Slider`)
- **Label on top** of each slider, with the value to the right.
- **Hue and Chroma tracks are 12px tall** and carry a live gradient (hue rainbow; gray→vivid chroma at the current hue), so the track doubles as a palette preview. Plain dials (contrast, dark-surface depth/step) keep a slim ~6px track since they carry no color.
- Drag, keyboard, and click-to-position all supported via Base UI `Slider` (accessibility for free).

### Value boxes (Base UI `NumberField`)
The numeric readout for each slider is an **editable field** — click and type an exact value (e.g. hue `150`), not drag-only. Values stay monospace and tabular.

### Contrast slider with zone ticks
- The contrast slider (range 0–1) shows **tick marks at the three named anchors**: `low` (0.25), `default` (0.50), `high` (0.85), labeled beneath the track.
- Ticks render **behind** the drag handle (ticks `z-index:1`, thumb `z-index:3`).
- The value readout shows the number plus the nearest alias word (e.g. `0.50 · default`), as today.

### Help popovers (Base UI `Popover` or `Tooltip`)
- Repeating **seed sliders (hue/chroma)** carry a small "?" affordance that reveals a one-line, designer-facing description on hover/focus — so the help is available but not repeated as visual noise across ~8 seeds.
- One-off **dark-surface dials** keep an **always-visible inline description** (the text appears once and genuinely guides).

### Inline descriptions (dark-surface dials only)
- **Base depth** — "Lightness of the darkest surface (the page background). Lower is darker."
- **Elevation step** — "Lightness added per raised layer — more = stronger separation."

### Modified indicators + reset
- An **orange diamond (◆)** appears on a section header when any control in it differs from its default.
- A **per-section reset (↺)** restores that section's defaults.
- A **global "reset all"** lives in the footer (e.g. an overflow/menu affordance) — keep it discoverable but not prominent.
- "Default" = the values in the initial `theme.config.ts` loaded at startup (the same baseline used to seed state today).

### Figma export as icon button
- "Copy for Figma" becomes an **icon button with the multicolor Figma logo** (inline SVG).
- A Base UI `Tooltip` shows the label "Copy for Figma" on hover/focus.
- The button keeps `aria-label="Copy for Figma"` so it is not mystery-meat to assistive tech.

### Save / Copy feedback via Toast (Base UI `Toast`)
- Success/failure feedback for **Save theme** and **Copy for Figma** moves from the old button-label swap to a **`Toast`** ("Saved ✓", "Copied ✓", or a failure message). Buttons keep their stable labels.

## Copy changes

| Where | Before | After |
|---|---|---|
| Slider label | `chr` | `Chroma` |
| Slider label | `ctr` | `Contrast` |
| Tagline | "Generative OKLCH theme — tune the seeds, see it live" | "Tune the seeds — watch the theme rebuild live." |
| Foundation desc | "The gray and overall contrast everything derives from." | "The gray and contrast every other color is built on." |
| Accents desc | "Brand hues — each seeds a full ramp." | "Your brand colors — each hue seeds a full tint & shade ramp." |
| Status desc | "Feedback hues: success, error, warning, info." | "Feedback colors — success, error, warning, info." |
| Dark surfaces desc | "Dark-mode background depth and how raised layers separate." | "How deep dark mode goes, and how raised layers separate." |
| Save button | "Save to config" | "Save theme" |

Help-popover copy (seed sliders):
- **Hue** — "Drag right to walk the color wheel — warm reds → greens → cool blues."
- **Chroma** — "Drag right for more vivid; left fades toward gray."
- **Contrast** — "How far apart the light and dark steps sit. Higher = punchier, more separation."

## Architecture

A small React app. Suggested component breakdown (each unit has one clear job and a typed prop interface):

- `App` — owns `ThemeInputs` state and `mode`; renders `Sidebar` + `Preview`; throttles preview updates.
- `Sidebar` — header (with mode toggle), the four `Section`s, footer (Save + Figma + global reset), and the `Toast` viewport.
- `Section` — `Collapsible` wrapper; computes its own "modified" state and renders the ◆ + reset.
- `SeedControl` — swatch chip, name, hex field, Hue slider, Chroma slider.
- `ParamSlider` — generic labeled slider + `NumberField` value box; optional gradient track, optional ticks, optional "?" popover or inline description.
- `Preview` — React port of the current `renderPreview` output; same markup/CSS, same contrast-toggle behavior.
- Reused unchanged: `serializeConfig`, `copyTokensForFigma`, engine imports.

### State and performance (must preserve)
The current app is careful that dragging a slider never rebuilds the control DOM and the preview re-renders at most once per frame. The React port must keep equivalent smoothness:

- Each `Slider`/`NumberField` holds its own controlled value; committing a change updates the single `ThemeInputs` state in `App`.
- Preview re-render is **throttled/coalesced to one update per animation frame** (the existing `requestAnimationFrame` pattern), so a drag emitting many input events still paints once per frame.
- Controls are not unmounted/remounted on input — only their values change.

### Data flow
1. `App` loads initial `ThemeInputs` from `theme.config.ts` (via the `@project` alias), same as today.
2. A control edit → new `ThemeInputs` in `App` state → (a) controls reflect it, (b) a frame-throttled `Preview` re-render.
3. **Save theme** → `POST /__save-theme` with `serializeConfig(state)` → toast on result.
4. **Copy for Figma** → `copyTokensForFigma(state)` (clipboard) → toast on result.

### Build / tooling
- Add React, ReactDOM, `@base-ui-components/react`, and `@vitejs/plugin-react` to `tools/color-studio`.
- Add the React plugin to `vite.config.ts` alongside the existing `save-theme` plugin; keep the `@project` alias and `fs.allow`.
- `index.html` becomes a single `#root` mount; the imperative `aside/main` markup is removed.
- TypeScript stays; components are `.tsx`.

## Error handling
- **Invalid hex** — flash the field's error state, revert to the prior valid value (current behavior, ported).
- **Save / Copy failure** — failure toast; buttons return to idle. No silent failures.
- **NumberField bounds** — each value box clamps to the same min/max/step as its slider, so typed values can't push state out of range.

## Testing
- Keep the existing `serialize.test.ts` (pure, unaffected).
- Add component-level tests where they pay off: contrast alias mapping, "modified vs default" detection, hex parse/seed round-trip. Match the existing Vitest setup.
- Manual verification: drag stays smooth (one preview paint per frame), section persistence works, toasts fire, Figma copy produces the same bundle as today.

## Out of scope (explicitly deferred)
- **Manual / Presets tabs** and preset management — not in this iteration.
- Any change to the **theme engine**, token schema, or build scripts.
- Restyling the **preview pane** beyond the React port.

## Open implementation choices (safe to decide during planning)
- `Popover` vs `Tooltip` for the "?" help (both Base UI; pick by hover/focus/dismiss behavior desired).
- Exact affordance for the footer **global reset** (inline button vs small menu).
- Whether the contrast value box is editable or read-only (alias makes free typing less useful) — lean read-only/stepped.
