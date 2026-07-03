---
name: Framna
colors:
  primary: "#f5f5f5"
  secondary: "#cccccc"
  tertiary: "#1bc866"
  neutral: "#1a1a1a"
  surface: "#333333"
  accent-secondary: "#fcb55d"
  on-accent: "#1a1a1a"
  border: "#666666"
typography:
  h1: { fontFamily: Framna Serif, fontSize: 4rem, fontWeight: 700, lineHeight: 80px, letterSpacing: -0.2px }
  h2: { fontFamily: Framna Serif, fontSize: 3rem, fontWeight: 700, lineHeight: 64px, letterSpacing: 0px }
  h3: { fontFamily: Framna Serif, fontSize: 1.5rem, fontWeight: 700, lineHeight: 32px, letterSpacing: 0px }
  body-md: { fontFamily: Framna Sans, fontSize: 1.125rem, fontWeight: 400, lineHeight: 28px, letterSpacing: 0px }
  body-sm: { fontFamily: Framna Sans, fontSize: 0.875rem, fontWeight: 400, lineHeight: 20px, letterSpacing: 0px }
  label: { fontFamily: Framna Serif, fontSize: 1.125rem, fontWeight: 700, lineHeight: 24px, letterSpacing: 0.2px }
rounded:
  sm: 3px
  md: 4px
  lg: 6px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

## Overview

The Framna editorial voice after dark. The same bold serif headlines and
disciplined single-accent philosophy, set on a near-black stage where the
signature green glows. Use this variant for keynote-style talks and demo-heavy
decks; it should feel like a gallery at night, not a hacker terminal.

## Colors

- **Primary (#f5f5f5):** Warm off-white ink for headlines and body text. Never
  pure white — it glares against the dark canvas.
- **Secondary (#cccccc):** Softened gray for supporting text, captions, and
  metadata.
- **Tertiary (#1bc866):** Framna green, unchanged from the light theme and even
  more vivid here. The sole accent: key numbers, highlights, active states.
  One green moment per slide.
- **Neutral (#1a1a1a):** Near-black canvas. The default slide background.
- **Surface (#333333):** Raised cards and panels. On dark, elevation comes from
  this lighter fill rather than borders alone.
- **Accent-secondary (#fcb55d):** Warm amber for rare contrast duty — charts and
  callouts. Never beside the green on the same element.
- **On-accent (#1a1a1a):** Near-black text on green or amber fills; both accents
  stay light, so dark-on-accent holds in both themes.
- **Border (#666666):** Dividers and outlines where a surface change isn't
  enough.

## Typography

Identical hierarchy to the light theme: **Framna Serif** at 700 for h1
(4rem, -0.2px), h2 (3rem), and h3 (1.5rem); **Framna Sans** at 400 for body-md
(1.125rem/28px) and body-sm (0.875rem); the serif label as an eyebrow with
+0.2px tracking. On dark backgrounds keep line lengths shorter and lean on
body-md over body-sm — small light-on-dark text tires quickly.

## Layout

Same spatial system as the light theme: xl (32px) slide padding, lg (24px)
between blocks, md (16px) heading-to-content, sm (8px) between related lines,
xs (4px) inside chips. Dark slides read heavier, so give hero statements even
more emptiness around them.

## Shapes

Corners stay nearly sharp: lg (6px) for cards and images, md (4px) for buttons
and tags, sm (3px) for chips. No pills, no circles except avatars and chart
dots.

## Do's and Don'ts

- Do use surface (#333333) panels to structure content; skip heavy borders.
- Do reserve the green for the single most important element per slide.
- Don't use pure white text; primary is #f5f5f5 for a reason.
- Don't place green and amber together on one element.
- Don't add glows, shadows, or gradients — the dark canvas is the drama.
