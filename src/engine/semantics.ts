import type { RampSet, ThemeInputs } from "./types.js";
import { resolveOnSurface } from "./contrast.js";
import { resolveContrast, targetFor } from "./contrast-input.js";
import { NEUTRAL_STEPS, HUE_STEPS } from "./steps.js";

// ─── Spec types ────────────────────────────────────────────────────────────

export type RefSpec = {
  kind: "ref";
  ramp: keyof RampSet | "black-alpha" | "white-alpha";
  step: string;
};

export type TargetSpec = {
  kind: "target";
  onRamp: keyof RampSet;
  onStep: string;
  ramp: keyof RampSet;
  min: number;
};

/** Emits `{ ref: name }` verbatim (dark-surface derivations, prism passthrough). */
export type PassthroughSpec = { kind: "passthrough"; name: string };

/** Emits a complete DTCG token object verbatim (numeric/dimension tokens). */
export type RawSpec = { kind: "raw"; token: object };

export type SemanticSpec = RefSpec | TargetSpec | PassthroughSpec | RawSpec;

export type ResolvedToken = { ref: string } | { raw: object };

// ─── Spec helpers ──────────────────────────────────────────────────────────

const ref = (ramp: RefSpec["ramp"], step: string): RefSpec => ({ kind: "ref", ramp, step });
const target = (onRamp: keyof RampSet, onStep: string, ramp: keyof RampSet, min: number): TargetSpec =>
  ({ kind: "target", onRamp, onStep, ramp, min });
const pass = (name: string): PassthroughSpec => ({ kind: "passthrough", name });
const raw = (value: number): RawSpec => ({
  kind: "raw",
  token: { $type: "dimension", $value: { value, unit: "px" }, $description: "unitless" },
});

// ─── nameFor ──────────────────────────────────────────────────────────────

function nameFor(ramp: RefSpec["ramp"], step: string): string {
  if (ramp === "black-alpha") return `color-black-alpha-${step}`;
  if (ramp === "white-alpha") return `color-white-alpha-${step}`;
  if (ramp === "accent") return `color-accent-${step}`;
  if (ramp === "secondary") return `color-sky-${step}`;
  if (ramp === "tertiary") return `color-pink-${step}`;
  return `color-${ramp}-${step}`; // neutral, success, error, warning, info
}

const STEPS_FOR: Record<string, string[]> = { neutral: NEUTRAL_STEPS };
const stepsFor = (ramp: keyof RampSet) => STEPS_FOR[ramp] ?? HUE_STEPS;

// ─── Lean layer (source of truth): fg-* / bg-* ───────────────────────────────
//
// The role × intent matrices (action-*, feedback-*) and the text-*/icon-*
// families are collapsed here. Intent is expressed by pointing at a ramp, not
// by minting a token per (intent × role). A single fg-on-accent works on every
// solid fill because fills are WCAG-anchored (see wcag-fill.test.ts). Existing
// border-* tokens already serve as the lean border set, so they stay as-is.

const LEAN_LIGHT: Record<string, SemanticSpec> = {
  // foregrounds
  "color-fg": target("neutral", "0", "neutral", 4.5),
  "color-fg-muted": target("neutral", "0", "neutral", 3),
  "color-fg-subtle": ref("neutral", "500"),
  "color-fg-emphasis": ref("accent", "900"),
  "color-fg-accent": ref("accent", "700"),
  "color-fg-link": ref("secondary", "700"),
  "color-fg-inverse": ref("neutral", "50"),
  "color-fg-on-accent": ref("neutral", "0"),
  "color-fg-on-accent-subtle": ref("neutral", "800"),
  "color-fg-success": ref("success", "700"),
  "color-fg-error": ref("error", "700"),
  "color-fg-warning": ref("warning", "700"),
  "color-fg-info": ref("info", "700"),
  // backgrounds
  "color-bg": ref("neutral", "0"),
  "color-bg-subtle": ref("neutral", "paper"),
  "color-bg-raised": ref("neutral", "0"),
  "color-bg-overlay": ref("neutral", "0"),
  "color-bg-inverse": ref("neutral", "900"),
  "color-bg-backdrop": ref("black-alpha", "48"),
  "color-bg-accent": ref("accent", "500"),
  "color-bg-accent-subtle": ref("accent", "100"),
  "color-bg-neutral": ref("neutral", "900"),
  "color-bg-success": ref("success", "500"),
  "color-bg-success-subtle": ref("success", "100"),
  "color-bg-error": ref("error", "500"),
  "color-bg-error-subtle": ref("error", "100"),
  "color-bg-warning": ref("warning", "500"),
  "color-bg-warning-subtle": ref("warning", "100"),
  "color-bg-info": ref("info", "500"),
  "color-bg-info-subtle": ref("info", "100"),
};

