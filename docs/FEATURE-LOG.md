# Feature Log

A plain-English running log of notable features added to the pipeline — what they do, and why they're worth having. Newest first.

---

## 2026-07-01 — Variable Accents (1–3) 🎚️ *(for designers)*

**One line:** You can now add and remove accent colors in Color Studio — anywhere from **1 to 3** — instead of being locked to exactly three, and the engine emits only the accents that actually exist.

### The problem it solves (ELI5)

The system always assumed **three** accents: primary, secondary, tertiary. But not every brand wants three — plenty are built around a single accent, or two. Forcing a third meant either inventing a color nobody uses or leaving a slot that quietly muddies the palette. There was no way to say "this theme has one accent" and have the whole system agree.

### What it does

Accents are now **named, tail-ordered slots** — `primary` is always present, then you can add `secondary`, then `tertiary`, up to a max of three. In the Studio sidebar you get an **"Add accent"** button (until you hit three) and a remove (✕) control on the last accent (down to a minimum of one).

The important design choices that keep it safe:

- **Names stay frozen.** The 2nd accent is *always* `secondary`, the 3rd *always* `tertiary` — so token names never renumber and the Figma round-trip is preserved.
- **The engine emits only what exists.** With one accent, no `color-secondary-*` / `color-tertiary-*` ramps, brand tokens, or alpha twins are generated — the Figma seed export shrinks to match.
- **The preview never breaks.** In the Playground, a reference to a missing accent (e.g. `color-fg-secondary`) falls back to the **primary** accent at the same step, so every `--color-*` var stays defined and components render fully at any accent count.
- **Tail-ordering by construction.** You can't have a tertiary without a secondary — the UI guarantees it, so the engine stays simple and just emits each slot independently.

New accents come in with a sensible default: the hue is rotated 90° from primary (secondary → +90°, tertiary → +180°) at primary's chroma, so an added accent lands somewhere visually distinct rather than on top of what's already there.

### How you use it

```bash
npm run preview:studio      # opens the Studio
```

- Click **Add accent** to grow the palette (up to 3); click ✕ on the last accent to shrink it (down to 1).
- **Save to config** writes the accent set — including its count — back into [theme.config.ts](theme.config.ts).
- `npm run build:theme` then regenerates the token files, emitting ramps/brand/alpha only for the accents present.

### Why it's valuable

- **Honest to the brand.** A one-accent brand produces a one-accent system — no phantom colors to ignore or misuse.
- **Smaller, cleaner output.** Fewer accents means fewer generated tokens and a leaner Figma seed, not dead slots.
- **Zero naming churn.** Because slots are named and tail-ordered, adding or removing an accent never renames anything that stayed — the Name-Drift Guard sees only genuine adds/removes.

### Good to know

- **Status stays a fixed four** (success / error / warning / info) — this change is about *accents* only.
- Removal is **tail-based**: you drop the last accent, not an arbitrary middle one, so there's never a gap to renumber.
- Built on the primitives-only engine: removing an accent affects which primitives are emitted and the live preview — never the semantic mapping shipped to Figma.

---

## 2026-06-25 — Preview Tabs: Color Ramps & Playground 🗂️ *(for designers)*

**One line:** The Color Studio preview is split into two tabs — the palette ("Color ramps") and a live component "Playground" — so each view is clean and focused instead of one long scroll.

### The problem it solves (ELI5)

The Studio's preview used to be one tall stack: every color ramp, the label-on-fill demo, dark surfaces, brand swatches, *and* a little sample of UI — all scrolling together. As more got added it became a wall. You had to scroll past the palette to see components, and past components to compare ramps. Two different jobs (judging the palette vs. seeing it on real UI) were fighting for the same space.

### What it does

A tab bar at the top of the preview splits it into two focused views:

- **Color ramps** — everything about the palette itself: the ramps, the white-label-on-fill accessibility demo, the dark-surface elevation ladder, the brand swatches, and (when enabled) the alpha-over-white ramps.
- **Playground** — the colors on *real components*: a card, buttons (primary / secondary / disabled), form inputs in default / focused / invalid states, status alerts and badges (success / error / warning / info) — all painted purely from the generated **semantic** tokens, so it's an honest test of whether the system holds up in context.

The tab you last looked at is remembered between reloads. Alongside this, the sidebar gained an **"Output" settings group** (a proper collapsible section) that holds the alpha-tokens switch and the **contrast-badge toggle** — the latter moved out of the preview and into the sidebar where the other controls live.

### How you use it

```bash
npm run preview:studio      # opens the Studio
```

Click **Color ramps** / **Playground** to switch views. Toggle contrast badges and alpha output from the sidebar's **Output** section.

