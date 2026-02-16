---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/tokens/primitives-radius.mode-1.tokens.json
  - src/tokens/radius.sharp.tokens.json
  - src/tokens/radius.default.tokens.json
  - src/tokens/radius.rounded.tokens.json
  - src/tokens/radius.pill.tokens.json
  - src/tokens/color.light.tokens.json
  - src/tokens/color.dark.tokens.json
autonomous: true
must_haves:
  truths:
    - "Radius scale tokens (xs/sm/md/lg/xl) output as unitless numbers in CSS"
    - "Radius intensity tokens output as unitless numbers in all radius mode selectors"
    - "Color state tokens (disabled-opacity, hover-intensity, active-intensity) output as unitless numbers"
    - "All other dimension tokens still output with rem units"
  artifacts:
    - path: "dist/css/tokens.css"
      provides: "Correct CSS variable output"
      contains: "--radius-scale-xs: 0.25;"
    - path: "src/tokens/primitives-radius.mode-1.tokens.json"
      provides: "DTCG-compliant unitless markers"
      contains: "$description"
  key_links:
    - from: "token files ($description property)"
      to: "scripts/buildTokens.ts (line 26 filter)"
      via: "$description === 'unitless' match"
      pattern: "\\$description.*unitless"
---

<objective>
Fix the `dimension/unitless` custom transform so tokens marked as unitless output raw numbers instead of rem values.

Purpose: The transform filter checks `token.$description === "unitless"` but token source files use `"description"` (without `$` prefix). Additionally, three color-state tokens that should be unitless are missing the marker entirely.

Output: Corrected token source files using DTCG-compliant `$description` property, and correct unitless CSS output after rebuild.
</objective>

<execution_context>
@/Users/tomoostewechel/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tomoostewechel/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@scripts/buildTokens.ts
@src/tokens/primitives-radius.mode-1.tokens.json
@src/tokens/radius.sharp.tokens.json
@src/tokens/color.light.tokens.json
@src/tokens/color.dark.tokens.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix $description property in radius token files and add unitless markers to color-state tokens</name>
  <files>
    src/tokens/primitives-radius.mode-1.tokens.json
    src/tokens/radius.sharp.tokens.json
    src/tokens/radius.default.tokens.json
    src/tokens/radius.rounded.tokens.json
    src/tokens/radius.pill.tokens.json
    src/tokens/color.light.tokens.json
    src/tokens/color.dark.tokens.json
  </files>
  <action>
    Bug 1 - Rename `"description"` to `"$description"` in these files:
    - `primitives-radius.mode-1.tokens.json`: Change `"description": "unitless"` to `"$description": "unitless"` on the 5 radius-scale tokens (xs, sm, md, lg, xl)
    - `radius.sharp.tokens.json`: Change `"description"` to `"$description"` on radius-intensity
    - `radius.default.tokens.json`: Same change on radius-intensity
    - `radius.rounded.tokens.json`: Same change on radius-intensity
    - `radius.pill.tokens.json`: Same change on radius-intensity

    Bug 2 - Add missing `"$description": "unitless"` property to these 3 tokens in BOTH `color.light.tokens.json` and `color.dark.tokens.json`:
    - `color-state-disabled-opacity`
    - `color-state-hover-intensity`
    - `color-state-active-intensity`

    Add `"$description": "unitless"` as a sibling to the existing `"$type"` property in each token object.

    Do NOT modify `scripts/buildTokens.ts` -- the transform code is correct, only the source data was wrong.
  </action>
  <verify>
    Run `npm run build:tokens` and verify:
    1. `--radius-scale-xs: 0.25;` (not `0.015625rem`)
    2. `--radius-scale-md: 1;` (not `0.0625rem`)
    3. `--radius-intensity: 0;` in sharp mode (not `0rem`)
    4. `--radius-intensity: 1;` in default mode (not `0.0625rem`)
    5. `--color-state-disabled-opacity: 0.5;` (not `0.03125rem`)
    6. `--color-state-hover-intensity: 0.9200000166893005;` (not `0.057500001043081284rem`)
    7. Other dimension tokens like `--dimension-*` still have rem units
  </verify>
  <done>
    All unitless-marked dimension tokens output as raw numbers without units. All non-unitless dimension tokens still output with rem units. Build completes without errors.
  </done>
</task>

</tasks>

<verification>
- `npm run build:tokens` completes successfully
- `grep "radius-scale-xs" dist/css/tokens.css` shows `0.25;` not `rem`
- `grep "color-state-disabled-opacity" dist/css/tokens.css` shows `0.5;` not `rem`
- `grep "radius-intensity" dist/css/tokens.css` shows raw numbers in all 4 radius mode selectors
- Non-unitless dimension tokens (e.g., radius-unit, radius-none, radius-cap-*) still have rem units
</verification>

<success_criteria>
All 13 unitless tokens (5 radius-scale + 4 radius-intensity + 3 color-state x2 light/dark) output as raw numbers without units in dist/css/tokens.css.
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-dimension-unitless-transform-use-dtc/2-SUMMARY.md`
</output>