const LEAN_DARK: Record<string, SemanticSpec> = {
  "color-fg": target("neutral", "950", "neutral", 4.5),
  "color-fg-muted": target("neutral", "950", "neutral", 3),
  "color-fg-subtle": ref("neutral", "500"),
  "color-fg-emphasis": ref("neutral", "50"),
  "color-fg-accent": ref("accent", "500"),
  "color-fg-link": ref("secondary", "500"),
  "color-fg-inverse": ref("neutral", "950"),
  "color-fg-on-accent": ref("neutral", "0"),
  "color-fg-on-accent-subtle": ref("neutral", "200"),
  "color-fg-success": ref("success", "400"),
  "color-fg-error": ref("error", "400"),
  "color-fg-warning": ref("warning", "400"),
  "color-fg-info": ref("info", "400"),
  "color-bg": pass("color-neutral-dark-surface-2"),
  "color-bg-subtle": pass("color-neutral-dark-surface-1"),
  "color-bg-raised": pass("color-neutral-dark-surface-3"),
  "color-bg-overlay": pass("color-neutral-dark-surface-4"),
  "color-bg-inverse": ref("neutral", "0"),
  "color-bg-backdrop": ref("black-alpha", "48"),
  "color-bg-accent": ref("accent", "500"),
  "color-bg-accent-subtle": ref("accent", "900"),
  "color-bg-neutral": ref("neutral", "50"),
  "color-bg-success": ref("success", "500"),
  "color-bg-success-subtle": ref("success", "900"),
  "color-bg-error": ref("error", "500"),
  "color-bg-error-subtle": ref("error", "900"),
  "color-bg-warning": ref("warning", "500"),
  "color-bg-warning-subtle": ref("warning", "900"),
  "color-bg-info": ref("info", "500"),
  "color-bg-info-subtle": ref("info", "900"),
};

// ─── Legacy aliases (preserved names → lean tokens) ──────────────────────────
//
// Every legacy name keeps emitting, now as a reference to a lean token, so the
// site keeps working during migration. Mode-independent: the lean token it
// points at resolves per mode. A handful of inconsistent legacy values are
// normalized to the lean value (noted): text-on-brand / icon-on-brand /
// icon-inverse become the white on-accent label; action/feedback borders point
// at the fill (the lean "border = fill" pattern).

