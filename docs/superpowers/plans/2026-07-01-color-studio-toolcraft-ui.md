# Color Studio → Toolcraft UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Color Studio app's presentation layer on Toolcraft's `@repo/ui` component kit as a new sibling tool `tools/color-studio-tc`, reusing all engine/logic code unchanged.

**Architecture:** New Vite + React 19 app at `tools/color-studio-tc`, sibling to `tools/color-studio`. It imports the color engine from the repo root via a `@project` alias (as today) and reuses the logic files verbatim (`lib/theme-state`, `lib/controls-math`, `serialize`, `export-figma`, `ui/preview`). The presentation layer is rebuilt on Toolcraft's `@repo/ui`, vendored into `src/ui/`, styled with Tailwind v4 + a copied Toolcraft theme layer. We take the component kit only — none of Toolcraft's schema runtime, canvas contract, PNG/video export, or acceptance/perf harness.

**Tech Stack:** Vite 6, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), `@base-ui/react`, `sonner`, `@phosphor-icons/react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `culori` (already used by the engine), Playwright (e2e), Vitest (unit).

## Global Constraints

- Do NOT adopt Toolcraft's runtime: no `defineToolcraft`, `ToolcraftApp`, `app-schema.ts`, `canvasContent`, PNG/video export, aspect-ratio/canvas Setup block, acceptance/performance harness, decision-contract tests, or bundled AI skills. Components (`@repo/ui`) + theme CSS only.
- Reuse logic files from `tools/color-studio` **verbatim** — do not re-derive: `src/lib/theme-state.ts`, `src/lib/controls-math.ts`, `src/serialize.ts`, `src/export-figma.ts`, `src/ui/preview.ts`, and their `*.test.ts`.
- Engine import path stays `@project/src/engine/index.js`; theme config stays `@project/theme.config.js`. The `@project` alias points at the repo root (`../..` from the tool dir).
- The `/__save-theme` dev-server middleware writes to `<repoRoot>/theme.config.ts` — preserve this behavior exactly.
- Standardize on `@base-ui/react` (Toolcraft's version). Do not add `@base-ui-components/react`.
- Keep the old `tools/color-studio` working until parity is verified; retire it only in the final task.
- Node ESM: all local imports use explicit `.js`/`.jsx` extensions where the existing code does (the tool uses `moduleResolution: bundler` but keeps `.js` specifiers, matching `tools/color-studio`).

---

### Task 1: Scaffold the new tool and vendor Toolcraft's `@repo/ui`

**Files:**
- Create: `tools/color-studio-tc/package.json`
- Create: `tools/color-studio-tc/tsconfig.json`
- Create: `tools/color-studio-tc/vite.config.ts`
- Create: `tools/color-studio-tc/index.html`
- Create: `tools/color-studio-tc/src/main.tsx`
- Create: `tools/color-studio-tc/src/App.tsx` (temporary smoke-test shell)
- Create: `tools/color-studio-tc/src/ui/**` (vendored from a throwaway Toolcraft scaffold)
- Create: `tools/color-studio-tc/.gitignore`

**Interfaces:**
- Produces: the `@ui` import alias → `tools/color-studio-tc/src/ui/index.ts` re-exporting Toolcraft components (`Panel`, `PanelSection`, `Slider`, `Switch`, `Segmented`, `Color`, control-layout helpers like `ControlFieldLabelHelpProvider`, composites like `Toaster`).
- Produces: `@project` alias → repo root.

- [ ] **Step 1: Scaffold a throwaway Toolcraft app and locate `@repo/ui`**

```bash
cd /tmp
rm -rf tc-lift && mkdir tc-lift && cd tc-lift
npx @pixel-point/toolcraft create tc-lift --name tc-lift --yes --force --no-skills
# Find the resolved UI package source (the dir that contains components/panel):
UIDIR="$(dirname "$(find /tmp/tc-lift -type d -path '*/components/panel' | head -1)")"
echo "UI source dir: $UIDIR"           # e.g. /tmp/tc-lift/packages/ui/src
# Find the runtime stylesheet (theme variables live here):
find /tmp/tc-lift -path '*toolcraft-runtime*/styles.css'
```

Expected: `$UIDIR` points at a directory containing `components/`, `hooks/`, `lib/`, `index.ts`, `styles.css`.

- [ ] **Step 2: Copy the UI package source into the new tool**

```bash
cd /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline
mkdir -p tools/color-studio-tc/src/ui
cp -R "$UIDIR/." tools/color-studio-tc/src/ui/
# Copy the runtime theme stylesheet next to the ui styles (theme layer only, no runtime JS):
cp "$(find /tmp/tc-lift -path '*toolcraft-runtime*/styles.css' | head -1)" tools/color-studio-tc/src/ui/runtime-theme.css
ls tools/color-studio-tc/src/ui   # expect: components  hooks  index.ts  lib  styles.css  runtime-theme.css
```

Expected: `tools/color-studio-tc/src/ui/index.ts` exists and `components/panel/panel.tsx` is present. Internal imports in the copied files are relative (`../../lib/utils`, `../primitives`) and need no rewriting.

- [ ] **Step 3: Write `package.json`**

`tools/color-studio-tc/package.json`:

```json
{
  "name": "color-studio-tc",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@fontsource-variable/inter": "^5.2.8",
    "@phosphor-icons/react": "^2.1.10",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "culori": "^4.0.2",
    "lucide-react": "^0.511.0",
    "motion": "^11.16.3",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-resizable-panels": "^4.10.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.0",
    "@tailwindcss/vite": "^4.1.18",
    "@types/node": "^25.5.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.7.0",
    "tailwindcss": "^4.1.18",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.9"
  }
}
```

> Note: dependency list is the union of what the vendored components import. After Step 6, if `vite` reports an unresolved import from `src/ui`, add that exact package here and re-install — do not delete the offending component.

- [ ] **Step 4: Write `tsconfig.json`, `vite.config.ts`, `index.html`**

`tools/color-studio-tc/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"],
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "paths": {
      "@ui": ["./src/ui/index.ts"],
      "@ui/*": ["./src/ui/*"]
    },
    "baseUrl": "."
  },
  "include": ["src"]
}
```

`tools/color-studio-tc/vite.config.ts` (Tailwind plugin + save middleware + aliases; middleware copied verbatim from `tools/color-studio/vite.config.ts`):

```ts
import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { writeFileSync } from "fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = resolve(__dirname, "../..");

