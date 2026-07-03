---
name: Framna
colors:
  primary: "#333333"
  secondary: "#666666"
  tertiary: "#1bc866"
  neutral: "#ffffff"
  surface: "#ffffff"
  accent-secondary: "#fcb55d"
  on-accent: "#1a1a1a"
  border: "#e5e5e5"
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

Editorial confidence on a clean white page. Framna pairs a bold serif voice with
a restrained near-black-on-white canvas, letting a single vivid green carry all
the energy. Slides should feel like a well-set magazine spread: generous white
space, strong serif headlines, and color used sparingly and deliberately.

## Colors

- **Primary (#333333):** Soft black ink. All headlines and body text on light
  backgrounds. Never use pure black.
- **Secondary (#666666):** Muted gray for supporting text, captions, and
  metadata. Use when content should recede.
- **Tertiary (#1bc866):** Framna green — the brand's signature. The sole
  accent: key numbers, highlights, active states, and occasional full-bleed
  statement slides. One green moment per slide is enough.
- **Neutral (#ffffff):** Pure white canvas. The default slide background.
- **Surface (#ffffff):** Cards and panels share the white canvas; separate them
  with borders, not fills.
- **Accent-secondary (#fcb55d):** Warm amber, the secondary brand color. Use
  rarely — chart contrast, callout fills, or warmth on data-heavy slides. Never
  compete with the green on the same element.
- **On-accent (#1a1a1a):** Near-black text on green or amber fills; both accents
  are light enough to carry dark text, not white.
- **Border (#e5e5e5):** Hairline dividers and card outlines. The primary tool
  for structure on the all-white canvas.

## Typography

Two families, strict roles. **Framna Serif** (bold, 700) owns every headline:
h1 at 4rem with tight -0.2px tracking for title slides, h2 at 3rem for section
headers, h3 at 1.5rem for card titles. **Framna Sans** (regular, 400) owns all
running text: body-md at 1.125rem/28px, body-sm at 0.875rem for captions and
footnotes. The label style is a serif eyebrow — 1.125rem bold with +0.2px
tracking — for kickers above headlines and slide numbers. Never set long
paragraphs in the serif, and never bold the sans for emphasis; use the green
instead.

## Layout

Space is the theme's main luxury. Slide padding: xl (32px) minimum on all
edges. Stack spacing: lg (24px) between distinct blocks, md (16px) between a
heading and its content, sm (8px) between related lines, xs (4px) only inside
compact components like chips. Prefer one idea per slide with asymmetric,
grid-aligned compositions over centered symmetry.

## Shapes

Corners are nearly sharp — this is an editorial system, not a friendly app.
Cards and images use lg (6px), buttons and tags md (4px), small chips and
swatches sm (3px). No pills, no circles except avatars and chart dots.

## Do's and Don'ts

- Do let white space dominate; a slide that feels empty is on-brand.
- Do use the green for the single most important element per slide.
- Don't place green and amber on the same element or side by side.
- Don't use white text on the accents; use near-black (#1a1a1a).
- Don't introduce shadows or gradients; structure comes from borders and type.
