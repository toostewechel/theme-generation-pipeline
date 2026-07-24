# Per-ramp "Export JSON" button — design

**Date:** 2026-07-24
**Tool:** `tools/color-studio-tc` (Color Studio)

## Summary

Add a small "Export JSON" button to each color-ramp and alpha-ramp row in the
Color Studio preview. Clicking it copies that single ramp's steps to the
clipboard as a simple `{ step: hex }` JSON map and shows a confirmation toast.

## Decisions (settled during brainstorming)

- **Destination:** copy to clipboard (matches the existing "Copy for Figma" and
  per-chip hex-copy affordances) with a sonner toast on success.
- **Format:** simple flat hex map, e.g. `{ "0": "#ffffff", "500": "#3b82f6" }`.
  - Solid rows → 6-digit hex via culori `formatHex`.
  - Alpha rows → 8-digit hex `#rrggbbaa` via culori `formatHex8`, so the
    transparency that defines the alpha section is preserved.
- **Scope:** the 9 solid ramp rows (`neutral`, `accent`, `secondary`,
  `tertiary`, `success`, `error`, `warning`, `info`, `darkSurface`) rendered by
  `renderRamps`, plus the 8 alpha-over-white rows rendered by
  `renderAlphaRamps`. Brand, dark-surface, and label-on-fill sections are not
  touched.

## Current state

Ramps are rendered as HTML strings in
[`src/ui/preview.ts`](../../../tools/color-studio-tc/src/ui/preview.ts):

- `renderRamps(set, surface)` → solid ramp rows.
- `renderAlphaRamps(set)` → alpha-over-white twin rows.
- Each row is `<div class="ramp"><span class="ramp-name">NAME</span><div class="ramp-chips">…</div></div>`.
- `renderPreview` binds a single delegated `click` listener on the (stable,
  React-owned) content root, guarded by `root.dataset.copyBound`. It currently
  handles per-chip hex copy via `[data-hex]` and toggles a `.copied` class for
  visual feedback.

The engine already exposes OKLCH→hex helpers indirectly; culori (`formatHex`)
is already imported in `preview.ts`. sonner `toast` is used from `App.tsx` and
`<Toaster/>` is mounted app-wide, so `toast` can be imported into `preview.ts`.

## Approach (chosen: A — payload registry + existing delegation)

1. **Hex-map helper** — `rampToHexMap(ramp, opts: { alpha: boolean })` returns
   an ordered `Record<string, string>` mapping each step to its hex string,
   using `formatHex` (solid) or `formatHex8` (alpha). Step order follows the
   ramp's own key order (insertion order, as elsewhere in the file).

2. **Payload registry** — a module-level `exportPayloads: Record<string, string>`
   is cleared and repopulated at the top of every `renderPreview` call. Keys are
   namespaced to avoid solid/alpha collisions on shared ramp names:
   `solid:<name>` and `alpha:<name>`. Values are `JSON.stringify(map, null, 2)`.
   Because it is module-level and read at click time, the once-bound listener
   always sees current data across `innerHTML` rebuilds.

3. **Button markup** — each `.ramp` row gains a trailing element after
   `.ramp-chips`: a `<button type="button" class="ramp-export"
   data-export-key="solid:accent" title="Export accent ramp as JSON"
   aria-label="Export accent ramp as JSON">` containing a small inline SVG icon
   (braces / download glyph consistent with the existing `COPY_ICON` style).

4. **Handler branch** — inside the existing delegated listener, before/after the
   `[data-hex]` branch, add: if the event target closes on `[data-export-key]`,
   read the key, look up `exportPayloads[key]`, `navigator.clipboard.writeText`
   it, and on success `toast.success(\`Copied ${name} ramp ✓\`)`. The ramp name
   for the toast is derived from the key suffix. Guard against a missing payload.

5. **Styling** — add `.ramp-export` rules to `src/preview.css` (where `.ramp`,
   `.ramp-chips`, and `.chip-copy` already live): revealed on row hover and on
   `:focus-visible`, sized/positioned to match `.chip-copy`, theme-aware for
   light/dark preview surfaces.

## Components / boundaries

- `rampToHexMap` — pure function, independently unit-testable. Input: a ramp
  record + `{ alpha }`. Output: ordered hex map. No DOM, no side effects.
- Rendering additions live entirely in `renderRamps` / `renderAlphaRamps`
  (markup) and `renderPreview` (registry + handler branch) in `preview.ts`.
- CSS additions are isolated to `src/preview.css` under `.ramp-export`.

## Data flow

`renderPreview(state, mode)` → `buildRamps(state)` → per row: `rampToHexMap` →
`JSON.stringify` → `exportPayloads[key]`. On click: key → payload → clipboard →
toast. No engine or token-emit code changes.

## Error handling

- Clipboard write is wrapped; on rejection, `toast.error("Copy failed")`
  (mirrors the existing Figma-copy failure path). The current per-chip handler
  swallows errors silently — the new button surfaces failures via toast since
  it already depends on sonner.
- Missing/empty payload for a key → no-op (defensive; should not occur).

## Testing

- Unit test for `rampToHexMap`:
  - solid ramp → 6-digit `#rrggbb`, correct value for a known OKLCH input.
  - alpha ramp → 8-digit `#rrggbbaa`, alpha channel present.
  - step ordering preserved.
- Existing preview render remains covered by current tests; a light assertion
  that each rendered `.ramp` row contains one `[data-export-key]` button may be
  added if a DOM-level preview test harness exists.

## Out of scope (YAGNI)

- File download, DTCG token shape, per-chip export, exporting brand/dark-surface
  sections, and any "export all ramps at once" affordance.
