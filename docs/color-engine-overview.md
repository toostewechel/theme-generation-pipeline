# The Color Engine, in Plain Terms

*A non-technical overview of what we added to the token pipeline and why it matters. Written 2026-06-22.*

## TL;DR

We used to hand-pick every color in the design system, one value at a time, twice (once for light mode, once for dark). Now a small "engine" **generates the entire color set from three simple inputs**: a base gray, a contrast level, and your brand accent colors. Pick those three things and the whole palette falls out, light and dark, with accessibility already guaranteed. Change an input and everything updates together, instantly and consistently.

It bolts onto the pipeline we already have. None of the existing plumbing (the part that ships tokens to the website and other platforms) changed. We just replaced the slow, manual, error-prone part at the front.

## The old way vs. the new way

| | Before (hand-authored) | After (generated) |
|---|---|---|
| Defining colors | Pick ~100+ values by hand | Pick 3 inputs, derive the rest |
| Light + dark | Maintain two separate sets | One source, both modes out |
| Accessibility | Check contrast after, fix bugs as they appear | Built in: it passes by construction |
| Rebrand / new client | Re-pick everything | Paste a brand color, done |
| Consistency | Depends on human discipline | Guaranteed by the math |

## What you actually get (the outcomes)

**1. A whole palette from three decisions.**
Instead of curating hundreds of swatches, a designer chooses a neutral tone, how punchy the contrast should be, and the brand accent colors. The engine derives every surface, text color, border, button fill, and status color from those, in light and dark. Less work, fewer decisions, no drift.

**2. Accessibility stops being a recurring bug.**
This is the big one. The engine tunes every colored button so that white text on it clears the accessibility contrast standard, on *every* intent at once: blue, green, red, amber, whatever. You verify contrast one time and it holds for the entire palette, forever. A whole category of "this label is hard to read" defects simply stops appearing. That matters more every year, because increasingly the thing assembling the interface (a teammate moving fast, or an AI tool) can't eyeball contrast for itself, so the system has to be right by default.

**3. Light and dark for free.**
Dark mode is not a separate project to design and maintain. It comes out of the same engine as a second output. Change the brand color and both modes update in lockstep.

**4. Rebranding takes seconds, not weeks.**
Paste a client's brand hex and the entire system re-derives around it: ramps, buttons, states, dark mode. This is what makes white-labeling and "the same product in a different brand" cheap instead of a rebuild. For the exact brand color itself (a logo, a hero), we also keep a verbatim copy so it always matches precisely.

**5. New theme variants are nearly free later.**
Because everything is generated, "high-contrast mode" or a "color-blind-safe palette" become *different inputs*, not a from-scratch design effort. The capability is built in even before we turn it on.

**6. A studio designers can actually use.**
There is a visual tool where a designer drags sliders or pastes a brand color and sees the whole palette update live, including a real-time readout of which colors pass accessibility and a preview of buttons and components in context. They save, and the system regenerates. No editing config files by hand.

**7. A smaller, simpler set of names to learn.**
We also slimmed the vocabulary the design system exposes. Instead of dozens of near-duplicate color names per component, there is one small, consistent set (foreground, background, borders, plus intents). Easier to learn, easier to keep tidy, and the names describe *roles* so they stay accurate even when the colors change.

## The one analogy

It's the difference between a **dictionary** and a **grammar**.

A dictionary makes you look up every word someone already wrote down. If a word is missing, you're stuck. A grammar lets you *generate* correct sentences you've never seen, from a few rules. The old palette was a dictionary of fixed colors. The new engine is a grammar: give it three inputs and it produces a complete, correct, accessible palette, including combinations nobody hand-authored.

## What this means for risk (for the cautious stakeholder)

- **It's additive.** The existing pipeline that delivers tokens to the website and other platforms is unchanged. We swapped how the color values are produced, not how they're shipped.
- **It's verifiable.** The accessibility guarantee is enforced by automated tests, so it can't silently regress.
- **It's reversible in concept.** The output is still standard design tokens and standard CSS variables; nothing about the engine locks us in.

## In one sentence

> We turned color from a hand-maintained list into a generated system: three inputs produce a complete, accessible, light-and-dark palette, so re-theming is instant, dark mode and accessibility come for free, and a whole class of contrast bugs disappears.