const ALIASES: Record<string, string> = {
  // text-* → fg-*
  "color-text-default": "color-fg",
  "color-text-subtle": "color-fg",
  "color-text-muted": "color-fg-muted",
  "color-text-emphasis": "color-fg-emphasis",
  "color-text-inverse": "color-fg-inverse",
  "color-text-accent": "color-fg-accent",
  "color-text-link": "color-fg-link",
  "color-text-annotation": "color-fg-link",
  "color-text-on-brand": "color-fg-on-accent",
  "color-text-on-white": "color-fg",
  // icon-* → fg-* (icons share text color)
  "color-icon-black": "color-fg",
  "color-icon-emphasis": "color-fg",
  "color-icon-default": "color-fg-muted",
  "color-icon-subtle": "color-fg-subtle",
  "color-icon-muted": "color-fg-subtle",
  "color-icon-inverse": "color-fg-on-accent",
  "color-icon-accent": "color-fg-accent",
  "color-icon-on-brand": "color-fg-on-accent",
  // surfaces → bg-*
  "color-background-surface-default": "color-bg",
  "color-background-surface-sunken": "color-bg-subtle",
  "color-background-surface-raised": "color-bg-raised",
  "color-background-surface-overlay": "color-bg-overlay",
  "color-background-surface-backdrop": "color-bg-backdrop",
  "color-background-surface-inverse": "color-bg-inverse",
  // action – primary → accent fill
  "color-action-primary-background": "color-bg-accent",
  "color-action-primary-on-bg": "color-fg-on-accent",
  "color-action-primary-text": "color-fg-accent",
  "color-action-primary-icon": "color-fg-accent",
  "color-action-primary-border": "color-bg-accent",
  // action – danger → error fill
  "color-action-danger-background": "color-bg-error",
  "color-action-danger-on-bg": "color-fg-on-accent",
  "color-action-danger-text": "color-fg-error",
  "color-action-danger-icon": "color-fg-error",
  "color-action-danger-border": "color-bg-error",
  // feedback – success
  "color-feedback-success-background": "color-bg-success",
  "color-feedback-success-on-bg": "color-fg-on-accent",
  "color-feedback-success-text": "color-fg-success",
  "color-feedback-success-icon": "color-fg-success",
  "color-feedback-success-border": "color-bg-success",
  // feedback – warning (background is a tint)
  "color-feedback-warning-background": "color-bg-warning-subtle",
  "color-feedback-warning-on-bg": "color-fg-warning",
  "color-feedback-warning-text": "color-fg-warning",
  "color-feedback-warning-icon": "color-fg-warning",
  "color-feedback-warning-border": "color-bg-warning",
  // feedback – error (background is a tint)
  "color-feedback-error-background": "color-bg-error-subtle",
  "color-feedback-error-on-bg": "color-fg-error",
  "color-feedback-error-text": "color-fg-error",
  "color-feedback-error-icon": "color-fg-error",
  "color-feedback-error-border": "color-bg-error",
  // feedback – info
  "color-feedback-info-background": "color-bg-info",
  "color-feedback-info-on-bg": "color-fg-on-accent",
  "color-feedback-info-text": "color-fg-info",
  "color-feedback-info-icon": "color-fg-info",
  "color-feedback-info-border": "color-bg-info",
};

// ─── Kept legacy tokens (not yet collapsed) ──────────────────────────────────
//
// border-* are already role-based (the lean border set). control-*, state-*,
// retro-*, the brand/neutral/marker/navbar backgrounds, surface-white, and the
// secondary/tertiary/neutral/white action sets stay as-is; the alternate-accent
// actions migrate to the `--fill` pattern (point at a ramp) rather than aliasing.

