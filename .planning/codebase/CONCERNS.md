# Codebase Concerns

**Analysis Date:** 2026-02-14

## Tech Debt

**Missing Build Script Implementation:**
- Issue: `package.json` references `npm run build:tokens` which executes `npx tsx scripts/buildTokens.ts`, but this file does not exist in the repository
- Files: `package.json` (line 4), `scripts/buildTokens.ts` (missing)
- Impact: Build process cannot execute. The entire pipeline is non-functional without this critical script
- Fix approach: Implement `buildTokens.ts` to use Style Dictionary v5 and style-dictionary-utils to read from `src/tokens/manifest.json` and generate CSS output to `dist/css/`

**Incomplete Token Reference System:**
- Issue: Color tokens in `color.dark.tokens.json` reference `color-neutral-dark-surface-*` tokens that are defined in primitives but never used in `color.light.tokens.json`, creating an asymmetry between modes
- Files: `src/tokens/color.dark.tokens.json`, `src/tokens/color.light.tokens.json`, `src/tokens/primitives-color.mode-1.tokens.json`
- Impact: Dark mode uses different semantic structure than light mode, making future maintenance of token transformations difficult
- Fix approach: Align both light and dark modes to use consistent semantic token structure, or document why this asymmetry is intentional

**Unused Dark Neutral Surface Tokens:**
- Issue: `primitives-color.mode-1.tokens.json` defines `color-neutral-dark-surface-5` which is never referenced in `color.dark.tokens.json`
- Files: `src/tokens/primitives-color.mode-1.tokens.json`, `src/tokens/color.dark.tokens.json`
- Impact: Unused token creates confusion about token set completeness and may cause maintenance issues when scaling the system
- Fix approach: Remove the unused token or add corresponding semantic token that uses it

## Data Consistency Issues

**Typo in Token Name:**
- Issue: `color-white-alpha-transparant` is misspelled (should be `transparent` not `transparant`)
- Files: `src/tokens/primitives-color.mode-1.tokens.json` (token definition), `src/tokens/color.light.tokens.json` (line 237), `src/tokens/color.dark.tokens.json` (line 237)
- Current Impact: Propagates to any generated CSS output; inconsistent with standard spelling conventions
- Fix approach: Rename token to `color-white-alpha-transparent` and update all references

**Inconsistent Color References Between Modes:**
- Issue: Light mode uses `color-brand-200` and `color-brand-700` but dark mode uses `color-brand-400` and `color-brand-800` for marker and text-brand tokens respectively
- Files: `src/tokens/color.light.tokens.json` (lines 32, 56), `src/tokens/color.dark.tokens.json` (lines 32, 56)
- Impact: May result in poor contrast ratios or accessibility issues if not intentional; makes token semantics unclear
- Fix approach: Document the contrast ratio justification for these choices, or align to consistent scale positions

## Testing Gaps

**No Token Validation:**
- Issue: No validation mechanism exists to verify that all token references in semantic files actually exist in primitive files
- Files: All `src/tokens/*.json` files
- Risk: Dangling references will only be discovered during build time or in generated output, potentially breaking downstream systems
- Priority: High - This directly blocks the build pipeline

**No Cross-Mode Consistency Validation:**
- Issue: No mechanism to ensure that light and dark modes have consistent semantic token definitions
- Files: `src/tokens/color.light.tokens.json`, `src/tokens/color.dark.tokens.json`
- Risk: Inconsistent mode definitions may result in missing tokens in generated output
- Priority: High - Essential for multi-mode design systems

## Scaling Concerns

**Radius Token Design Issue:**
- Issue: `radius.sharp.tokens.json` sets `radius-intensity` to 0, `radius.default.tokens.json` to 1, and `radius.pill.tokens.json` to 9999, but the `primitives-radius.mode-1.tokens.json` defines `radius-unit` (4px) and other radii that are never composed with intensity
- Files: `src/tokens/primitives-radius.mode-1.tokens.json`, `src/tokens/radius.*.tokens.json`
- Impact: The intensity pattern is incomplete - the mode files don't actually compute composite radii using the intensity multiplier; semantic radius tokens are missing
- Fix approach: Either implement a Style Dictionary transformer to compute radii from intensity + scale, or add explicit semantic radius tokens to each mode file

**No Generated Output Directory Structure:**
- Issue: The build process is designed to output to `dist/css/` but this directory is not part of the repository and no `.gitkeep` or documentation exists for its expected structure
- Files: `package.json`, missing `dist/` directory
- Impact: Unclear what output formats and file organization the pipeline should produce
- Fix approach: Document expected output structure and commit a `.gitkeep` or README in `dist/` to define the schema

## Manifest Configuration Concerns

**Incomplete Manifest Coverage:**
- Issue: `manifest.json` defines a `styles` section for typography but no corresponding build outputs are documented
- Files: `src/tokens/manifest.json` (lines 73-77)
- Impact: The typography styles section exists but its purpose and output target are undefined
- Fix approach: Document in CLAUDE.md what typography styles should generate

## Missing Critical Documentation

**Build Pipeline Undefined:**
- Issue: CLAUDE.md documents token architecture but provides no details on what the `buildTokens.ts` script should do, what output formats to generate, or how Style Dictionary should be configured
- Files: `CLAUDE.md`, `scripts/buildTokens.ts` (missing)
- Impact: Without implementation details, any future developer cannot correctly build the script
- Fix approach: Add detailed specification to CLAUDE.md describing:
  - Input: manifest.json structure and token file format
  - Processing: Style Dictionary configuration and custom transformers needed
  - Output: Expected file structure, formats (CSS, JSON, etc.), and naming conventions

**No Token Reference Documentation:**
- Issue: Tokens use curly brace reference syntax `{token-name}` but there is no mechanism to validate or document which tokens reference which other tokens
- Files: All semantic token files
- Impact: Dependency graph is implicit and invisible, making refactoring dangerous
- Fix approach: Generate dependency documentation or add linting to validate token references during build

## Environment and Dependency Concerns

**No Node Version Specification:**
- Issue: No `.nvmrc`, `engines` field in `package.json`, or documented Node.js version requirements
- Files: `package.json`
- Impact: Developers may use incompatible Node versions, causing build failures due to ES module or dependency issues
- Fix approach: Add Node version constraint to package.json and `.nvmrc`

**Minimal Dependency Documentation:**
- Issue: Only three dependencies (style-dictionary, style-dictionary-utils, tsx) are specified with minimal context on why each is needed or what versions are compatible
- Files: `package.json`
- Impact: Developers upgrading dependencies may not know what breaking changes to expect
- Fix approach: Add comments in package.json or separate documentation explaining purpose of each dependency

---

*Concerns audit: 2026-02-14*