### Why it's valuable

- **Focus.** Each view does one job, so you're not scrolling past one to reach the other.
- **A real proving ground.** The Playground shows components driven only by semantic tokens — the truest "does this theme actually work?" check, separate from raw swatch-gazing.
- **Controls live with controls.** Moving the contrast toggle into the sidebar keeps the preview for *showing* and the sidebar for *tuning*.

### Good to know

- The Playground specimens style **only their colors** from `var(--color-*)` tokens; their shape (radius, spacing) is illustrative plain CSS, not a claim about radius/spacing tokens (which the color engine doesn't generate).
- The active tab persists in `localStorage`, like the sidebar's collapsible sections.

---

## 2026-06-25 — Alpha-Over-White Color Tokens 🫧

**One line:** An optional set of *translucent* twins of every color shade — each one looks identical to the solid when placed over white, but works as a tint/border/overlay over **any** surface. (Same idea as [alphredo.app](https://alphredo.app/).)

### The problem it solves (ELI5)

A solid color is picked to look right on one background. But lots of UI wants a *see-through* version of that color: a subtle border, a hover wash, an overlay, a tint on a card. If you just lower the opacity of the solid by eye, it rarely matches — and it definitely won't match across light surfaces, images, and colored cards.

The trick (what alphredo does): for a given solid color, find the **most transparent** color that, when composited over white, renders *exactly* the same as the solid. Now you have one token that equals the solid over white **and** tints correctly over everything else.

### What it does

When you turn the feature on, the engine emits an alpha twin for every step of the 8 named ramps (neutral + 3 accents + 4 status), named `color-{ramp}-alpha-{step}` (e.g. `color-accent-alpha-500`). It's **off by default** and lives alongside the existing fixed black/white opacity tokens — nothing changes unless you opt in.

The clever bits that make it correct:

- **Solved where compositing actually happens.** The math runs in gamma **sRGB** (the space browsers and Figma blend alpha in), so the twin renders pixel-identical to the solid over white. The transparency is `1 − (lightest channel)`: light shades become very see-through, dark shades stay nearly opaque.
- **Stored in the engine's native space.** The result is converted back to **OKLCH + alpha**, so the token file stays consistent with every other color the engine emits.

### How you use it

- **In the Studio:** flip **Alpha-over-white tokens** in the sidebar's *Output* section, and a preview row shows every alpha ramp on a white plate.
- **In config:** set `alpha: true` in [theme.config.ts](theme.config.ts), then:

```bash
npm run build:theme        # regenerates the color token files, now with alpha twins
npm run build:tokens       # builds the CSS / platform outputs
```

### Why it's valuable

- **One token, any surface.** A single translucent step covers borders, hovers, and overlays that tint correctly over white, dark, images, or colored cards — instead of maintaining separate solids per background.
- **Faithful by construction.** Because it's solved in the space compositing happens, "over white it matches the solid" is a guarantee, not a hope.
- **Opt-in and additive.** Off by default, no change to existing output; the long-standing `color-black/white-alpha-*` ladder is untouched.

### Good to know

- Only the **8 named ramps** get twins — dark-mode surfaces and the verbatim `color-brand-*` colors deliberately don't.
- The emitted alpha is rounded to 4 dp at the token-writing step (the engine keeps full precision internally), so the CSS stays tidy.
- It rides the same path as every other generated color, so the **Token Name-Drift Guard** sees the new names just like any other — and the Figma copy bundle includes them when enabled.

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

---

## 2026-06-22 — Generative Color Engine 🎨

**One line:** Describe a color system with a *handful* of numbers, press build, and get a complete, accessible, light-and-dark color token set out the other end — instead of hand-picking hundreds of values.

### The problem it solves (ELI5)

A real color system isn't a few colors — it's *hundreds* of values. Every color (neutral, three brand accents, four status colors) needs a whole ladder of shades (lightest → darkest), and each of those needs a **light-mode** and a **dark-mode** version. On top of that, they all have to (a) look harmonious together and (b) meet accessibility contrast rules so text is actually readable.

Doing that by hand is slow, easy to get subtly wrong, and brutal to change: nudge one brand hue and you're re-picking dozens of shades by eye, in two modes, re-checking contrast on every one. Most "design systems" quietly drift out of tune the moment someone retunes a color.

### What it does

You set a few **seed knobs** in [theme.config.ts](theme.config.ts):

- the **neutral** base (its hue + how colorful/grey it is),
- three **accent** hues (primary/secondary/tertiary) and four **status** hues (success/error/warning/info),
- one **contrast** knob (how punchy light-vs-dark should be),
- and a couple of dark-mode surface settings.

Then `npm run build:theme` **expands** those seeds into full color *ramps* (the whole ladder of shades per color), for **both light and dark mode**, and writes the color token files. ~10 numbers in → a complete token system out.

The clever bits that make it trustworthy:

- **OKLCH color space.** Colors are computed in a model where "lightness" actually matches how bright your eye perceives it. So the shades step evenly and hues stay consistent — no muddy or neon surprises that plague hand-tuned HSL palettes.
- **Accessibility is computed, not hoped for.** Foreground colors (text, icons) aren't fixed picks — the engine *measures* WCAG contrast against the background and chooses the shade that genuinely meets the target (e.g. 4.5:1). Readable by construction.
- **One knob ripples everywhere.** Change a single hue, rebuild, and the entire system updates consistently across every shade and both modes. Re-theming is minutes, not days.
- **Screen-gamut aware.** Colors are clamped to the P3 display range so they render correctly on modern screens.

### How you use it

```bash
# 1. Edit the seeds
#    theme.config.ts  (hues, chroma, contrast)

# 2. Regenerate the color tokens
npm run build:theme        # rewrites the engine-owned color token files

# 3. Build the CSS/platform outputs
npm run build:tokens
```

### Why it's valuable to the pipeline

- **Speed:** a full, themeable color system from a tiny config instead of hundreds of hand-set values.
- **Consistency:** the math keeps every shade and both modes in tune — no manual drift.
- **Accessibility guaranteed:** contrast is enforced when the tokens are generated, not audited after the fact.
- **Easy theming:** spin up a new look (or a client theme) by changing seeds, not by repainting the whole palette.

### Good to know

- The engine **owns** the color token files it generates — `primitives-color.mode-1`, `color.light`, `color.dark` — which is why they carry the `"auto-generated by build:theme — do not edit"` banner. Edit the *seeds*, not those files.
- Some colors are deliberately **not** generated: the fixed `color-prism-*` palette lives in a separate static file, and non-color tokens (radius, spacing, typography) are their own thing.
- It pairs naturally with the **Token Name-Drift Guard** above: because the engine produces deterministic token names, a rename at the engine source shows up as drift just like a Figma rename would — so accidental breakage is caught either way.

---

## 2026-06-22 — Color Studio 🎛️ *(for designers)*

**One line:** A visual playground where you tune the entire color system with sliders and watch it update live — no code, no JSON, no guessing what "hue 151, chroma 0.19" looks like.

### The problem it solves (ELI5)

The Generative Color Engine (above) is powerful, but its input is a config file full of numbers. Asking a designer to edit `"hue": 151, "chroma": 0.19` by hand — and *imagine* the result — is backwards. Designers think by **seeing**, not by typing coordinates. The Studio is the friendly face on top of the engine: you move sliders, it shows you the real thing, instantly.

### What it does

It's a small local web app. Open it and you get:

- **Sliders for every knob** — each color's hue and colorfulness, the contrast level, the neutral base. Drag, and the whole system recomputes.
- **A live preview** — real sample UI (buttons, cards, text, surfaces) painted with your current colors, re-rendering smoothly as you drag.
- **A light/dark toggle** — flip between modes to check both at a glance.
- **WCAG contrast badges** — little pass/fail indicators right in the preview, so you *see* whether text is readable as you tune, not after.
- **Two save paths:**
  - **"Save to config"** writes your tuning straight back into `theme.config.ts` — so what you designed becomes the engine's real source of truth.
  - **"Copy tokens for Figma"** puts the whole generated token set on your clipboard, ready to paste into Figma.

### How designers use it

```bash
npm run preview:studio      # opens the Studio in your browser
```

Then: drag sliders → watch the preview + contrast badges → **Save to config** when happy (or **Copy tokens for Figma** to take it into Figma). A developer (or `npm run build:theme`) turns the saved config into the final token files.

### Why it's valuable (especially for designers)

- **No code, no JSON.** Tuning a design system becomes a visual, hands-on act — the way design should feel.
- **Accessibility while you design.** The WCAG badges mean contrast problems are caught in the moment, not flagged in a later audit.
- **Both modes at once.** Light and dark stay honest because you can flip between them instantly.
- **It closes the loop.** Your slider tweaks round-trip straight into the engine config (or into Figma) — no "throw it over the wall to a developer to translate" step.

### Good to know

- The Studio is the **front-end to the Generative Color Engine** — it doesn't invent colors, it drives the same engine and shows the result. "Save to config" updates `theme.config.ts`; you still run `build:theme` to regenerate the committed token files.
- "Copy tokens for Figma" produces the same self-contained token bundle the Figma import plugin expects — the design→engine→Figma round-trip in one click.