const KEEP_LIGHT: Record<string, SemanticSpec> = {
  "color-background-surface-white": ref("neutral", "0"),
  "color-background-brand-primary": ref("accent", "500"),
  "color-background-brand-secondary": ref("secondary", "500"),
  "color-background-brand-tertiary": ref("tertiary", "500"),
  "color-background-neutral-primary": ref("neutral", "900"),
  "color-background-neutral-secondary": ref("neutral", "200"),
  "color-background-neutral-tertiary": ref("neutral", "100"),
  "color-background-marker": ref("accent", "200"),
  "color-background-navbar": ref("white-alpha", "48"),
  "color-border-emphasis": ref("black-alpha", "16"),
  "color-border-default": ref("black-alpha", "12"),
  "color-border-subtle": ref("black-alpha", "8"),
  "color-border-gridlines": ref("black-alpha", "8"),
  "color-border-white": ref("neutral", "50"),
  "color-border-interactive-frame": ref("secondary", "500"),
  "color-border-brand-primary": ref("accent", "400"),
  "color-border-brand-secondary": ref("accent", "100"),
  "color-control-background-default": ref("neutral", "0"),
  "color-control-background-tinted": ref("neutral", "200"),
  "color-control-background-tintent-brand": ref("accent", "50"),
  "color-control-background-translucent": ref("white-alpha", "24"),
  "color-control-background-disabled": ref("neutral", "200"),
  "color-control-border-default": ref("neutral", "300"),
  "color-control-border-hover": ref("neutral", "400"),
  "color-control-border-focus": ref("accent", "400"),
  "color-control-border-error": ref("error", "500"),
  "color-action-secondary-background": ref("secondary", "500"),
  "color-action-secondary-on-bg": ref("neutral", "0"),
  "color-action-secondary-text": ref("secondary", "700"),
  "color-action-secondary-icon": ref("secondary", "500"),
  "color-action-secondary-border": ref("secondary", "500"),
  "color-action-tertiary-background": ref("tertiary", "500"),
  "color-action-tertiary-on-bg": ref("neutral", "0"),
  "color-action-tertiary-text": ref("tertiary", "700"),
  "color-action-tertiary-icon": ref("tertiary", "500"),
  "color-action-tertiary-border": ref("tertiary", "500"),
  "color-action-neutral-background": ref("neutral", "900"),
  "color-action-neutral-on-bg": ref("neutral", "50"),
  "color-action-neutral-text": ref("neutral", "800"),
  "color-action-neutral-icon": ref("neutral", "800"),
  "color-action-neutral-border": ref("neutral", "700"),
  "color-action-white-background": ref("neutral", "0"),
  "color-action-white-on-bg": ref("neutral", "900"),
  "color-action-white-text": ref("neutral", "0"),
  "color-action-white-icon": ref("neutral", "0"),
  "color-action-white-border": ref("neutral", "0"),
  "color-state-focus-ring": ref("accent", "300"),
  "color-state-focus-ring-offset": ref("neutral", "0"),
  "color-state-checked": ref("accent", "500"),
  "color-state-disabled-opacity": raw(0.5),
  "color-state-hover-intensity": raw(0.9200000166893005),
  "color-state-active-intensity": raw(0.8500000238418579),
  "color-retro-green": pass("color-prism-green"),
  "color-retro-yellow": pass("color-prism-yellow"),
  "color-retro-orange": pass("color-prism-orange"),
  "color-retro-red": pass("color-prism-red"),
  "color-retro-magenta": pass("color-prism-magenta"),
  "color-retro-purple": pass("color-prism-purple"),
  "color-retro-blue": pass("color-prism-blue"),
  "color-retro-cyan": pass("color-prism-cyan"),
  "color-circled-marker": pass("color-prism-yellow"),
};

