---
name: generate-design-md
description: Snapshot the repo's current design tokens into a minimal design.md presentation theme (google-labs-code/design.md format, consumed by the frontend-slides plugin), then author the prose sections grounded in the resolved values. Use when the user wants a presentation/slide theme, a design.md file, or a per-client theme snapshot from the tokens in src/tokens/.
---

# Generate design.md

Drives `scripts/generateDesignMd.ts`, which condenses `src/tokens/` into the fixed minimal slot set of a design.md file (front matter), then has you author the human-readable prose sections (body). The CLI owns the YAML front matter; you own the markdown body — re-running the CLI refreshes values without touching prose.

The token→slot mapping is fixed in `src/designmd/mapping.ts`. If the tokens don't reflect the intended client yet, retheme first (see the `generate-color-theme` skill), then run this.

## Inputs

Collect from the user:
- **Theme name** (required) — e.g. the client name. Becomes `name:` in the front matter and the filename slug.
- **Color mode:** `light` (default) or `dark`. One design.md per mode; dark writes `themes/<slug>.dark.design.md`.
- **Radius mode:** `small` | `medium` (default) | `large` | `full`.

## Step 1 — Confirm the resolved slots (read-only)

```bash
npx tsx scripts/generateDesignMd.ts --name "<Theme Name>" --mode light --radius medium --emit-context
```

This prints the full `DesignMdData` JSON including `provenance` (slot → source token → terminal primitive → resolved value) and writes nothing. Show the user a compact summary of the resolved slots (hexes, font families/sizes, rounded/spacing scales) and wait for approval. If a token is missing or a ref dangles, the CLI exits 1 with the ref chain — that usually means the mapping in `src/designmd/mapping.ts` drifted from a token rename; fix the mapping, don't hand-edit output.

## Step 2 — Write the file

```bash
npx tsx scripts/generateDesignMd.ts --name "<Theme Name>" --mode light --radius medium
```

- File absent → creates `themes/<slug>.design.md` with front matter + skeleton body.
- File present → replaces only the front matter block; the body is preserved byte-for-byte.
- `--force` → also resets the body to the skeleton (destroys authored prose; confirm with the user first).
- `--out <path>` overrides the destination.

Report created vs. refreshed.

## Step 3 — Author the prose body

Fill the skeleton sections **in this order** (the design.md canonical order): `## Overview`, `## Colors`, `## Typography`, `## Layout`, `## Shapes`. Optionally append `## Do's and Don'ts`.

Rules:
- Ground EVERY claim in the `--emit-context` output: actual hex values, actual font family names, actual sizes. Never invent values, never contradict the front matter.
- Overview: 2-4 sentences capturing the theme's personality as evidenced by the palette and type (e.g. serif display + saturated green accent → what mood is that?). Write for a slide-deck generator that will follow it literally.
- Colors: one bullet per front-matter color with its hex and its ROLE on slides (headline ink, canvas, sole accent, borders, text on accent, ...). Use the provenance chain to explain intent when helpful.
- Typography: the hierarchy (h1/h2/h3 vs body vs label), which family carries display vs body duty, and how weight/letter-spacing behave.
- Layout: how the spacing scale (xs–xl) should govern slide padding, stacks, and gaps.
- Shapes: how the rounded scale should apply to cards, images, chips.
- Keep it tight — this file is loaded into a slide generator's context; aim well under 150 lines total.
- Do not edit the YAML front matter by hand. To change values, change tokens (or the mapping) and re-run the CLI.

## Guarantees & non-goals

- Reads `src/tokens/` only; never writes tokens, `theme.config.ts`, or Figma.
- Front matter is CLI-owned and deterministic; body is skill/hand-owned and preserved across re-runs (unless `--force`).
- One file per color mode; no preview.md; no `components` map (v1).
- No git commits unless asked.
