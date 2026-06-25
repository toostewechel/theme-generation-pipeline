# Preview panel tabs — design

**Date:** 2026-06-25
**Status:** Approved for planning

## Summary

Split the Color Studio preview panel into two tabs to make it cleaner and more
focused:

- **Color ramps** — all palette/token visualizations (Ramps, Label-on-fill, Dark
  surfaces, Brand, and the conditional Alpha-over-white ramps).
- **Playground** — component specimens driven entirely by semantic color tokens,
  modestly expanded from today's single in-context sample.

The active tab is React state local to the preview, persisted to `localStorage`.
The preview's section renderers (`preview.ts`) stay as string builders; the entry
point switches on the active tab.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Playground scope | **Modest expansion** — move the existing sample, add a curated set of specimens |
| Tab division | **All palette → Color ramps**; **Playground = component specimens only** |
| Architecture | **React Base UI Tabs + tab-aware renderer** (active tab in React; `renderPreview` renders the active tab's group into `#pv-content`) |
| Tab state owner | **Local to `Preview.tsx`** (nothing else consumes it), persisted to `localStorage` |
| Specimen token fidelity | Semantic **color** tokens only; radius/spacing stay illustrative plain CSS |

## Architecture

### 1. `Preview.tsx` — React tab header + content container

`Preview` stops being a bare `<main>` and renders a small React header (title +
tabs) plus an inner container that the imperative renderer fills:

```tsx
<main id="preview" className={mode === "dark" ? "mode-dark" : "mode-light"}>
  <Tabs.Root value={tab} onValueChange={setTab} className="pv-tabs">
    <h3 className="pv-title">Preview</h3>
    <Tabs.List className="pv-tablist">
      <Tabs.Tab value="ramps" className="pv-tab">Color ramps</Tabs.Tab>
      <Tabs.Tab value="playground" className="pv-tab">Playground</Tabs.Tab>
    </Tabs.List>
  </Tabs.Root>
  <div ref={contentRef} id="pv-content" />
</main>
```

- Active tab: `const [tab, setTab] = useState<"ramps" | "playground">(...)`, initial
  value read from `localStorage["cs-preview-tab"]` (default `"ramps"`); `setTab`
  also writes it back.
- **Mode class moves to React** (`className` on `#preview`). `renderPreview` no
  longer owns `#preview`'s markup — it only manages `#pv-content`. The existing
  `#preview.mode-dark …` / `#preview.mode-light …` CSS selectors keep working
  because `#preview` still receives the class.
- Effect: `renderPreview(state, mode, contentRef.current, { showContrast, tab })`,
  deps `[state, mode, showContrast, tab]`.

### 2. `preview.ts` — options arg + two tab groups

`renderPreview`'s 4th parameter becomes an options object:

```ts
export function renderPreview(
  state: ThemeInputs,
  mode: "light" | "dark",
  root: HTMLElement,
  opts: { showContrast?: boolean; tab?: "ramps" | "playground" } = {},
): void
```

- `showContrast` is read from `opts` (default `true`); `tab` defaults to `"ramps"`.
- `root.className = …` (mode class) is **removed** — React owns it now.
- The monolithic `body.innerHTML = …` assembly splits into two functions, and the
  entry switches on `tab`, writing into `root` (the `#pv-content` container):
  - **`renderRampsTab(set, surface, state)`** → `renderRamps(set, surface)` +
    `renderLabelOnFill(set)` + `renderDarkSurfaces(state)` + `renderBrand(state)` +
    `(state.alpha ? renderAlphaRamps(set) : "")`. The "Generated N ramps · surface"
    caption folds in at the top of this group.
  - **`renderPlaygroundTab(vars)`** → the expanded specimen set (see §3).
- The copy-to-clipboard delegated listener moves from the old "header built once"
  guard to a dataset flag on the container, since `#pv-content` is always present:

```ts
if (!root.dataset.copyBound) {
  root.addEventListener("click", (e) => { /* existing data-hex copy logic */ });
  root.dataset.copyBound = "1";
}
root.innerHTML = tab === "playground"
  ? renderPlaygroundTab(vars)
  : renderRampsTab(set, surface, state);
```

### 3. Playground specimens (`renderPlaygroundTab`)

All specimens style from `var(--color-*)` semantic tokens (same approach as
today's `renderSample`), so the playground proves the semantic layer in context:

- **Card** — raised surface with heading (`--color-fg-emphasis`), body
  (`--color-fg`), muted annotation (`--color-fg-muted`), and a link
  (`--color-fg-link`).
- **Buttons** — primary (`--color-bg-accent` / `--color-fg-on-accent`),
  secondary/ghost (`--color-fg-secondary` / `--color-border-default`), disabled.
- **Form** — input default, input focus, input invalid + helper text, using
  `--color-bg`, `--color-border-default`, and the error foreground/border tokens.
- **Alerts** — one per status (success/error/warning/info) using
  `--color-bg-{status}-subtle` + `--color-fg-{status}`.
- **Badges/chips** — per status, mirroring the alert token pairs.

Structural styling (radius, spacing, gaps) is illustrative plain CSS — these
specimens demonstrate **semantic color tokens only**, not radius/dimension tokens
(the color studio does not generate those). This is the same stance as today's
sample and matches the project rule that preview specimens use the correct token
type for what they claim to demonstrate.

### 4. Styling (`styles.css`)

- `.pv-tablist` — horizontal row beneath the `.pv-title`.
- `.pv-tab` — quiet by default (muted ink, no background), full-ink when active,
  with a 2px bottom-border indicator on the selected tab (Base UI rc.0 marks the
  active tab via `data-active`). Hover/focus-visible states consistent with other
  studio controls.
- `#pv-content` — the scroll area below the tab bar.
- Dark mode inherits the existing `#preview.mode-dark` treatment; add
  `#preview.mode-dark .pv-tab` overrides only if needed for contrast.
- Base UI Tabs imported from `@base-ui-components/react/tabs`
  (`Tabs.Root` / `Tabs.List` / `Tabs.Tab`). `Tabs.Panel` is **not** used — content
  is rendered imperatively into `#pv-content`, so `Tabs` is purely the segmented
  control + selection state. Exact rc.0 part names verified at implementation time.

## Testing

The preview render functions have no unit tests today (DOM-string builders); this
design follows that precedent. Gate: `npm run build` (compile) plus a manual pass.
Manually verifiable:

1. Two tabs render in the preview header.
2. **Color ramps** shows ramps, label-on-fill, dark surfaces, brand (and the
   alpha ramps when the Output toggle is on).
3. **Playground** shows the component specimens and *not* the ramps.
4. Tab choice survives a reload (`localStorage`).
5. Copy-to-clipboard still works on ramp chips and brand swatches.
6. Dark-mode toggle still restyles the panel.

## Scope boundaries

**In scope:** the tab bar, the two tab groups, the modest Playground expansion, tab
persistence, and the `preview.ts` refactor into two group functions + options arg.

**Out of scope (YAGNI):** a third tab; a full component gallery; radius/spacing
token specimens; per-tab toolbars; automated tab tests.

## Footprint

`Preview.tsx` (tab header + state), `preview.ts` (options arg, two group functions,
copy-handler rebind, playground specimens), `styles.css` (tab + content styling).
No engine changes.