function saveThemePlugin(): Plugin {
  return {
    name: "save-theme",
    configureServer(server) {
      server.middlewares.use("/__save-theme", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            writeFileSync(resolve(projectRoot, "theme.config.ts"), body, "utf-8");
            res.statusCode = 200;
            res.end("ok");
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss(), saveThemePlugin()],
  resolve: {
    alias: {
      "@project": projectRoot,
      "@ui": resolve(__dirname, "src/ui/index.ts"),
      "@ui/": resolve(__dirname, "src/ui/"),
    },
  },
  server: { open: true, fs: { allow: [projectRoot] } },
});
```

`tools/color-studio-tc/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Color Studio (Toolcraft)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`tools/color-studio-tc/.gitignore`:

```
node_modules
dist
test-results
playwright-report
```

- [ ] **Step 5: Write a temporary smoke-test `App.tsx` and `main.tsx`**

`tools/color-studio-tc/src/main.tsx`:

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

`tools/color-studio-tc/src/App.tsx` (temporary — replaced in Task 7):

```tsx
import { useState } from "react";
import { Panel, PanelSection, Slider } from "@ui";

export default function App() {
  const [v, setV] = useState(50);
  return (
    <div style={{ padding: 20 }}>
      <Panel title="Smoke Test">
        <PanelSection title="Group">
          <Slider name="Value" min={0} max={100} step={1} value={v} onValueChange={setV} />
        </PanelSection>
      </Panel>
    </div>
  );
}
```

> `styles.css` is created in Task 2. Create an empty `tools/color-studio-tc/src/styles.css` now so the import resolves; Task 2 fills it.

- [ ] **Step 6: Install and boot**

```bash
cd tools/color-studio-tc && npm install && npm run dev -- --port 5181 --strictPort
```

Expected: dev server starts with no unresolved-import errors from `src/ui`. Page loads (styling comes in Task 2). If any `src/ui` import fails to resolve, add the exact missing package to `dependencies` and re-run.

- [ ] **Step 7: Commit**

```bash
git add tools/color-studio-tc
git commit -m "feat(color-studio-tc): scaffold tool and vendor Toolcraft @repo/ui"
```

---

### Task 2: Theme + Tailwind wiring (light default, dark on `.dark`)

**Files:**
- Modify: `tools/color-studio-tc/src/styles.css` (fill the empty file from Task 1)

**Interfaces:**
- Produces: Toolcraft CSS variables (`--foreground`, `--background`, `--border`, `--muted`, `--link`, `--radius`, `--radius-lg`, etc.) resolved in **light** mode by default and **dark** under `html.dark`; Tailwind `@theme` tokens (`--text-2xs`, `--text-xs-plus`, radius scale) so component utility classes resolve.

Light values are taken from Toolcraft's runtime light theme; dark values from the starter's `:root` dark defaults.

- [ ] **Step 1: Author `src/styles.css`**

```css
@import "tailwindcss";
@source ".";
@source "./ui";
@import "tw-animate-css";
@import "@fontsource-variable/inter";
@import "./ui/styles.css";
@import "./ui/runtime-theme.css";
@import "./preview.css";

@theme {
  --spacing-field-control: 0.3125rem;
  --text-2xs: 0.6875rem;
  --text-2xs--line-height: 0.875rem;
  --text-xs-plus: 0.8125rem;
  --text-xs-plus--line-height: 1.125rem;
  --font-sans: "Inter Variable", sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --radius-xs: 0.125rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

@custom-variant dark (&:where(.dark, .dark *));
@custom-variant focus-visible (&:is([data-focus-visible-mode="keyboard"] *):focus-visible);

/* Light is the default for the studio chrome. */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --link: #0c6cf2;
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: #f5f5f5;
  --muted-foreground: oklch(0.556 0 0);
  --accent: #0c8ce9;
  --accent-foreground: oklch(0.205 0 0);
  --attention: #ea733a;
  --attention-foreground: oklch(0.145 0 0);
  --destructive: hsl(0 84% 60%);
  --destructive-foreground: oklch(0.145 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.375rem;
  --button-radius-xs: 0.125rem;
  --button-radius-sm: 0.25rem;
  --button-radius-md: 0.375rem;
  --button-radius-lg: 0.5rem;
  color-scheme: light;
}

html.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.977 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --link: #70b0fa;
  --muted: #262626;
  --muted-foreground: oklch(0.708 0 0);
  --secondary: oklch(0.249 0.07 263.47);
  --secondary-foreground: oklch(0.977 0 0);
  --border: oklch(0.311 0.013 279.19);
  --input: oklch(0.311 0.013 279.19);
  --ring: oklch(0.556 0 0);
  color-scheme: dark;
}

@layer base {
  * {
    border-color: var(--border);
    box-sizing: border-box;
    outline-color: color-mix(in oklab, var(--ring) 50%, transparent);
  }
  html { font-family: var(--font-sans); }
  body {
    background-color: var(--background);
    color: var(--foreground);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

html, body, #root { margin: 0; height: 100%; min-height: 100%; }
input, button { font-family: inherit; }
```

> If `src/ui/runtime-theme.css` scopes its variables to `[data-toolcraft-theme]` only, those definitions won't apply to our tree — the `:root`/`html.dark` blocks above are the authoritative source and take precedence. Keep the import (harmless) but rely on the blocks above. `./preview.css` is created in Task 5 — create an empty `tools/color-studio-tc/src/preview.css` now so the import resolves.

- [ ] **Step 2: Verify styling in the browser**

```bash
cd tools/color-studio-tc && npm run dev -- --port 5181 --strictPort
```

Expected (manual, load http://localhost:5181): the smoke-test Panel renders with a rounded surface, a "Smoke Test" header, a "Group" section, and a styled slider with a value label — not unstyled HTML. Toggle dark by running in the console `document.documentElement.classList.add('dark')` — background goes dark, panel adapts.

- [ ] **Step 3: Add a Playwright styling smoke test**

`tools/color-studio-tc/playwright.config.ts` (copied from `tools/color-studio/playwright.config.ts`, port 5181):

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5181" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5181 --strictPort",
    url: "http://localhost:5181",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

`tools/color-studio-tc/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("panel and slider render styled", async ({ page }) => {
  await page.goto("/");
  // Toolcraft panel surface has a non-transparent background once themed.
  const panelTitle = page.getByText("Smoke Test");
  await expect(panelTitle).toBeVisible();
  // The slider primitive exposes role=slider.
  await expect(page.getByRole("slider").first()).toBeVisible();
});
```

- [ ] **Step 4: Run it**

```bash
cd tools/color-studio-tc && npx playwright install chromium && npm run test:e2e -- smoke.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio-tc/src/styles.css tools/color-studio-tc/playwright.config.ts tools/color-studio-tc/e2e/smoke.spec.ts tools/color-studio-tc/src/preview.css
git commit -m "feat(color-studio-tc): wire Tailwind v4 + Toolcraft theme (light/dark)"
```

---

### Task 3: Port engine/logic files verbatim

**Files:**
- Create (copy unchanged from `tools/color-studio`): `src/lib/theme-state.ts`, `src/lib/theme-state.test.ts`, `src/lib/controls-math.ts`, `src/lib/controls-math.test.ts`, `src/serialize.ts`, `src/serialize.test.ts`, `src/export-figma.ts`, `src/ui/preview.ts`
- Create: `tools/color-studio-tc/vitest.config.ts`

**Interfaces:**
- Produces (from `theme-state.ts`): `withDarkSurfaceFallback(inputs)`, `isSectionModified(section, state, baseline)`, `resetSection(section, state, baseline)`, `presentAccentSlots(state)`, `accentCount(state)`, `addAccent(state)`, `removeAccent(state)`, type `SectionKey`.
- Produces (from `controls-math.ts`): `hexOf(hue, chroma, l)`, `parseHex(input)`, `hueTrack()`, `chromaTrack(hue)`, `swatchCss(l, hue, chroma)`, `REP_L`.
- Produces (from `serialize.ts`): `serializeConfig(state)`.
- Produces (from `export-figma.ts`): `copyTokensForFigma(state)`.
- Produces (from `ui/preview.ts`): `renderPreview(state, mode, el, { showContrast, tab })`.

- [ ] **Step 1: Copy the logic files unchanged**

```bash
cd /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline
SRC=tools/color-studio/src
DST=tools/color-studio-tc/src
mkdir -p "$DST/lib" "$DST/ui"
cp "$SRC/lib/theme-state.ts" "$SRC/lib/theme-state.test.ts" "$DST/lib/"
cp "$SRC/lib/controls-math.ts" "$SRC/lib/controls-math.test.ts" "$DST/lib/"
cp "$SRC/serialize.ts" "$SRC/serialize.test.ts" "$DST/"
cp "$SRC/export-figma.ts" "$DST/"
cp "$SRC/ui/preview.ts" "$DST/ui/"
```

These files import the engine via `@project/src/engine/index.js` and use `culori`; both aliases/deps are already configured. Do not edit them.

- [ ] **Step 2: Add `vitest.config.ts`**

`tools/color-studio-tc/vitest.config.ts` (copied from `tools/color-studio/vitest.config.ts`; confirm it sets the `@project` alias — if the source file resolves `@project`, copy as-is):

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: { alias: { "@project": resolve(__dirname, "../..") } },
  test: { environment: "node" },
});
```

- [ ] **Step 3: Run the ported unit tests**

```bash
cd tools/color-studio-tc && npm run test
```

Expected: the theme-state, controls-math, and serialize test suites PASS (same as in `tools/color-studio`).

- [ ] **Step 4: Commit**

```bash
git add tools/color-studio-tc/src/lib tools/color-studio-tc/src/serialize.ts tools/color-studio-tc/src/serialize.test.ts tools/color-studio-tc/src/export-figma.ts tools/color-studio-tc/src/ui/preview.ts tools/color-studio-tc/vitest.config.ts
git commit -m "feat(color-studio-tc): port engine/logic files verbatim"
```

---

### Task 4: `NumericControl` — Toolcraft Slider wrapper with formatted value + help

**Files:**
- Create: `tools/color-studio-tc/src/components/NumericControl.tsx`
- Test: `tools/color-studio-tc/src/components/NumericControl.test.tsx`

**Interfaces:**
- Consumes: `Slider` and `ControlFieldLabelHelpProvider` from `@ui`.
- Produces: `NumericControl` — the ParamSlider replacement.

```ts
interface NumericControlProps {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
  format?: (v: number) => string;   // maps to Toolcraft Slider `valueLabel`
  help?: string;                    // maps to label-help tooltip via context provider
  markerCount?: number;             // optional evenly-spaced markers (replaces bespoke ticks)
}
```

> Scope note: the old `ParamSlider` painted a live gradient track (`hueTrack`/`chromaTrack`) and custom tick **labels**. Toolcraft's `Slider` supports neither natively. Per the spec's Friction Point 1, v1 uses the plain Toolcraft slider with a formatted `valueLabel` and optional `markerCount`. The gradient track + labeled ticks are dropped for v1 (documented as a future enhancement). `hueTrack`/`chromaTrack` remain exported from `controls-math` but are unused for now.

- [ ] **Step 1: Write the failing test**

`tools/color-studio-tc/src/components/NumericControl.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NumericControl } from "./NumericControl.js";

