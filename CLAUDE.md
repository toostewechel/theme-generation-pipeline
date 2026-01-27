# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a design token transformation pipeline that converts design tokens into platform-specific code outputs using Style Dictionary v5 and style-dictionary-utils.

## Commands

```bash
npm install              # Install dependencies
npm run build:tokens     # Build CSS tokens to dist/css/
```

## Token Architecture

### Token Format
Tokens use the DTCG (Design Tokens Community Group) format with `$type` and `$value` properties. Token references use curly brace syntax: `{token-name}`.

### Token Organization (src/tokens/)

**Manifest Structure** (`manifest.json`):
- Defines collections and their modes
- Each collection can have multiple mode files

**Collections**:
- `primitives-color`: Base color palette (neutral, brand, semantic colors like green/amber/red/blue, alpha variants)
- `color`: Semantic color tokens with `light` and `dark` modes that reference primitives
- `primitives-font`: Base typography values
- `typography`: Composite typography tokens referencing font primitives
- `primitives-dimension`: Base spacing/sizing values
- `dimension`: Semantic dimension tokens
- `primitives-radius` / `radius`: Border radius with modes: sharp, default, rounded, pill

### Token Naming Conventions
- Primitives: `{category}-{scale}` (e.g., `color-neutral-500`, `font-size-1300`)
- Semantic: `{category}-{context}-{variant}` (e.g., `color-background-surface-default`, `color-text-emphasis`)

### Color Value Format
Primitive colors use sRGB colorSpace with normalized component arrays (0-1 range), optionally with alpha.
