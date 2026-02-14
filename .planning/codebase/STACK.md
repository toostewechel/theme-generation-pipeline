# Technology Stack

**Analysis Date:** 2026-02-14

## Languages

**Primary:**
- TypeScript - Used for build scripts and configuration (planned implementation via `scripts/buildTokens.ts`)
- JSON - Token definition format and configuration

**Secondary:**
- JavaScript - esbuild and toolchain binaries

## Runtime

**Environment:**
- Node.js v24.7.0 or compatible (minimum: v18.0.0 per tsx requirements; style-dictionary requires v22.0.0+)

**Package Manager:**
- npm v11.8.0
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- Style Dictionary v5.2.0 - Design token transformation and build system
  - Converts design tokens into platform-specific code outputs
  - Supports custom transforms, filters, and formats
  - ES modules-based

**Utilities:**
- style-dictionary-utils v6.0.1 - Pre-built filters, transformers, and formats for Style Dictionary
  - W3C Design Tokens Community Group (DTCG) format support
  - Includes CSS, JavaScript/TypeScript output formats
  - Transforms: color/css, typography/css, dimension/css, shadow/css, etc.

**Build/Dev:**
- tsx v4.21.0 - TypeScript execution runner (Node.js ESM TypeScript runner)
  - Allows running `.ts` files directly without compilation step
  - Used to execute `scripts/buildTokens.ts`

**Type Definitions:**
- @types/node v25.0.10 - TypeScript definitions for Node.js APIs

## Key Dependencies

**Critical:**
- style-dictionary v5.2.0 - Core engine for token transformation
  - Provides platform/configuration system
  - Manages token input/output pipeline
  - Requires Node.js v22.0.0+

- style-dictionary-utils v6.0.1 - Essential utilities for token processing
  - Pre-built format implementations (css/advanced, javascript/esm, typescript/esm-declarations, javascript/commonJs)
  - Pre-built transformers (name transformations, color/typography/dimension/shadow transforms)
  - Pre-built filters (isSource, isColor, isGradient, isTypography, isShadow, etc.)

**Build Tooling:**
- tsx v4.21.0 - Direct TypeScript execution without build step
  - Eliminates need for tsc or build preprocessing
  - Supports Node.js ESM modules

**Development:**
- esbuild v0.27.2 - Fast JavaScript bundler (as transitive dependency)
  - Used internally by tsx for TypeScript transpilation

## Configuration

**Environment:**
- No environment variables required for basic operation
- Token collections defined in `src/tokens/manifest.json`

**Build:**
- ESM module type: `"type": "module"` in `package.json`
- Build command: `npm run build:tokens`
- Script: `npx tsx scripts/buildTokens.ts` (file not yet created)

## Platform Requirements

**Development:**
- Node.js v22.0.0 or higher (due to style-dictionary requirement)
- npm v8.0.0 or higher

**Production:**
- Node.js v22.0.0+
- Runs as CLI tool via npm scripts
- No server runtime required

## Entry Points

**Build Script:**
- Location: `scripts/buildTokens.ts` (planned)
- Invoked via: `npm run build:tokens`
- Output: CSS tokens to `dist/css/` (as per CLAUDE.md)

**Token Source:**
- Location: `src/tokens/` - Contains token definitions and manifest
- Format: DTCG JSON with Style Dictionary manifest configuration

---

*Stack analysis: 2026-02-14*
