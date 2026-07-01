# Color Studio → Toolcraft UI Components — Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Scope:** Re-skin the Color Studio app on Toolcraft's UI component library. Take the components only — not the schema runtime, canvas, or export contract.

## Problem

`tools/color-studio` is a Vite + React 19 app (Base UI components) that drives the
generative color engine: a sidebar of controls (seed hue/chroma, engine params,
1–3 accents), a live preview (Color ramps + component Playground tabs), and a
Figma token export. We want to move its UI onto
[`@pixel-point/toolcraft`](https://www.npmjs.com/package/@pixel-point/toolcraft)'s
component library for a more consistent, polished control-panel UI, and to
standardize future tools on the same foundation.

Toolcraft's full runtime is built for **raster/pixel output** (procedural
graphics, PNG/video export, canvas Setup block, acceptance/performance decision
contract). The color engine's real output is **design tokens + a component
preview + a Figma JSON export**, so the full runtime is a poor fit. We therefore
adopt **only the UI components**, and reserve the full Toolcraft flow for
genuinely generative/pixel tools later.

## Goals

- Rebuild the Color Studio presentation layer on Toolcraft's `@repo/ui` (panel,
  controls, composites), replacing the Base UI sidebar/controls/tabs/toast.
- Preserve all existing behavior: live preview, seed/param/accent controls,
  save, copy-for-Figma, light/dark toggle, per-section reset + reset-all.
- Do it as a safe sibling (`tools/color-studio-tc`) and retire the old app once
  the new one reaches parity.

## Non-Goals (explicit out of scope)

- Toolcraft's schema runtime: `defineToolcraft`, `ToolcraftApp`, `app-schema.ts`.
- `canvasContent`, the canvas contract, PNG/video export, the aspect-ratio /
  canvas-width/height Setup block.
- Toolcraft's acceptance harness, performance matrix, and decision-contract tests.
- Toolcraft's bundled AI workflow skills / AGENTS.md contract.

We take the component kit, not the framework.

## Architecture

**New tool:** `tools/color-studio-tc/` — a Vite + React 19 app, sibling to the
current `tools/color-studio`. It keeps importing the color engine from
`../../src/engine` (via the `@project` alias, as today).

**Clean logic/presentation split.** The current app already isolates logic from
presentation. The logic files are reused **verbatim**:

- `lib/theme-state.ts` — baseline, section modified/reset, accent add/remove.
- `lib/controls-math.ts` — hex parse, gradient tracks, swatch CSS.
- `serialize.ts` — config serialization for save.
- `export-figma.ts` — copy-tokens-for-Figma.
- `ui/preview.ts` — the imperative `renderPreview` (ramps grid + Playground).
  Vanilla DOM, Base-UI-independent, carries over unchanged.
- The `/__save-theme` Vite middleware — ported into the new `vite.config.ts`.

**What changes:** the presentation layer is rebuilt on Toolcraft's `@repo/ui`,
vendored into `tools/color-studio-tc/src/ui/`. This introduces:

- **Tailwind v4** + Toolcraft's theme-variable layer (`styles.css`, e.g.
  `--radius-lg`) and Tailwind theme config.
- `clsx`, `tailwind-merge`, `class-variance-authority`, plus the icon/util deps
  the components need.
- Standardization on `@base-ui/react` (Toolcraft's version), replacing the older
  `@base-ui-components/react` (rc.0) used today.

**Acquisition of `@repo/ui`.** Scaffold a throwaway Toolcraft app once
(`npx @pixel-point/toolcraft create` in a temp dir, `--no-skills`), copy its
resolved `@repo/ui` package (components + `styles.css` + Tailwind theme) into
`src/ui/`, and fix the few import paths. This yields a complete, self-consistent
component set without hand-resolving template import aliases.

## Component Mapping

| Current (Base UI) | Toolcraft `@repo/ui` | Notes |
|---|---|---|
| `Sidebar` (`<aside>` + head + footer) | `Panel` | Title + collapse + `onResetControls` built in; footer (Reset all / Save / Copy-for-Figma) → sticky footer `actionGroup` section |
| `Section` (Collapsible + modified + reset) | `ControlSection` / `PanelSection` | Keep localStorage open-state, "modified" diamond, and per-section reset as thin wrappers |
| `ParamSlider` | `Slider` control | Toolcraft slider ships value label + number entry. Gradient track + tick labels are not built in (see Friction) |
| `SeedControl` (swatch + hex + hue/chroma) | `Color` + two `Slider`s | Keep the paste-seeds-ramp logic (hex paste sets hue/chroma + pins brand source; slider tuning reshapes without touching brand); present with Toolcraft `Color` (swatch+hex) and sliders |
| dark-mode `Toggle`, alpha/contrast toggles | `Switch` control | Direct swap |
| `Preview` `Tabs` | `Tabs` composite | Wrapper only — `renderPreview` DOM untouched |
| Base UI `Toast` | `Sonner` composite | Replaces the Toast provider/viewport; `onSave`/`onCopyFigma` fire sonner toasts |
| Base UI `Tooltip` | `@base-ui/react` tooltip / built-in label help | Panel controls render label-help tooltips natively |

**State container (`App.tsx`).** The rAF-coalesced state update, light/dark
`mode` toggle (`document.documentElement.classList`), `showContrast`, save, copy,
and reset-all logic are preserved. Only the provider shells change: Base UI
`Tooltip.Provider` + `Toast.Provider` → Toolcraft's equivalents (`Sonner` +
`@base-ui/react` tooltip provider as needed).

## Friction Points (resolved during implementation; none are blockers)

1. **Gradient slider tracks + tick labels.** The hue/chroma sliders paint a live
   gradient fill (`hueTrack`, `chromaTrack`) and low/default/high ticks.
   Toolcraft's `Slider` doesn't do this out of the box. Plan: keep the gradient +
   ticks as a thin styling/wrapper layer (`SeedSlider`) over Toolcraft's slider.
   If it fights the component, fall back to Toolcraft's plain slider for those two
   and revisit — the gradient is nice-to-have, not core.
2. **Tailwind v4 vs. hand-written CSS.** The bespoke bits (ramp grid, swatches,
   Playground) port into the Tailwind setup. The `renderPreview` DOM uses its own
   classes; keep a small `preview.css` alongside Toolcraft's `styles.css`.
3. **Two Base UI packages.** Standardize on `@base-ui/react`; migrate any lingering
   direct imports.
4. **`/__save-theme` middleware.** Ported into the new `vite.config.ts` as-is.

## Verification

- App builds and runs (`vite`).
- Ramps + Playground preview renders and updates live as controls change.
- Sliders, hex paste, accent add/remove, and toggles drive the engine correctly.
- Save (`/__save-theme`) and copy-for-Figma work; toasts fire.
- Light/dark toggle works.
- Port the existing Playwright e2e (slider-thumb drag regression) against the new
  UI; it passes.
- Once green, retire `tools/color-studio` (delete, update `package.json`
  `preview:studio` script to point at the new tool).

## Rollback

The new app is additive (`tools/color-studio-tc`). Until the old app is deleted,
rollback is: keep using `tools/color-studio`. The engine and all logic files are
untouched, so nothing else in the pipeline is affected.
