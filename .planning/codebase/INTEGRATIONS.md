# External Integrations

**Analysis Date:** 2026-02-14

## APIs & External Services

**Design Token Generation:**
- Style Dictionary - Design token transformation engine
  - SDK: `style-dictionary` npm package
  - Usage: Core token build pipeline
  - No authentication required

- style-dictionary-utils - Token utilities and format generators
  - SDK: `style-dictionary-utils` npm package
  - Usage: Pre-built filters, transformers, and output formats
  - No authentication required

## Data Storage

**Databases:**
- Not applicable - This is a static token generation tool

**File Storage:**
- Local filesystem only
  - Input: `src/tokens/` directory
  - Output: `dist/css/` directory (generated)
  - Token format: JSON files (DTCG format)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Not applicable - Purely a local CLI build tool

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console output only (via npm scripts)
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Not applicable - This is a build tool, not a deployed service

**CI Pipeline:**
- Not detected - No CI configuration found (.github/, .gitlab-ci.yml, .circleci, etc.)

**Package Distribution:**
- NPM (consumed as dev dependency)

## Environment Configuration

**Required env vars:**
- None detected - This tool requires no environment variables

**Secrets location:**
- Not applicable - No external credentials needed

## Webhooks & Callbacks

**Incoming:**
- None - Not a service

**Outgoing:**
- None - Local execution only

## Input/Output Specifications

**Token Input:**
- Format: W3C Design Tokens Community Group (DTCG) JSON
- Location: `src/tokens/*.tokens.json` and `src/tokens/manifest.json`
- Manifest: Defines token collections and modes
  - Collections: primitives-color, color, primitives-font, typography, primitives-dimension, dimension, primitives-radius, radius
  - Modes: light/dark (for color), mode-1 (for primitives), sharp/default/rounded/pill (for radius)

**Token Output Formats:**
Via style-dictionary-utils:
- CSS (css/advanced) - Platform target for web
- JavaScript/ESM (javascript/esm) - CommonJS module format
- TypeScript/ESM Declarations (typescript/esm-declarations) - TypeScript type definitions
- JavaScript/CommonJS (javascript/commonjs) - CommonJS module format

## Data Flow

**Token Processing Pipeline:**
1. Read token definitions from `src/tokens/` (JSON files in DTCG format)
2. Load manifest (`src/tokens/manifest.json`) defining collections and modes
3. Style Dictionary processes tokens through:
   - Filters (select specific token categories: colors, typography, dimensions, shadows, etc.)
   - Transformers (convert token values to platform-specific format)
   - Formatters (output to target language/format)
4. Write processed tokens to `dist/css/` (default output location)

**Token Resolution:**
- Token references use curly brace syntax: `{token-name}`
- References are resolved during build process
- Primitive tokens are base values (e.g., color-neutral-500, font-size-1300)
- Semantic tokens reference primitives (e.g., color-background-surface-default)

---

*Integration audit: 2026-02-14*
