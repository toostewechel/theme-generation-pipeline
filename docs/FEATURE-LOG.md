# Feature Log

A plain-English running log of notable features added to the pipeline — what they do, and why they're worth having. Newest first.

---

## 2026-06-24 — Token Name-Drift Guard 🔍

**One line:** A safety net that warns you when a design-token *name* disappears, so a typo or forgotten rename in Figma can't quietly break everything that depends on it.

### The problem it solves (ELI5)

Designers author variables in Figma and export them into this pipeline as the `src/tokens/` files. Everything downstream — components, CSS, code, other tokens — refers to those tokens **by name**. So a name is a promise: "this token is called `color-fg-default`, you can rely on it."

The danger: when you re-export from Figma and overwrite the token files, it's easy to *accidentally* change a name (a typo, a reorganize) or *drop* one you forgot to include. Nothing shouts about it. The export just... has different names now. Anything using the old name silently breaks.

**Adding new tokens is safe** — nothing was relying on a name that didn't exist yet. The dangerous moves are **renames** and **removals**: a name that used to be there and now isn't.

### What the guard does

It takes a "before" photo and an "after" photo of all your token names and tells you which names **vanished**:

- 🚨 **removed** — a name that was there before and is now gone. This is a rename or a deletion → **it breaks consumers** → look before you leap.
- 🆕 **added** — a brand-new name. Safe, just informational.
- ✅ **unchanged** — still there, all good.

The clever bit: the "before" photo comes straight from **git**. Whatever you last committed is treated as "the names everyone agreed on." Your freshly-pasted files are the "after." So the guard needs no extra snapshot files or special export format — it rides on git history you already have. **Committing your changes = "I accept these names."**

### How you use it

```bash
# After overwriting the token files from a new Figma export, before committing:
npm run check:token-drift
```

You'll see something like:

```
🔍 Token name-drift  HEAD → working tree
   ✅ 517 unchanged
   🚨 3 removed (renames-away or removals — break consumers):
      🔻 color-state-hover-intensity
   🆕 2 added (safe):
      ➕ color-accent-950

💥 Breaking drift — 3 name(s) removed. Review before committing.
```

- **Exit code 0** = clean, nothing removed. **Exit code 1** = something was removed (so it can fail a CI check or git hook later). **Exit code 2** = something's misconfigured (bad branch name, not a git repo).
- **CI / pull-request mode:** compare a whole branch against `main` —
  `npm run check:token-drift -- --base main --head HEAD`
- **Mute known false alarms:** add token names (or `/regex/`) to `scripts/token-drift.ignore.json`. Handy for engine-only tokens that never live in Figma.

### Why it's valuable to the pipeline

- **Catches breakage at the moment it's introduced** — before it's committed, before it ships, instead of as a mystery bug weeks later.
- **Source-agnostic** — it doesn't care whether a token is computed by the color engine or hand-authored in Figma. It just compares names across git. So it works for fully hand-authored themes *and* engine-driven ones.
- **Zero new infrastructure** — no snapshot files, no special export, no database. Just git, which you already use.
- **Honest signal** — it only cries about the genuinely dangerous change (a name disappearing), so people actually trust it instead of tuning it out.
- **Real catch on day one:** it immediately flagged that a Figma export had dropped three engine-only `color-state-*` tokens (opacity/intensity values that don't exist as Figma variables) — exactly the kind of silent loss it's built to prevent.

### Good to know

- A token name is only "removed" when it disappears from **every** file that held it. Names like `color-fg-default` live in both the light and dark files — a real Figma rename changes both at once, so it's caught; a half-edit of one file isn't (which is correct).
- The check lives in two small pieces: a pure, well-tested core (`src/engine/token-drift.ts`) that does the name-collecting and comparing, and a thin CLI (`scripts/checkTokenDrift.ts`) that fetches files from git and prints the report.
- **Planned next step:** a live "ask Figma directly" mode via the Figma MCP, which would also bring stable variable IDs — letting the tool say *"renamed X → Y"* precisely instead of *"X removed, Y added."*

### Related change: `color-fg` / `color-bg` → `color-fg-default` / `color-bg-default`

The two default foreground/background color tokens were renamed to follow the `-default` suffix convention used by their siblings (`color-fg-muted`, `color-bg-subtle`, …). This happened at the engine source (`semantics.ts`), so it regenerates consistently. Note: anything still referencing the old `color-fg` / `color-bg` names needs updating — and the drift guard above is exactly what flags it if your Figma file still uses the old names.
