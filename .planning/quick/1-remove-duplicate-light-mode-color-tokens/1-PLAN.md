---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/buildTokens.ts
  - dist/css/tokens.css
autonomous: true
must_haves:
  truths:
    - "Light mode semantic color tokens appear only once in tokens.css (inside :root)"
    - "No [data-color-mode='light'] selector block exists in tokens.css"
    - "Dark mode [data-color-mode='dark'] override still works correctly"
    - "All other token blocks (radius modes, base tokens) are unchanged"
  artifacts:
    - path: "scripts/buildTokens.ts"
      provides: "Build script without light mode duplicate build"
    - path: "dist/css/tokens.css"
      provides: "DRY CSS output with no duplicated light mode block"
  key_links:
    - from: "scripts/buildTokens.ts"
      to: "dist/css/tokens.css"
      via: "npm run build:tokens"
      pattern: "buildTokens"
---

<objective>
Remove duplicate light mode color tokens from CSS output by eliminating Build 2 in the build script.

Purpose: The `:root` selector already includes all light mode semantic color tokens (lines 188-251 in tokens.css). Build 2 outputs the exact same tokens under `[data-color-mode='light']` (lines 253+), creating unnecessary duplication. Removing Build 2 makes the output DRY while preserving correct cascade behavior.

Output: Updated `scripts/buildTokens.ts` and rebuilt `dist/css/tokens.css` without the duplicate `[data-color-mode='light']` block.
</objective>

<execution_context>
@/Users/tomoostewechel/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tomoostewechel/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@scripts/buildTokens.ts
@dist/css/tokens.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Build 2 (light mode duplicate) from build script</name>
  <files>scripts/buildTokens.ts</files>
  <action>
    Remove the entire "Build 2: [data-color-mode='light']" block (lines 166-198 in buildTokens.ts). This includes:
    - The `if (colorModes["light"])` block that creates `sdLight` StyleDictionary instance
    - The `_temp_light.css` file generation, reading, and concatenation
    - The `tempFiles.push("dist/css/_temp_light.css")` line

    Update the comment on Build 1 (line 130) to clarify it serves as both :root defaults AND light mode:
    Change: `// Build 1: :root with base tokens + light color + default radius`
    To: `// Build 1: :root with base tokens + light color (serves as default/light mode) + default radius`

    Update the Build 3 comment numbering is fine as-is since comments reference purpose not number. But update the console log count if there is one (the script logs "Building multi-mode CSS" but does not log build count, so no change needed there).

    Do NOT modify any other builds (dark mode, radius modes). The structure of Builds 3-7 remains identical.
  </action>
  <verify>Run `npx tsx scripts/buildTokens.ts` and confirm it completes without errors. The output file `dist/css/tokens.css` should exist.</verify>
  <done>Build script no longer contains the light mode duplicate build block. Script executes successfully.</done>
</task>

<task type="auto">
  <name>Task 2: Verify rebuilt CSS output is correct</name>
  <files>dist/css/tokens.css</files>
  <action>
    After the build from Task 1, verify the rebuilt `dist/css/tokens.css`:

    1. Confirm NO `[data-color-mode='light']` selector exists in the output
    2. Confirm `:root` block still contains all semantic color tokens (e.g., `--color-background-surface-default`, `--color-text-emphasis`, `--color-action-primary-background`)
    3. Confirm `[data-color-mode='dark']` block still exists with dark mode overrides
    4. Confirm all `[data-radius-mode='...']` blocks still exist (sharp, default, rounded, pill)
    5. Confirm the file is shorter than before (the duplicate block of ~64 lines is gone)

    If any check fails, investigate and fix the build script.
  </action>
  <verify>
    Run these checks:
    - `grep -c "data-color-mode='light'" dist/css/tokens.css` should return 0
    - `grep -c "data-color-mode='dark'" dist/css/tokens.css` should return 1
    - `grep -c "data-radius-mode" dist/css/tokens.css` should return 4
    - `grep -c "color-background-surface-default" dist/css/tokens.css` should return 2 (once in :root, once in dark mode)
  </verify>
  <done>CSS output contains no `[data-color-mode='light']` block. All light mode tokens appear exactly once in `:root`. Dark mode and radius mode blocks are intact.</done>
</task>

</tasks>

<verification>
- `npm run build:tokens` completes without errors
- `dist/css/tokens.css` has no `[data-color-mode='light']` selector
- `:root` contains all semantic color tokens
- `[data-color-mode='dark']` override block is present
- All four radius mode blocks are present
- File is ~64 lines shorter than before
</verification>

<success_criteria>
The CSS output is DRY: light mode semantic color tokens exist only in `:root`, not duplicated under `[data-color-mode='light']`. All other mode blocks (dark, radius variants) are unchanged. Build completes successfully.
</success_criteria>

<output>
After completion, create `.planning/quick/1-remove-duplicate-light-mode-color-tokens/1-SUMMARY.md`
</output>