test("renders name and formatted value label", () => {
  render(
    <NumericControl name="Hue" min={0} max={360} step={1} value={120} format={(v) => `${v}°`} onValueChange={() => {}} />,
  );
  expect(screen.getByText("Hue")).toBeInTheDocument();
  expect(screen.getByText("120°")).toBeInTheDocument();
});
```

Add test deps: `npm install -D @testing-library/react @testing-library/jest-dom jsdom`. Do NOT change the global Vitest environment — the ported logic tests (Task 3) run under `node`. The `// @vitest-environment jsdom` docblock on the first line of this file (component tests only) opts just this file into jsdom, leaving the node suites untouched. No `test-setup.ts` is needed; `@testing-library/jest-dom` is imported directly in the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/color-studio-tc && npx vitest run src/components/NumericControl.test.tsx`
Expected: FAIL — `NumericControl` not found.

- [ ] **Step 3: Implement**

`tools/color-studio-tc/src/components/NumericControl.tsx`:

```tsx
import { Slider, ControlFieldLabelHelpProvider } from "@ui";

interface NumericControlProps {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
  format?: (v: number) => string;
  help?: string;
  markerCount?: number;
}

export function NumericControl({
  name, min, max, step, value, onValueChange, format = String, help, markerCount,
}: NumericControlProps) {
  const slider = (
    <Slider
      name={name}
      min={min}
      max={max}
      step={step}
      value={value}
      valueLabel={format(value)}
      markerCount={markerCount}
      onValueChange={(v) => onValueChange(v)}
    />
  );
  return help ? (
    <ControlFieldLabelHelpProvider help={help} label={name}>
      {slider}
    </ControlFieldLabelHelpProvider>
  ) : (
    slider
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/color-studio-tc && npx vitest run src/components/NumericControl.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio-tc/src/components/NumericControl.tsx tools/color-studio-tc/src/components/NumericControl.test.tsx tools/color-studio-tc/package.json tools/color-studio-tc/package-lock.json
git commit -m "feat(color-studio-tc): NumericControl (Toolcraft Slider + formatted value + help)"
```

