# Codebase Structure

**Analysis Date:** 2026-02-14

## Directory Layout

```
theme-generation-pipeline/
├── src/                           # Source code and token definitions
│   └── tokens/                    # Design token files
├── dist/                          # Generated output (build artifacts)
│   └── css/                       # Generated CSS tokens
├── scripts/                       # Build and automation scripts
├── .planning/                     # Planning and documentation
│   └── codebase/                  # Codebase analysis documents
├── .claude/                       # Claude Code workspace files
├── package.json                   # Node project metadata and scripts
├── CLAUDE.md                      # Project-specific Claude Code guidance
├── README.md                      # Project overview
└── node_modules/                  # Dependencies (generated)
```

## Directory Purposes

**src/tokens/:**
- Purpose: All design token definitions in DTCG format
- Contains: Token JSON files organized by collection and mode, manifest configuration
- Key files: `manifest.json` (orchestrates all token collections), `primitives-*.tokens.json` (base values), `*.light.tokens.json`, `*.dark.tokens.json` (mode variants), `*.{mode}.tokens.json` (alternative design variations)

**dist/:**
- Purpose: Build output directory containing generated platform-specific code
- Contains: Generated CSS files and potentially other format outputs
- Key files: CSS files matching input token collections

**dist/css/:**
- Purpose: Generated CSS custom properties (variables) from token definitions
- Contains: CSS files with `--variable-name: value;` declarations
- Generated: Yes (via `npm run build:tokens`)
- Committed: No (output artifact)

**scripts/:**
- Purpose: Build automation and token processing
- Contains: TypeScript/JavaScript scripts for token transformation
- Key files: `buildTokens.ts` (main build orchestrator, uses Style Dictionary v5)

**.planning/codebase/:**
- Purpose: Codebase analysis and architecture documentation
- Contains: Markdown documents describing architecture, structure, conventions, testing, concerns
- Generated: Yes (via GSD mapping process)
- Committed: Yes (reference materials)

**.claude/:**
- Purpose: Claude Code workspace configuration and context
- Contains: Workspace metadata and state files
- Generated: Yes (by Claude Code)
- Committed: No (IDE files)

## Key File Locations

**Entry Points:**
- `package.json`: Project configuration with `npm run build:tokens` command
- `src/tokens/manifest.json`: Token pipeline entry point defining all collections and modes

**Configuration:**
- `package.json`: Dependency management and script definitions
- `CLAUDE.md`: Project-specific guidance for Claude Code operations
- `.gitignore`: Git exclusion rules

**Token Definitions (Primary Content):**
- `src/tokens/primitives-color.mode-1.tokens.json`: Base color palette (170+ color tokens with sRGB values and alpha variants)
- `src/tokens/primitives-font.mode-1.tokens.json`: Typography primitives (font families, weights, sizes, line heights, letter spacing)
- `src/tokens/primitives-dimension.mode-1.tokens.json`: Spacing and sizing scales (space, size dimensions)
- `src/tokens/primitives-radius.mode-1.tokens.json`: Border radius scale and modifiers
- `src/tokens/color.light.tokens.json`: Semantic color tokens for light mode
- `src/tokens/color.dark.tokens.json`: Semantic color tokens for dark mode
- `src/tokens/typography.mode-1.tokens.json`: Composite typography tokens (display, heading, body styles)
- `src/tokens/dimension.mode-1.tokens.json`: Semantic dimension tokens (spacing-layout, spacing-component, sizing-*)
- `src/tokens/radius.{sharp|default|rounded|pill}.tokens.json`: Border radius variations per mode
- `src/tokens/effects.styles.tokens.json`: Effect/style tokens (if present)
- `src/tokens/typography.styles.tokens.json`: Typography style tokens (if present)

**Build Output:**
- `dist/css/`: Generated CSS files (created during build, one per collection/mode pair)

## Naming Conventions

**Files:**
- Token files: `{collection}.{mode}.tokens.json` (e.g., `color.light.tokens.json`, `primitives-color.mode-1.tokens.json`)
- Manifest: `manifest.json`
- Build output: Mode-specific CSS files (e.g., `color.light.css`, `color.dark.css`)

**Directories:**
- Source tokens: `src/tokens/`
- Build output: `dist/css/`
- Scripts: `scripts/`

**Token Names (in JSON):**
- Primitives: `{category}-{scale}` (e.g., `color-neutral-500`, `font-size-1300`, `space-4`)
- Semantic tokens: `{category}-{context}-{variant}` (e.g., `color-background-surface-default`, `color-text-emphasis`, `spacing-component-gap-md`)
- Composite sub-tokens: `{group}-{style}-{property}` (e.g., `typography-display-large-font-family`, `typography-display-large-font-weight`)

## Where to Add New Code

**New Token Collection:**
1. Create token files in `src/tokens/` following naming convention: `{collection-name}.{mode}.tokens.json`
2. Add collection definition to `src/tokens/manifest.json` under `collections` key with appropriate modes
3. Reference primitive tokens or define new ones as needed
4. Build with `npm run build:tokens` to generate output

**New Primitive Token:**
- Add to appropriate `primitives-{category}.mode-1.tokens.json` file
- Use category-scale naming: `{category}-{scale}`
- Ensure `$type` (color, dimension, fontFamily, fontWeight) is correct
- Use sRGB format for colors (colorSpace, components array, optional alpha)
- Use `{value, unit}` format for dimensions

**New Semantic Token:**
- Create in corresponding semantic collection file (e.g., `color.light.tokens.json`)
- Reference primitives using curly brace syntax: `"{primitive-token-name}"`
- Use category-context-variant naming
- Include in both light and dark variants if applicable

**New Mode:**
- Add mode file following naming: `{collection}.{mode-name}.tokens.json`
- Update `src/tokens/manifest.json` under collection's `modes` section
- Include mode in build by declaring in manifest

**Build Script Enhancement:**
- Modify or extend `scripts/buildTokens.ts`
- Uses Style Dictionary v5 API and style-dictionary-utils
- Register custom formats or transformers as needed
- Ensure output destination is `dist/` directory

## Special Directories

**dist/:**
- Purpose: Build output artifacts
- Generated: Yes (from `npm run build:tokens`)
- Committed: No (add to `.gitignore` if not already present)

**node_modules/:**
- Purpose: NPM dependency storage
- Generated: Yes (from `npm install`)
- Committed: No (excluded via `.gitignore`)

**.git/:**
- Purpose: Git version control metadata
- Generated: Yes (from `git init`)
- Committed: No (version control system files)

**.planning/codebase/:**
- Purpose: GSD codebase analysis documentation
- Generated: Yes (from `/gsd:map-codebase` command)
- Committed: Yes (reference material for future work)

---

*Structure analysis: 2026-02-14*