const KEEP_DARK: Record<string, SemanticSpec> = {
  "color-background-surface-white": ref("neutral", "0"),
  "color-background-brand-primary": ref("accent", "500"),
  "color-background-brand-secondary": ref("secondary", "500"),
  "color-background-brand-tertiary": ref("tertiary", "500"),
  "color-background-neutral-primary": ref("neutral", "100"),
  "color-background-neutral-secondary": ref("neutral", "800"),
  "color-background-neutral-tertiary": ref("neutral", "900"),
  "color-background-marker": ref("accent", "700"),
  "color-background-navbar": ref("black-alpha", "48"),
  "color-border-emphasis": ref("white-alpha", "32"),
  "color-border-default": ref("white-alpha", "24"),
  "color-border-subtle": ref("white-alpha", "12"),
  "color-border-gridlines": ref("white-alpha", "8"),
  "color-border-white": ref("neutral", "50"),
  "color-border-interactive-frame": ref("secondary", "500"),
  "color-border-brand-primary": ref("accent", "500"),
  "color-border-brand-secondary": ref("accent", "700"),
  "color-control-background-default": ref("neutral", "0"),
  "color-control-background-tinted": ref("neutral", "800"),
  "color-control-background-tintent-brand": ref("accent", "900"),
  "color-control-background-translucent": ref("white-alpha", "24"),
  "color-control-background-disabled": ref("neutral", "800"),
  "color-control-border-default": ref("neutral", "300"),
  "color-control-border-hover": ref("neutral", "400"),
  "color-control-border-focus": ref("accent", "400"),
  "color-control-border-error": ref("error", "400"),
  "color-action-secondary-background": ref("secondary", "500"),
  "color-action-secondary-on-bg": ref("neutral", "0"),
  "color-action-secondary-text": ref("secondary", "500"),
  "color-action-secondary-icon": ref("secondary", "500"),
  "color-action-secondary-border": ref("secondary", "500"),
  "color-action-tertiary-background": ref("tertiary", "500"),
  "color-action-tertiary-on-bg": ref("neutral", "0"),
  "color-action-tertiary-text": ref("tertiary", "500"),
  "color-action-tertiary-icon": ref("tertiary", "500"),
  "color-action-tertiary-border": ref("tertiary", "500"),
  "color-action-neutral-background": ref("neutral", "50"),
  "color-action-neutral-on-bg": ref("neutral", "900"),
  "color-action-neutral-text": ref("neutral", "200"),
  "color-action-neutral-icon": ref("neutral", "200"),
  "color-action-neutral-border": ref("neutral", "400"),
  "color-action-white-background": ref("neutral", "0"),
  "color-action-white-on-bg": ref("neutral", "900"),
  "color-action-white-text": ref("neutral", "0"),
  "color-action-white-icon": ref("neutral", "0"),
  "color-action-white-border": ref("neutral", "0"),
  "color-state-focus-ring": ref("accent", "400"),
  "color-state-focus-ring-offset": ref("neutral", "0"),
  "color-state-checked": ref("accent", "500"),
  "color-state-disabled-opacity": raw(0.5),
  "color-state-hover-intensity": raw(1.0499999523162842),
  "color-state-active-intensity": raw(1.100000023841858),
  "color-retro-green": pass("color-prism-green"),
  "color-retro-yellow": pass("color-prism-yellow"),
  "color-retro-orange": pass("color-prism-orange"),
  "color-retro-red": pass("color-prism-red"),
  "color-retro-magenta": pass("color-prism-magenta"),
  "color-retro-purple": pass("color-prism-purple"),
  "color-retro-blue": pass("color-prism-blue"),
  "color-retro-cyan": pass("color-prism-cyan"),
  "color-circled-marker": pass("color-prism-yellow"),
};

// Merged spec view (lean + kept) — the contrast-targeted and ref/raw tokens.
// Aliases are layered on top in resolveSemantics.
export const SEMANTICS_LIGHT: Record<string, SemanticSpec> = { ...LEAN_LIGHT, ...KEEP_LIGHT };
export const SEMANTICS_DARK: Record<string, SemanticSpec> = { ...LEAN_DARK, ...KEEP_DARK };

// ─── Resolver ─────────────────────────────────────────────────────────────

function resolveSpec(spec: SemanticSpec, ramps: RampSet, k: number): ResolvedToken {
  if (spec.kind === "raw") return { raw: spec.token };
  if (spec.kind === "passthrough") return { ref: spec.name };
  if (spec.kind === "ref") return { ref: nameFor(spec.ramp, spec.step) };
  // target: contrast-resolved ref
  const surface = ramps[spec.onRamp][spec.onStep];
  const min = targetFor(spec.min, k);
  const step = resolveOnSurface(ramps[spec.ramp], surface, min, stepsFor(spec.ramp));
  return { ref: nameFor(spec.ramp, step) };
}

export function resolveSemantics(
  ramps: RampSet,
  inputs: ThemeInputs,
  mode: "light" | "dark",
): Record<string, ResolvedToken> {
  const table = mode === "light" ? SEMANTICS_LIGHT : SEMANTICS_DARK;
  const k = resolveContrast(inputs.contrast);
  const out: Record<string, ResolvedToken> = {};

  for (const [name, spec] of Object.entries(table)) {
    out[name] = resolveSpec(spec, ramps, k);
  }
  // Legacy names alias to lean tokens (same in both modes).
  for (const [legacy, leanName] of Object.entries(ALIASES)) {
    out[legacy] = { ref: leanName };
  }
  return out;
}