---

### Task 5: `SeedControl` (custom swatch + hex input + two `NumericControl` sliders) and `preview.css`

**Files:**
- Create: `tools/color-studio-tc/src/components/SeedControl.tsx`
- Modify: `tools/color-studio-tc/src/preview.css` (fill the empty file from Task 2)
- Test: `tools/color-studio-tc/e2e/seed.spec.ts` (added in Task 9's e2e; here just build the component)

**Interfaces:**
- Consumes: `NumericControl` (Task 4); `hexOf`, `parseHex`, `swatchCss`, `REP_L` from `controls-math`; types `HueSeed`, `Oklch` from `@project/src/engine`.
- Produces: `SeedControl` with props `{ name, seed, onSeed(seed, source?), onRemove? }` — identical contract to the old `SeedControl`.

- [ ] **Step 1: Port `preview.css` (preview-only rules)**

Copy from `tools/color-studio/src/styles.css` **only the preview-surface rules** into `tools/color-studio-tc/src/preview.css` — the blocks for: `#preview`, `.pv-title`, `.pv-sub`, `.pv-legend`, `.pv-section*`, `.ramp*`, `.chip*`, `.ic*`, `.ds-*`, `.brand*`, `.copy-btn`, `.fill-*`, `.sample*`, `.pv-alpha`, `.pv-tabs`/`.pv-tablist`/`.pv-tab` (the tab-strip styles are unused after Task 8 but harmless), and `.pg-*` (Playground specimens). Do NOT copy the sidebar/section/seed/slider/button/toggle/tooltip/toast rules — those are replaced by Toolcraft components. These preview classes are produced by the imperative `renderPreview` DOM and must survive unchanged.

Also add small utility classes the SeedControl markup uses (swatch + hex input), since they are studio-specific chrome:

```css
/* Seed control chrome (Toolcraft-themed) */
.cs-seed-head { display: flex; align-items: center; gap: 9px; }
.cs-swatch {
  background: var(--card); padding: 2px; border-radius: var(--radius-sm);
  box-shadow: 0 1px 3px oklch(0 0 0 / 0.16); flex: none; line-height: 0;
}
.cs-swatch > i { display: block; width: 14px; height: 14px; border-radius: 4px; }
.cs-seed-name { font-size: 12px; font-weight: 500; }
.cs-hex {
  margin-left: auto; width: 96px; text-align: right; white-space: nowrap;
  font-family: var(--font-mono); font-size: 10.5px; text-transform: lowercase;
  color: var(--muted-foreground); background: var(--card);
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 7px;
}
.cs-hex:focus-visible { outline: none; border-color: var(--link); color: var(--foreground); }
.cs-hex--bad { border-color: hsl(0 84% 60%); color: hsl(0 70% 45%); }
.cs-seed-remove {
  appearance: none; border: none; background: none; cursor: pointer;
  color: var(--muted-foreground); font-size: 14px; line-height: 1; padding: 2px;
}
.cs-seed-remove:hover { color: var(--foreground); }
```

- [ ] **Step 2: Implement `SeedControl`**

Port `tools/color-studio/src/components/SeedControl.tsx`, swapping the old `.seed`/`.swatch`/`.hex`/`.seed-remove` classes for `.cs-*`, and the old `ParamSlider` for `NumericControl`. The hex-paste logic (displayL, parseHex, source emission, bad-hex flash timer) is copied unchanged.

`tools/color-studio-tc/src/components/SeedControl.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { oklch } from "culori";
import type { HueSeed, Oklch } from "@project/src/engine/index.js";
import { NumericControl } from "./NumericControl.js";
import { hexOf, parseHex, swatchCss, REP_L } from "../lib/controls-math.js";

interface SeedControlProps {
  name: string;
  seed: HueSeed;
  onSeed: (seed: HueSeed, source?: Oklch) => void;
  onRemove?: () => void;
}

export function SeedControl({ name, seed, onSeed, onRemove }: SeedControlProps) {
  const [displayL, setDisplayL] = useState(REP_L);
  const [hexBad, setHexBad] = useState(false);
  const badTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hexValue = hexOf(seed.hue, seed.chroma, displayL);

  useEffect(() => () => { if (badTimer.current) clearTimeout(badTimer.current); }, []);

  const emit = (next: HueSeed, source?: Oklch) => onSeed(next, source);

  const onHexCommit = (raw: string) => {
    const parsed = parseHex(raw);
    const exact = oklch(raw.trim());
    if (!parsed || !exact) {
      setHexBad(true);
      if (badTimer.current) clearTimeout(badTimer.current);
      badTimer.current = setTimeout(() => setHexBad(false), 900);
      return;
    }
    setDisplayL(parsed.l);
    emit({ hue: parsed.hue, chroma: parsed.chroma }, { l: exact.l!, c: exact.c ?? 0, h: exact.h ?? 0 });
  };

  return (
    <div>
      <div className="cs-seed-head">
        <span className="cs-swatch"><i style={{ background: swatchCss(displayL, seed.hue, seed.chroma) }} /></span>
        <span className="cs-seed-name">{name}</span>
        <input
          className={"cs-hex" + (hexBad ? " cs-hex--bad" : "")}
          type="text" spellCheck={false} defaultValue={hexValue} key={hexValue}
          onBlur={(e) => onHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          title="Paste a brand hex — hue & chroma seed the ramp; the lightness shown just echoes your paste"
        />
        {onRemove && (
          <button type="button" className="cs-seed-remove" onClick={onRemove}
            aria-label={`Remove ${name} accent`} title={`Remove ${name} accent`}>×</button>
        )}
      </div>
      <NumericControl
        name="Hue" min={0} max={360} step={1} value={seed.hue}
        format={(v) => `${v}°`}
        help="Drag right to walk the color wheel — warm reds → greens → cool blues."
        onValueChange={(v) => emit({ hue: v, chroma: seed.chroma })}
      />
      <NumericControl
        name="Chroma" min={0} max={0.3} step={0.005} value={seed.chroma}
        format={(v) => v.toFixed(3)}
        help="Drag right for more vivid; left fades toward gray."
        onValueChange={(v) => emit({ hue: seed.hue, chroma: v })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd tools/color-studio-tc && npx tsc -p tsconfig.json --noEmit`
Expected: no errors in `SeedControl.tsx` / `NumericControl.tsx`.

- [ ] **Step 4: Commit**

```bash
git add tools/color-studio-tc/src/components/SeedControl.tsx tools/color-studio-tc/src/preview.css
git commit -m "feat(color-studio-tc): SeedControl on Toolcraft Slider + preview.css"
```

---

### Task 6: `Section` (PanelSection wrapper with persistence, modified indicator, reset)

**Files:**
- Create: `tools/color-studio-tc/src/components/Section.tsx`

**Interfaces:**
- Consumes: `PanelSection` from `@ui`.
- Produces: `Section` with props `{ id, title, description?, modified?, onReset?, children }` — same contract as the old `Section`, so `Sidebar` (Task 7) can use it identically.

Persistence: open-state persists to `localStorage` under `cs-tc-section-<id>`. `PanelSection` is `collapsible`/`collapsed`-controlled; the "modified" diamond and per-section reset render in its `action` slot.

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { PanelSection } from "@ui";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  modified?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}

