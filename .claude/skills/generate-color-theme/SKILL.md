---
name: generate-color-theme
description: Generate a color theme from structured inputs (brand hex(es), contrast, neutral tint) using this repo's color engine, then write repo tokens/CSS and/or update the Figma primitives-color variables in place via the Figma MCP. Use when the user wants to retheme, rebrand, or push generated primitive color variables into Figma without the studio UI.
---

# Generate Color Theme

Drives `scripts/generateTheme.ts` (the color engine) from structured inputs and, optionally, writes the generated `primitives-color` variables into a Figma file in place via the official Figma MCP. `theme.config.ts` is the single source of truth; unspecified fields default from it.

## Inputs (structured only — never infer from vibes)

Collect from the user:
- **Brand hex(es):** one per accent slot (`primary`, optional `secondary`, `tertiary`). Each hex becomes both an accent seed (hue + chroma) and a verbatim `brand` color.
- **Contrast:** a number in `[0,1]` or one of `low` | `default` | `high`.
- **Neutral tint (optional):** `{ hue, chroma }` for the gray.
- **Status seeds / dark-surface dials / alpha (optional):** default from `theme.config.ts` if omitted.

Build a **partial** `ThemeInputs` JSON. To turn a brand hex into the two fields, use the engine helpers (run once via `npx tsx -e`), do NOT eyeball values:

```bash
npx tsx -e 'import{hexToHueSeed,hexToOklch}from"./src/engine/index.js";const h=process.argv[1];console.log(JSON.stringify({seed:hexToHueSeed(h),brand:hexToOklch(h)}))' "#16a34a"
```

Assemble e.g.:
```json
{ "accents": { "primary": { "hue": 149.2, "chroma": 0.17 } },
  "brand": { "primary": { "l": 0.627, "c": 0.17, "h": 149.2 } },
  "contrast": "default" }
```

## Step 1 — Confirm the resolved inputs

Run this to print the resolved inputs:

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-resolved
```
Show the COMPLETE resolved `ThemeInputs` (including every defaulted field) to the user and wait for approval before writing anything. If validation fails, the CLI prints the errors to stderr and exits 1 — fix the inputs and retry.

## Step 2 — Repo path (if the user wants tokens/CSS)

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --write-config --build
npm run build:tokens   # optional: regenerate dist/css
```
Report the changed files. Do not commit unless asked.

## Step 3 — Figma path (if the user wants variables updated)

**MANDATORY:** load the `figma-use` skill BEFORE any `use_figma` call, and adapt the API calls below to whatever the current Plugin API in that skill specifies.

First emit the plan and keep it:
```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-figma-plan > /tmp/figma-plan.json
```

### 3a. PREVIEW (read-only) — via `use_figma`

Inject the plan JSON as `PLAN` and run this **read-only** script; show the returned summary to the user and get confirmation. It writes nothing.

```js
const PLAN = /* paste the FigmaVariablePlan JSON */;
const norm = (n) => n.toLowerCase().replace(/[\s/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const collection = collections.find((c) => c.name === PLAN.collection);
let existingKeys = new Set();
if (collection) {
  const vars = await figma.variables.getLocalVariablesAsync("COLOR");
  existingKeys = new Set(
    vars.filter((v) => v.variableCollectionId === collection.id).map((v) => norm(v.name)),
  );
}
const willCreate = PLAN.variables.filter((e) => !existingKeys.has(e.tokenKey)).map((e) => e.tokenKey);
const willUpdate = PLAN.variables.filter((e) => existingKeys.has(e.tokenKey)).length;
return {
  collectionExists: Boolean(collection),
  update: willUpdate,
  create: willCreate.length,
  wouldCreateNew: willCreate,
};
```

Surface `wouldCreateNew` prominently: any entry there means the variable was NOT matched (likely a Figma-side rename) and will be created fresh rather than updated. Only proceed on explicit approval.

### 3b. APPLY (writes) — via `use_figma`

```js
const PLAN = /* paste the FigmaVariablePlan JSON */;
const norm = (n) => n.toLowerCase().replace(/[\s/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
let collections = await figma.variables.getLocalVariableCollectionsAsync();
let collection = collections.find((c) => c.name === PLAN.collection);
if (!collection) collection = figma.variables.createVariableCollection(PLAN.collection);
const mode = collection.modes.find((m) => m.name === "mode-1") ?? collection.modes[0];
const modeId = mode.modeId;

const allVars = await figma.variables.getLocalVariablesAsync("COLOR");
const byKey = new Map(
  allVars.filter((v) => v.variableCollectionId === collection.id).map((v) => [norm(v.name), v]),
);

let updated = 0, created = 0;
for (const entry of PLAN.variables) {
  let v = byKey.get(entry.tokenKey);
  if (!v) { v = figma.variables.createVariable(entry.tokenKey, collection, "COLOR"); created++; }
  else { updated++; }
  const { r, g, b, a } = entry.valuesByMode["mode-1"];
  v.setValueForMode(modeId, { r, g, b, a });
}
return { updated, created }; // never prunes; semantic `color` collection untouched
```

Report `{ updated, created }` back to the user.

## Guarantees & non-goals
- Writes **only** `primitives-color`; the semantic `color` collection is Figma-owned and never touched.
- **Never prunes** variables absent from the plan.
- OKLCH→sRGB is done in the engine; this skill's Figma scripts carry no color library.
- No natural-language inference; no implicit git commits.
