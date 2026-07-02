# How to Use the `generate-color-theme` Skill

*A guide to the programmatic theming skill: what it is, how it gets installed, and how to drive it. Written 2026-07-02.*

## What this skill does

`generate-color-theme` is a Claude Code skill that turns a handful of **structured inputs** (brand hex(es), a contrast level, an optional neutral tint) into a full color theme using this repo's color engine — and then, optionally:

- **Writes repo tokens/CSS** — regenerates `theme.config.ts`, `src/tokens/`, and `dist/css/`, or
- **Updates Figma in place** — pushes the generated `primitives-color` variables into a Figma file via the official Figma MCP.

It's the headless alternative to the color studio UI (`npm run preview:studio`). Instead of dragging sliders, you hand it JSON and it drives [scripts/generateTheme.ts](../scripts/generateTheme.ts). `theme.config.ts` is the single source of truth — any input you omit defaults from it.

See [color-engine-overview.md](color-engine-overview.md) for the *why* behind the engine.

## How the skill is installed

Skills live in `.claude/skills/<skill-name>/SKILL.md`. This one is already committed at:

```
.claude/skills/generate-color-theme/SKILL.md
```

Because it's inside the repo, **anyone who clones the repo and opens it in Claude Code gets the skill automatically** — no per-machine install. Claude discovers it on session start and lists it as an available skill.

To add a *new* skill of your own, follow the same layout:

1. Create `.claude/skills/<your-skill>/SKILL.md`.
2. Give it YAML frontmatter with `name` and a `description` that says both *what it does* and *when to use it* — the description is what Claude matches against a user request, so be specific about triggers.
3. Write the body as step-by-step instructions Claude will follow.
4. Commit it. Restart / reload the Claude Code session to pick it up.

```markdown
---
name: your-skill
description: One line on what it does AND when to use it. This is the trigger.
---

# Your Skill

Steps Claude should follow…
```

## How to invoke it

Just ask in natural language — the skill's `description` triggers it. For example:

- "Retheme to a green brand, `#16a34a`, high contrast."
- "Push these brand colors into the Figma primitives-color variables."
- "Generate tokens for primary `#2563eb` and secondary `#db2777`."

Or invoke it explicitly with the slash form: `/generate-color-theme`.

## The workflow, end to end

### 1. Assemble structured inputs

The skill never eyeballs colors. Each brand hex is converted to an accent seed (hue + chroma) **and** a verbatim brand OKLCH, using engine helpers:

```bash
npx tsx -e 'import{hexToHueSeed,hexToOklch}from"./src/engine/index.js";const h=process.argv[1];console.log(JSON.stringify({seed:hexToHueSeed(h),brand:hexToOklch(h)}))' "#16a34a"
```

That produces a **partial** `ThemeInputs` JSON like:

```json
{ "accents": { "primary": { "hue": 149.2, "chroma": 0.17 } },
  "brand":   { "primary": { "l": 0.627, "c": 0.17, "h": 149.2 } },
  "contrast": "default" }
```

### 2. Confirm the resolved inputs (always first)

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-resolved
```

This prints the **complete** resolved inputs — every field, including everything defaulted from `theme.config.ts`. The skill shows this to you and waits for approval before writing anything. If inputs are out of range, the CLI prints errors to stderr and exits 1.

### 3a. Repo path — write tokens/CSS

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --write-config --build
npm run build:tokens   # optional: regenerate dist/css
```

Changed files are reported back. Nothing is committed unless you ask.

### 3b. Figma path — update variables in place

The skill first emits a plan, then runs a **read-only preview** (shows how many variables it would update vs. create fresh), waits for your approval, then applies. It writes **only** `primitives-color`; the semantic `color` collection is Figma-owned and never touched, and it never prunes variables missing from the plan.

```bash
echo '<partial-json>' | npx tsx scripts/generateTheme.ts --emit-figma-plan > /tmp/figma-plan.json
```

The apply/preview steps run through the Figma MCP (`use_figma`); the skill loads the `figma-use` skill before any Figma write.

## CLI flag reference

These are the flags on [scripts/generateTheme.ts](../scripts/generateTheme.ts) the skill uses. Input JSON comes from stdin, or pass `--input <file>`.

| Flag | Effect | Writes? |
|---|---|---|
| `--emit-resolved` | Print the fully-resolved `ThemeInputs` (for confirmation) | stdout only |
| `--emit-bundle` | Print the serialized token bundle | stdout only |
| `--emit-figma-plan` | Print the `FigmaVariablePlan` JSON | stdout only |
| `--write-config` | Overwrite `theme.config.ts` with the resolved inputs | ✅ file |
| `--build` | Write `src/tokens/` (primitives + semantic color) | ✅ files |
| `--input <file>` | Read partial inputs from a file instead of stdin | — |

## Guarantees & non-goals

- **Structured inputs only** — no natural-language inference of color values.
- **Figma writes touch only `primitives-color`**, never the semantic `color` collection, and never prune.
- **OKLCH→sRGB conversion happens in the engine**; the Figma scripts carry no color library.
- **No implicit git commits** — you decide when to commit.