export function Section({ id, title, description, modified, onReset, children }: SectionProps) {
  const storageKey = `cs-tc-section-${id}`;
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );

  const handleCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(storageKey, String(next));
  };

  const action = (
    <span className="inline-flex items-center gap-1.5">
      {modified && (
        <span
          title="modified from default"
          style={{ width: 8, height: 8, background: "var(--attention)", transform: "rotate(45deg)", display: "inline-block" }}
        />
      )}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Reset ${title}`}
          title={`Reset ${title}`}
          className="inline-flex items-center justify-center p-0.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </button>
      )}
    </span>
  );

  return (
    <PanelSection
      title={title}
      collapsible
      collapsed={collapsed}
      onCollapsedChange={handleCollapsed}
      action={action}
    >
      {description && (
        <p className="m-0 text-[color:var(--muted-foreground)]" style={{ fontSize: 11, lineHeight: 1.4 }}>
          {description}
        </p>
      )}
      {children}
    </PanelSection>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd tools/color-studio-tc && npx tsc -p tsconfig.json --noEmit`
Expected: no errors in `Section.tsx`.

- [ ] **Step 3: Commit**

```bash
git add tools/color-studio-tc/src/components/Section.tsx
git commit -m "feat(color-studio-tc): Section wrapper over Toolcraft PanelSection"
```

---

### Task 7: `Sidebar` (Panel assembling all sections + footer actions + mode toggle)

**Files:**
- Create: `tools/color-studio-tc/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `Panel`, `PanelSection`, `Switch` from `@ui`; `Section` (Task 6), `SeedControl` (Task 5), `NumericControl` (Task 4); `theme-state` helpers.
- Produces: `Sidebar` with the same prop contract as the old one:
  `{ state, baseline, mode, showContrast, onChange, onModeToggle, onShowContrastChange, onSave, onCopyFigma, onResetAll }`.

- [ ] **Step 1: Implement**

Port `tools/color-studio/src/components/Sidebar.tsx`, mapping structure onto Toolcraft:
- Outer `<aside>` → `<Panel title="Color Studio" onResetControls={onResetAll}>`.
- Header subtitle + dark-mode toggle → a top **non-collapsible** `PanelSection` (no title) containing a `Switch` labeled "Dark preview" (`checked={mode === "dark"}`, `onCheckedChange={onModeToggle}`) and a small subtitle `<p>`.
- Each `Section` (Foundation / Accents / Status / Dark surfaces / Output) is preserved with the same children, using `NumericControl` for the Contrast / Base depth / Elevation step sliders and `Switch` for the alpha + contrast-badge toggles.
- Add-accent button → a plain button inside the Accents section (Tailwind-styled).
- Footer (Save theme / Copy for Figma) → a final `PanelSection actionGroup="primary"` (renders as the sticky footer). "Reset all" is already provided by `Panel`'s header reset; keep an explicit "Reset all" button in the footer too for parity.

```tsx
import { Panel, PanelSection, Switch } from "@ui";
import { SunIcon, MoonIcon } from "@phosphor-icons/react";
import type { ThemeInputs, HueSeed, Oklch } from "@project/src/engine/index.js";
import { Section } from "./Section.js";
import { SeedControl } from "./SeedControl.js";
import { NumericControl } from "./NumericControl.js";
import {
  isSectionModified, resetSection, presentAccentSlots, accentCount,
  addAccent, removeAccent, type SectionKey,
} from "../lib/theme-state.js";

interface SidebarProps {
  state: ThemeInputs;
  baseline: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
  onChange: (next: ThemeInputs) => void;
  onModeToggle: () => void;
  onShowContrastChange: (next: boolean) => void;
  onSave: () => void;
  onCopyFigma: () => void;
  onResetAll: () => void;
}

const STATUS = ["success", "error", "warning", "info"] as const;

export function Sidebar(props: SidebarProps) {
  const {
    state, baseline, mode, showContrast, onChange, onModeToggle,
    onShowContrastChange, onSave, onCopyFigma, onResetAll,
  } = props;
  const mod = (s: SectionKey) => isSectionModified(s, state, baseline);
  const reset = (s: SectionKey) => onChange(resetSection(s, state, baseline));
  const contrast = typeof state.contrast === "number" ? state.contrast : 0.5;

  return (
    <Panel title="Color Studio" onResetControls={onResetAll}>
      <PanelSection>
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[color:var(--muted-foreground)]" style={{ fontSize: 11 }}>
            Tune the seeds — watch the theme rebuild live.
          </p>
          <button
            type="button"
            onClick={onModeToggle}
            aria-label="Toggle dark preview"
            title={mode === "dark" ? "Switch to light" : "Switch to dark"}
            className="inline-flex size-7 items-center justify-center rounded-md border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {mode === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>
        </div>
      </PanelSection>

      <Section id="foundation" title="Foundation"
        description="The gray and contrast every other color is built on"
        modified={mod("foundation")} onReset={() => reset("foundation")}>
        <SeedControl name="neutral" seed={state.neutral}
          onSeed={(seed) => onChange({ ...state, neutral: seed })} />
        <NumericControl name="Contrast" min={0} max={1} step={0.01} value={contrast}
          format={(v) => v.toFixed(2)}
          help="How far apart the light and dark steps sit. Higher = punchier, more separation."
          onValueChange={(v) => onChange({ ...state, contrast: v })} />
      </Section>

      <Section id="accents" title="Accents"
        description="Brand colors: each hue seeds a full tint & shade ramp"
        modified={mod("accents")} onReset={() => reset("accents")}>
        {presentAccentSlots(state).map((key, i, all) => (
          <SeedControl key={key} name={key} seed={state.accents[key]!}
            onSeed={(seed: HueSeed, source?: Oklch) =>
              onChange({
                ...state,
                accents: { ...state.accents, [key]: seed },
                ...(source ? { brand: { ...state.brand, [key]: source } } : {}),
              })
            }
            onRemove={key !== "primary" && i === all.length - 1 ? () => onChange(removeAccent(state)) : undefined}
          />
        ))}
        {accentCount(state) < 3 && (
          <button type="button" onClick={() => onChange(addAccent(state))}
            className="text-[color:var(--link)] text-xs font-medium hover:underline">
            + Add accent
          </button>
        )}
      </Section>

      <Section id="status" title="Status"
        description="Feedback colors: success, error, warning, info."
        modified={mod("status")} onReset={() => reset("status")}>
        {STATUS.map((key) => (
          <SeedControl key={key} name={key} seed={state.status[key]}
            onSeed={(seed) => onChange({ ...state, status: { ...state.status, [key]: seed } })} />
        ))}
      </Section>

      <Section id="darkSurfaces" title="Dark surfaces"
        description="How deep dark mode goes and layer seperation"
        modified={mod("darkSurfaces")} onReset={() => reset("darkSurfaces")}>
        <NumericControl name="Base depth" min={0.05} max={0.4} step={0.005}
          value={state.darkSurfaces!.base}
          format={(v) => `${Math.round(v * 100)}% light`}
          help="Lightness of the darkest surface (the page background). Lower is darker."
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, base: v } })} />
        <NumericControl name="Elevation step" min={0} max={0.08} step={0.002}
          value={state.darkSurfaces!.step}
          format={(v) => `+${(v * 100).toFixed(1)}% / level`}
          help="Lightness added per raised layer — more = stronger separation."
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, step: v } })} />
      </Section>

      <Section id="output" title="Output" description="Optional tokens & preview display">
        <Switch name="Alpha-over-white tokens" checked={!!state.alpha}
          onCheckedChange={(p) => onChange({ ...state, alpha: p })} />
        <Switch name="Contrast badges" checked={showContrast}
          onCheckedChange={onShowContrastChange} />
      </Section>

      <PanelSection actionGroup="primary">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onResetAll}
            className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            Reset all
          </button>
          <button type="button" onClick={onSave}
            className="ml-auto rounded-md bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)]">
            Save theme
          </button>
          <button type="button" onClick={onCopyFigma} aria-label="Copy for Figma"
            className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium">
            Figma
          </button>
        </div>
      </PanelSection>
    </Panel>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd tools/color-studio-tc && npx tsc -p tsconfig.json --noEmit`
Expected: no errors in `Sidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add tools/color-studio-tc/src/components/Sidebar.tsx
git commit -m "feat(color-studio-tc): Sidebar assembled on Toolcraft Panel"
```

---

### Task 8: `Preview` (Segmented tab switch + imperative `renderPreview`)

**Files:**
- Create: `tools/color-studio-tc/src/components/Preview.tsx`

**Interfaces:**
- Consumes: `Segmented` from `@ui`; `renderPreview` from `../ui/preview.js`.
- Produces: `Preview` with props `{ state, mode, showContrast }` — same contract as the old one.

Tab state persists to `localStorage` under `cs-tc-preview-tab`. The imperative `renderPreview(state, mode, el, { showContrast, tab })` call is unchanged; only the tab UI switches from Base UI `Tabs` to Toolcraft `Segmented`.

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@ui";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

type PreviewTab = "ramps" | "playground";
const TAB_KEY = "cs-tc-preview-tab";

const TAB_OPTIONS = [
  { label: "Color ramps", value: "ramps" },
  { label: "Playground", value: "playground" },
] as const;

export function Preview({
  state, mode, showContrast,
}: {
  state: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PreviewTab>(
    () => (localStorage.getItem(TAB_KEY) as PreviewTab) || "ramps",
  );

  const onTab = (value: string) => {
    const next = value as PreviewTab;
    setTab(next);
    localStorage.setItem(TAB_KEY, next);
  };

  useEffect(() => {
    if (contentRef.current) {
      renderPreview(state, mode, contentRef.current, { showContrast, tab });
    }
  }, [state, mode, showContrast, tab]);

  return (
    <main id="preview" className={mode === "dark" ? "mode-dark" : "mode-light"}>
      <div className="pv-tabs">
        <h3 className="pv-title">Preview</h3>
        <div style={{ maxWidth: 280, marginTop: 10 }}>
          <Segmented name="Preview view" ariaLabel="Preview view"
            options={TAB_OPTIONS} value={tab} onValueChange={onTab} />
        </div>
      </div>
      <div ref={contentRef} id="pv-content" />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd tools/color-studio-tc && npx tsc -p tsconfig.json --noEmit`
Expected: no errors in `Preview.tsx`.

- [ ] **Step 3: Commit**

```bash
git add tools/color-studio-tc/src/components/Preview.tsx
git commit -m "feat(color-studio-tc): Preview with Toolcraft Segmented tabs"
```

---

### Task 9: `App` (state, rAF coalescing, save/copy, Sonner toasts, layout) — replace smoke test

**Files:**
- Modify: `tools/color-studio-tc/src/App.tsx` (replace the Task 1 smoke shell)
- Create: `tools/color-studio-tc/src/app.css` (2-column layout)
- Modify: `tools/color-studio-tc/src/styles.css` (add `@import "./app.css";`)

**Interfaces:**
- Consumes: `Toaster` from `@ui` and `toast` from `sonner`; `Sidebar` (Task 7), `Preview` (Task 8); `withDarkSurfaceFallback`, `serializeConfig`, `copyTokensForFigma`.
- Produces: default-exported `App`.

The state logic (rAF coalescing, `mode`, `showContrast`, save, copy, reset-all) is ported verbatim from the old `App.tsx`. Two changes: (1) light/dark toggles `document.documentElement.classList.toggle("dark", …)` (Toolcraft's variant) **in addition to** the preview's own `mode`; (2) toasts use Sonner instead of Base UI Toast.

- [ ] **Step 1: Write the 2-column layout CSS**

`tools/color-studio-tc/src/app.css`:

```css
#app {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
  overflow: hidden;
  gap: 0;
}
#app > .cs-panel-col {
  padding: 10px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--background);
}
#preview {
  min-width: 0;
  overflow-y: auto;
  padding: 28px 32px 48px;
}
```

Add `@import "./app.css";` to `src/styles.css` (after `@import "./preview.css";`).

- [ ] **Step 2: Implement `App.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@ui";
import { toast } from "sonner";
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Sidebar } from "./components/Sidebar.js";
import { Preview } from "./components/Preview.js";
import { serializeConfig } from "./serialize.js";
import { copyTokensForFigma } from "./export-figma.js";
import { withDarkSurfaceFallback } from "./lib/theme-state.js";

export default function App() {
  const baseline = useMemo(
    () => withDarkSurfaceFallback(structuredClone(themeInputs) as ThemeInputs),
    [],
  );
  const [state, setState] = useState<ThemeInputs>(() => structuredClone(baseline));
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [showContrast, setShowContrast] = useState(true);

  const frame = useRef(0);
  const pendingRef = useRef<ThemeInputs | null>(null);
  const [rafState, setRafState] = useState<ThemeInputs>(state);

  const update = (next: ThemeInputs) => {
    setState(next);
    pendingRef.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const latest = pendingRef.current!;
      pendingRef.current = null;
      setRafState(latest);
    });
  };

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("mode-dark", next === "dark");
  };

  const onSave = async () => {
    try {
      const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
      if (res.ok) toast.success("Saved ✓"); else toast.error("Save failed");
    } catch {
      toast.error("Save failed");
    }
  };

  const onCopyFigma = async () => {
    const ok = await copyTokensForFigma(state);
    if (ok) toast.success("Copied ✓"); else toast.error("Copy failed");
  };

  const onResetAll = () => update(structuredClone(baseline));

  return (
    <div id="app">
      <div className="cs-panel-col">
        <Sidebar
          state={state}
          baseline={baseline}
          mode={mode}
          showContrast={showContrast}
          onChange={update}
          onModeToggle={toggleMode}
          onShowContrastChange={setShowContrast}
          onSave={onSave}
          onCopyFigma={onCopyFigma}
          onResetAll={onResetAll}
        />
      </div>
      <Preview state={rafState} mode={mode} showContrast={showContrast} />
      <Toaster position="bottom-right" />
    </div>
  );
}
```

- [ ] **Step 3: Boot and verify the full app manually**

```bash
cd tools/color-studio-tc && npm run dev -- --port 5181 --strictPort
```

Expected (load http://localhost:5181): the studio renders — Panel on the left with all five sections + footer; preview on the right shows color ramps; dragging a slider or pasting a hex updates the ramps live; the Segmented control switches to Playground; the dark-preview toggle flips both the preview and the panel chrome; "Save theme" and "Figma" fire toasts.

- [ ] **Step 4: Commit**

```bash
git add tools/color-studio-tc/src/App.tsx tools/color-studio-tc/src/app.css tools/color-studio-tc/src/styles.css
git commit -m "feat(color-studio-tc): App state, Sonner toasts, 2-column layout"
```

---

### Task 10: Port e2e regression, verify parity, retire the old tool

**Files:**
- Create: `tools/color-studio-tc/e2e/slider.spec.ts`
- Modify: `package.json` (repo root) — repoint `preview:studio`
- Delete: `tools/color-studio` (after parity confirmed)

**Interfaces:**
- Consumes: the running app from Task 9.

- [ ] **Step 1: Port the slider-drag regression test**

`tools/color-studio-tc/e2e/slider.spec.ts` — copy from `tools/color-studio/e2e/slider.spec.ts`, but update the selector: Toolcraft's slider does not use `.thumb`/`.track-rail` classes. Target the first `role="slider"` in the Foundation section and assert its `aria-valuenow` (or `value`) changes when `End` is pressed.

```ts
import { test, expect } from "@playwright/test";

test("first slider reaches its max when End is pressed", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider").first();
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("End");
  await page.waitForTimeout(100);
  // The neutral Hue slider max is 360.
  await expect(slider).toHaveAttribute("aria-valuenow", "360");
});
```

> If the Toolcraft slider primitive does not expose `aria-valuenow` with that exact value, assert `aria-valuemax` equality instead by reading both attributes; adjust to the primitive's actual ARIA output observed while running.

- [ ] **Step 2: Run e2e (smoke + slider)**

```bash
cd tools/color-studio-tc && npm run test:e2e
```

Expected: both specs PASS.

- [ ] **Step 3: Run the full verification set**

```bash
cd tools/color-studio-tc && npm run test && npx tsc -p tsconfig.json --noEmit && npm run build
```

Expected: unit tests PASS, no type errors, production build succeeds.

- [ ] **Step 4: Confirm parity manually against the checklist, then retire the old tool**

Parity checklist (all must hold in `color-studio-tc`): live ramp updates; hex paste seeds ramp + pins brand; accent add/remove (1–3); status seeds; dark-surface sliders; alpha + contrast-badge toggles; per-section reset + reset-all; save writes `theme.config.ts`; copy-for-Figma; light/dark toggle; Playground tab.

Once confirmed:

```bash
cd /Users/tomoostewechel/Documents/GitHub/theme-generation-pipeline
git rm -r tools/color-studio
```

Repoint the root `package.json` `preview:studio` script:

```json
"preview:studio": "cd tools/color-studio-tc && npm run dev"
```

- [ ] **Step 5: Commit**

```bash
git add tools/color-studio-tc/e2e/slider.spec.ts package.json
git commit -m "feat(color-studio-tc): port e2e regression; retire tools/color-studio"
```

---

## Notes / Deferred

- **Gradient slider tracks + labeled ticks** (old `hueTrack`/`chromaTrack` + low/default/high labels) are dropped for v1 per the spec's Friction Point 1 — Toolcraft's `Slider` supports neither natively. Revisit as an enhancement (either a custom wrapper over the slider primitive, or contribute a track-background prop). `hueTrack`/`chromaTrack` stay exported from `controls-math` for that future work.
- **Copy-for-Figma icon:** v1 uses a text "Figma" button. The old brand `FigmaIcon` SVG can be reintroduced later; not required for parity of behavior.
- **`@base-ui/react` version:** pinned to `^1.4.1` (Toolcraft's). If a vendored component imports a subpath that version doesn't expose, align the version to whatever the throwaway scaffold resolved (check its lockfile).
- **Deviations from the spec's component-mapping table (intentional, scope-minimizing):**
  - *SeedControl* uses a **custom swatch + hex `<input>`** rather than Toolcraft's `Color` control. The `Color` control is a full picker popover whose single-value model doesn't fit this control's semantics (paste a hex → seed hue/chroma + pin the brand source; two sliders independently reshape the ramp). A plain hex field preserves the exact existing behavior with far less friction. The two ramp sliders still use Toolcraft's `Slider` (via `NumericControl`), as the spec intends.
  - *Preview* uses the `Segmented` **control** rather than the `Tabs` **composite** for the ramps/playground switch. Both ship in `@repo/ui`; `Segmented` is a simpler value/onChange fit for a two-option switch and needs no tab-panel plumbing. If richer tab semantics are wanted later, swap to `Tabs`.
