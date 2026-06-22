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

/**
 * Passthrough: emits `{ ref: name }` verbatim, bypassing nameFor().
 * Used for:
 *   - color-neutral-dark-surface-{1..5}  (Task 7 derivations)
 *   - color-prism-*  (static passthrough)
 */
export type PassthroughSpec = {
  kind: "passthrough";
  name: string;
};

/**
 * Raw: emits a complete DTCG token object verbatim (no ref resolution).
 * Used for dimension/non-color tokens with mode-specific literal values:
 *   - color-state-disabled-opacity
 *   - color-state-hover-intensity
 *   - color-state-active-intensity
 */
export type RawSpec = {
  kind: "raw";
  token: object;
};

export type SemanticSpec = RefSpec | TargetSpec | PassthroughSpec | RawSpec;

export type ResolvedToken = { ref: string } | { raw: object };

// ─── Spec helpers ──────────────────────────────────────────────────────────

const ref = (ramp: RefSpec["ramp"], step: string): RefSpec =>
  ({ kind: "ref", ramp, step });

const target = (
  onRamp: keyof RampSet,
  onStep: string,
  ramp: keyof RampSet,
  min: number,
): TargetSpec => ({ kind: "target", onRamp, onStep, ramp, min });

const pass = (name: string): PassthroughSpec =>
  ({ kind: "passthrough", name });

const raw = (value: number): RawSpec => ({
  kind: "raw",
  token: { $type: "dimension", $value: { value, unit: "px" }, $description: "unitless" },
});

// ─── nameFor ──────────────────────────────────────────────────────────────

/**
 * Maps (ramp key, step) to the canonical primitive token name.
 *
 *   neutral    → color-neutral-{step}
 *   accent     → color-accent-{step}      (primary)
 *   secondary  → color-sky-{step}
 *   tertiary   → color-pink-{step}
 *   success    → color-success-{step}
 *   error      → color-error-{step}
 *   warning    → color-warning-{step}
 *   info       → color-info-{step}
 *   black-alpha→ color-black-alpha-{step}
 *   white-alpha→ color-white-alpha-{step}
 */
function nameFor(ramp: RefSpec["ramp"], step: string): string {
  if (ramp === "black-alpha") return `color-black-alpha-${step}`;
  if (ramp === "white-alpha") return `color-white-alpha-${step}`;
  if (ramp === "accent") return `color-accent-${step}`;
  if (ramp === "secondary") return `color-sky-${step}`;
  if (ramp === "tertiary") return `color-pink-${step}`;
  return `color-${ramp}-${step}`; // neutral, success, error, warning, info
}

// ─── Step list resolver ────────────────────────────────────────────────────

const STEPS_FOR: Record<string, string[]> = { neutral: NEUTRAL_STEPS };
const stepsFor = (ramp: keyof RampSet) => STEPS_FOR[ramp] ?? HUE_STEPS;

// ─── Semantic tables ───────────────────────────────────────────────────────
//
// Remap decisions for legacy feedback/action tokens:
//
//   OLD                     NEW RAMP
//   color-swiss-red-*    →  error    (hue ~25)
//   color-vermillion-*   →  warning  (hue ~70)
//   color-pink-*/sky-*
//   used for success     →  success  (hue ~150)
//   color-sky-* for info →  info     (hue ~240)
//   color-action-danger  →  error    (mirrors error ramp)
//
// Dark surface tokens reference color-neutral-dark-surface-{N} (Task 7
// derivations). They are emitted via PassthroughSpec so the output reference
// graph points to the correct Task 7 primitives when they are available.
//
// Retro/prism tokens are static passthroughs — the engine does not generate
// them; they arrive from the static primitives file.
//
// State dimension tokens (disabled-opacity, hover-intensity, active-intensity)
// are emitted as passthroughs to themselves since they carry numeric values,
// not colors, and the engine cannot re-derive them.

export const SEMANTICS_LIGHT: Record<string, SemanticSpec> = {
  // ── Backgrounds – surfaces ────────────────────────────────────────────
  "color-background-surface-default":   ref("neutral", "0"),
  "color-background-surface-sunken":    ref("neutral", "paper"),
  "color-background-surface-raised":    ref("neutral", "0"),
  "color-background-surface-overlay":   ref("neutral", "0"),
  "color-background-surface-backdrop":  ref("black-alpha", "48"),
  "color-background-surface-inverse":   ref("neutral", "900"),
  "color-background-surface-white":     ref("neutral", "0"),

  // ── Backgrounds – brand ───────────────────────────────────────────────
  "color-background-brand-primary":     ref("accent", "500"),
  "color-background-brand-secondary":   ref("secondary", "500"),
  "color-background-brand-tertiary":    ref("tertiary", "500"),

  // ── Backgrounds – neutral fills ──────────────────────────────────────
  "color-background-neutral-primary":   ref("neutral", "900"),
  "color-background-neutral-secondary": ref("neutral", "200"),
  "color-background-neutral-tertiary":  ref("neutral", "100"),

  // ── Backgrounds – misc ────────────────────────────────────────────────
  "color-background-marker":            ref("accent", "200"),
  "color-background-navbar":            ref("white-alpha", "48"),

  // ── Text ─────────────────────────────────────────────────────────────
  "color-text-emphasis":                ref("accent", "900"),
  "color-text-default":                 target("neutral", "0", "neutral", 4.5),
  "color-text-subtle":                  target("neutral", "0", "neutral", 4.5),
  "color-text-muted":                   target("neutral", "0", "neutral", 3),
  "color-text-inverse":                 ref("neutral", "50"),
  "color-text-accent":                  ref("accent", "700"),
  "color-text-link":                    ref("secondary", "700"),
  "color-text-annotation":              ref("secondary", "700"),
  "color-text-on-brand":                ref("neutral", "950"),
  "color-text-on-white":                ref("neutral", "800"),

  // ── Icons ─────────────────────────────────────────────────────────────
  "color-icon-black":                   ref("neutral", "900"),
  "color-icon-emphasis":                ref("neutral", "800"),
  "color-icon-default":                 ref("neutral", "650"),
  "color-icon-subtle":                  ref("neutral", "500"),
  "color-icon-muted":                   ref("neutral", "400"),
  "color-icon-inverse":                 ref("neutral", "0"),
  "color-icon-accent":                  ref("accent", "500"),
  "color-icon-on-brand":                ref("accent", "900"),

  // ── Borders ──────────────────────────────────────────────────────────
  "color-border-emphasis":              ref("black-alpha", "16"),
  "color-border-default":               ref("black-alpha", "12"),
  "color-border-subtle":                ref("black-alpha", "8"),
  "color-border-gridlines":             ref("black-alpha", "8"),
  "color-border-white":                 ref("neutral", "50"),
  "color-border-interactive-frame":     ref("secondary", "500"),
  "color-border-brand-primary":         ref("accent", "400"),
  "color-border-brand-secondary":       ref("accent", "100"),

  // ── Controls ─────────────────────────────────────────────────────────
  "color-control-background-default":       ref("neutral", "0"),
  "color-control-background-tinted":        ref("neutral", "200"),
  "color-control-background-tintent-brand": ref("accent", "50"),
  "color-control-background-translucent":   ref("white-alpha", "24"),
  "color-control-background-disabled":      ref("neutral", "200"),
  "color-control-border-default":           ref("neutral", "300"),
  "color-control-border-hover":             ref("neutral", "400"),
  "color-control-border-focus":             ref("accent", "400"),
  "color-control-border-error":             ref("error", "500"),

  // ── Actions – primary (accent) ────────────────────────────────────────
  "color-action-primary-background":    ref("accent", "500"),
  "color-action-primary-on-bg":         ref("neutral", "0"),
  "color-action-primary-text":          ref("accent", "700"),
  "color-action-primary-icon":          ref("accent", "500"),
  "color-action-primary-border":        ref("accent", "500"),

  // ── Actions – secondary (sky) ─────────────────────────────────────────
  "color-action-secondary-background":  ref("secondary", "500"),
  "color-action-secondary-on-bg":       ref("neutral", "0"),
  "color-action-secondary-text":        ref("secondary", "700"),
  "color-action-secondary-icon":        ref("secondary", "500"),
  "color-action-secondary-border":      ref("secondary", "500"),

  // ── Actions – tertiary (pink) ─────────────────────────────────────────
  "color-action-tertiary-background":   ref("tertiary", "500"),
  "color-action-tertiary-on-bg":        ref("neutral", "0"),
  "color-action-tertiary-text":         ref("tertiary", "700"),
  "color-action-tertiary-icon":         ref("tertiary", "500"),
  "color-action-tertiary-border":       ref("tertiary", "500"),

  // ── Actions – neutral ─────────────────────────────────────────────────
  "color-action-neutral-background":    ref("neutral", "900"),
  "color-action-neutral-on-bg":         ref("neutral", "50"),
  "color-action-neutral-text":          ref("neutral", "800"),
  "color-action-neutral-icon":          ref("neutral", "800"),
  "color-action-neutral-border":        ref("neutral", "700"),

  // ── Actions – white ───────────────────────────────────────────────────
  "color-action-white-background":      ref("neutral", "0"),
  "color-action-white-on-bg":           ref("neutral", "900"),
  "color-action-white-text":            ref("neutral", "0"),
  "color-action-white-icon":            ref("neutral", "0"),
  "color-action-white-border":          ref("neutral", "0"),

  // ── Actions – danger (→ error ramp) ───────────────────────────────────
  "color-action-danger-background":     ref("error", "500"),
  "color-action-danger-on-bg":          ref("neutral", "0"),
  "color-action-danger-text":           ref("error", "700"),
  "color-action-danger-icon":           ref("error", "700"),
  "color-action-danger-border":         ref("error", "400"),

  // ── Feedback – success (→ success ramp) ───────────────────────────────
  "color-feedback-success-background":  ref("success", "500"),
  "color-feedback-success-on-bg":       ref("neutral", "0"),
  "color-feedback-success-text":        ref("success", "700"),
  "color-feedback-success-icon":        ref("success", "500"),
  "color-feedback-success-border":      ref("success", "400"),

  // ── Feedback – warning (→ warning ramp) ───────────────────────────────
  "color-feedback-warning-background":  ref("warning", "100"),
  "color-feedback-warning-on-bg":       ref("neutral", "950"),
  "color-feedback-warning-text":        ref("warning", "700"),
  "color-feedback-warning-icon":        ref("warning", "700"),
  "color-feedback-warning-border":      ref("warning", "400"),

  // ── Feedback – error (→ error ramp) ───────────────────────────────────
  "color-feedback-error-background":    ref("error", "100"),
  "color-feedback-error-on-bg":         ref("neutral", "0"),
  "color-feedback-error-text":          ref("error", "700"),
  "color-feedback-error-icon":          ref("error", "700"),
  "color-feedback-error-border":        ref("error", "400"),

  // ── Feedback – info (→ info ramp) ─────────────────────────────────────
  "color-feedback-info-background":     ref("info", "500"),
  "color-feedback-info-on-bg":          ref("neutral", "0"),
  "color-feedback-info-text":           ref("info", "700"),
  "color-feedback-info-icon":           ref("info", "500"),
  "color-feedback-info-border":         ref("info", "400"),

  // ── State ─────────────────────────────────────────────────────────────
  "color-state-focus-ring":             ref("accent", "300"),
  "color-state-focus-ring-offset":      ref("neutral", "0"),
  "color-state-checked":                ref("accent", "500"),
  // Dimension/numeric tokens — emitted as literal DTCG objects (not color refs)
  "color-state-disabled-opacity":       raw(0.5),
  "color-state-hover-intensity":        raw(0.9200000166893005),
  "color-state-active-intensity":       raw(0.8500000238418579),

  // ── Retro / prism (static passthrough) ───────────────────────────────
  "color-retro-green":                  pass("color-prism-green"),
  "color-retro-yellow":                 pass("color-prism-yellow"),
  "color-retro-orange":                 pass("color-prism-orange"),
  "color-retro-red":                    pass("color-prism-red"),
  "color-retro-magenta":                pass("color-prism-magenta"),
  "color-retro-purple":                 pass("color-prism-purple"),
  "color-retro-blue":                   pass("color-prism-blue"),
  "color-retro-cyan":                   pass("color-prism-cyan"),

  // ── Misc ──────────────────────────────────────────────────────────────
  "color-circled-marker":               pass("color-prism-yellow"),
};

export const SEMANTICS_DARK: Record<string, SemanticSpec> = {
  // ── Backgrounds – surfaces ────────────────────────────────────────────
  // Dark surfaces use Task 7 neutral-dark-surface derivations; emitted as
  // passthroughs so the reference graph links to the correct Task 7 primitives.
  "color-background-surface-default":   pass("color-neutral-dark-surface-2"),
  "color-background-surface-sunken":    pass("color-neutral-dark-surface-1"),
  "color-background-surface-raised":    pass("color-neutral-dark-surface-3"),
  "color-background-surface-overlay":   pass("color-neutral-dark-surface-4"),
  "color-background-surface-backdrop":  ref("black-alpha", "48"),
  "color-background-surface-inverse":   ref("neutral", "0"),
  "color-background-surface-white":     ref("neutral", "0"),

  // ── Backgrounds – brand ───────────────────────────────────────────────
  "color-background-brand-primary":     ref("accent", "500"),
  "color-background-brand-secondary":   ref("secondary", "500"),
  "color-background-brand-tertiary":    ref("tertiary", "500"),

  // ── Backgrounds – neutral fills ──────────────────────────────────────
  "color-background-neutral-primary":   ref("neutral", "100"),
  "color-background-neutral-secondary": ref("neutral", "800"),
  "color-background-neutral-tertiary":  ref("neutral", "900"),

  // ── Backgrounds – misc ────────────────────────────────────────────────
  "color-background-marker":            ref("accent", "700"),
  "color-background-navbar":            ref("black-alpha", "48"),

  // ── Text ─────────────────────────────────────────────────────────────
  "color-text-emphasis":                ref("neutral", "50"),
  // Dark text targets use neutral-dark-surface-2 as the surface
  // resolveOnSurface picks the right step at runtime; surface is approximated
  // by neutral-950 (the closest ramp step to dark-surface-2)
  "color-text-default":                 target("neutral", "950", "neutral", 4.5),
  "color-text-subtle":                  target("neutral", "950", "neutral", 4.5),
  "color-text-muted":                   target("neutral", "950", "neutral", 3),
  "color-text-inverse":                 ref("neutral", "950"),
  "color-text-accent":                  ref("accent", "500"),
  "color-text-link":                    ref("secondary", "500"),
  "color-text-annotation":              ref("secondary", "500"),
  "color-text-on-brand":                ref("neutral", "950"),
  "color-text-on-white":                ref("neutral", "800"),

  // ── Icons ─────────────────────────────────────────────────────────────
  "color-icon-black":                   ref("neutral", "900"),
  "color-icon-emphasis":                ref("neutral", "200"),
  "color-icon-default":                 ref("neutral", "300"),
  "color-icon-subtle":                  ref("neutral", "500"),
  "color-icon-muted":                   ref("neutral", "300"),
  "color-icon-inverse":                 ref("neutral", "0"),
  "color-icon-accent":                  ref("accent", "500"),
  "color-icon-on-brand":                ref("accent", "900"),

  // ── Borders ──────────────────────────────────────────────────────────
  "color-border-emphasis":              ref("white-alpha", "32"),
  "color-border-default":               ref("white-alpha", "24"),
  "color-border-subtle":                ref("white-alpha", "12"),
  "color-border-gridlines":             ref("white-alpha", "8"),
  "color-border-white":                 ref("neutral", "50"),
  "color-border-interactive-frame":     ref("secondary", "500"),
  "color-border-brand-primary":         ref("accent", "500"),
  "color-border-brand-secondary":       ref("accent", "700"),

  // ── Controls ─────────────────────────────────────────────────────────
  "color-control-background-default":       ref("neutral", "0"),
  "color-control-background-tinted":        ref("neutral", "800"),
  "color-control-background-tintent-brand": ref("accent", "900"),
  "color-control-background-translucent":   ref("white-alpha", "24"),
  "color-control-background-disabled":      ref("neutral", "800"),
  "color-control-border-default":           ref("neutral", "300"),
  "color-control-border-hover":             ref("neutral", "400"),
  "color-control-border-focus":             ref("accent", "400"),
  "color-control-border-error":             ref("error", "400"),

  // ── Actions – primary (accent) ────────────────────────────────────────
  "color-action-primary-background":    ref("accent", "500"),
  "color-action-primary-on-bg":         ref("neutral", "0"),
  "color-action-primary-text":          ref("accent", "500"),
  "color-action-primary-icon":          ref("accent", "500"),
  "color-action-primary-border":        ref("accent", "500"),

  // ── Actions – secondary (sky) ─────────────────────────────────────────
  "color-action-secondary-background":  ref("secondary", "500"),
  "color-action-secondary-on-bg":       ref("neutral", "0"),
  "color-action-secondary-text":        ref("secondary", "500"),
  "color-action-secondary-icon":        ref("secondary", "500"),
  "color-action-secondary-border":      ref("secondary", "500"),

  // ── Actions – tertiary (pink) ─────────────────────────────────────────
  "color-action-tertiary-background":   ref("tertiary", "500"),
  "color-action-tertiary-on-bg":        ref("neutral", "0"),
  "color-action-tertiary-text":         ref("tertiary", "500"),
  "color-action-tertiary-icon":         ref("tertiary", "500"),
  "color-action-tertiary-border":       ref("tertiary", "500"),

  // ── Actions – neutral ─────────────────────────────────────────────────
  "color-action-neutral-background":    ref("neutral", "50"),
  "color-action-neutral-on-bg":         ref("neutral", "900"),
  "color-action-neutral-text":          ref("neutral", "200"),
  "color-action-neutral-icon":          ref("neutral", "200"),
  "color-action-neutral-border":        ref("neutral", "400"),

  // ── Actions – white ───────────────────────────────────────────────────
  "color-action-white-background":      ref("neutral", "0"),
  "color-action-white-on-bg":           ref("neutral", "900"),
  "color-action-white-text":            ref("neutral", "0"),
  "color-action-white-icon":            ref("neutral", "0"),
  "color-action-white-border":          ref("neutral", "0"),

  // ── Actions – danger (→ error ramp) ───────────────────────────────────
  "color-action-danger-background":     ref("error", "500"),
  "color-action-danger-on-bg":          ref("neutral", "0"),
  "color-action-danger-text":           ref("error", "400"),
  "color-action-danger-icon":           ref("error", "400"),
  "color-action-danger-border":         ref("error", "300"),

  // ── Feedback – success (→ success ramp) ───────────────────────────────
  "color-feedback-success-background":  ref("success", "500"),
  "color-feedback-success-on-bg":       ref("neutral", "0"),
  "color-feedback-success-text":        ref("success", "400"),
  "color-feedback-success-icon":        ref("success", "400"),
  "color-feedback-success-border":      ref("success", "400"),

  // ── Feedback – warning (→ warning ramp) ───────────────────────────────
  "color-feedback-warning-background":  ref("warning", "900"),
  "color-feedback-warning-on-bg":       ref("neutral", "950"),
  "color-feedback-warning-text":        ref("warning", "400"),
  "color-feedback-warning-icon":        ref("warning", "400"),
  "color-feedback-warning-border":      ref("warning", "400"),

  // ── Feedback – error (→ error ramp) ───────────────────────────────────
  "color-feedback-error-background":    ref("error", "900"),
  "color-feedback-error-on-bg":         ref("neutral", "0"),
  "color-feedback-error-text":          ref("error", "400"),
  "color-feedback-error-icon":          ref("error", "400"),
  "color-feedback-error-border":        ref("error", "300"),

  // ── Feedback – info (→ info ramp) ─────────────────────────────────────
  "color-feedback-info-background":     ref("info", "500"),
  "color-feedback-info-on-bg":          ref("neutral", "0"),
  "color-feedback-info-text":           ref("info", "400"),
  "color-feedback-info-icon":           ref("info", "500"),
  "color-feedback-info-border":         ref("info", "400"),

  // ── State ─────────────────────────────────────────────────────────────
  "color-state-focus-ring":             ref("accent", "400"),
  "color-state-focus-ring-offset":      ref("neutral", "0"),
  "color-state-checked":                ref("accent", "500"),
  // Dimension/numeric tokens — emitted as literal DTCG objects (not color refs)
  "color-state-disabled-opacity":       raw(0.5),
  "color-state-hover-intensity":        raw(1.0499999523162842),
  "color-state-active-intensity":       raw(1.100000023841858),

  // ── Retro / prism (static passthrough) ───────────────────────────────
  "color-retro-green":                  pass("color-prism-green"),
  "color-retro-yellow":                 pass("color-prism-yellow"),
  "color-retro-orange":                 pass("color-prism-orange"),
  "color-retro-red":                    pass("color-prism-red"),
  "color-retro-magenta":                pass("color-prism-magenta"),
  "color-retro-purple":                 pass("color-prism-purple"),
  "color-retro-blue":                   pass("color-prism-blue"),
  "color-retro-cyan":                   pass("color-prism-cyan"),

  // ── Misc ──────────────────────────────────────────────────────────────
  "color-circled-marker":               pass("color-prism-yellow"),
};

// ─── Resolver ─────────────────────────────────────────────────────────────

export function resolveSemantics(
  ramps: RampSet,
  inputs: ThemeInputs,
  mode: "light" | "dark",
): Record<string, ResolvedToken> {
  const table = mode === "light" ? SEMANTICS_LIGHT : SEMANTICS_DARK;
  const k = resolveContrast(inputs.contrast);
  const out: Record<string, ResolvedToken> = {};

  for (const [name, spec] of Object.entries(table)) {
    if (spec.kind === "raw") {
      out[name] = { raw: spec.token };
    } else if (spec.kind === "passthrough") {
      out[name] = { ref: spec.name };
    } else if (spec.kind === "ref") {
      out[name] = { ref: nameFor(spec.ramp, spec.step) };
    } else {
      // target: contrast-resolved ref
      const surface = ramps[spec.onRamp][spec.onStep];
      const min = targetFor(spec.min, k);
      const step = resolveOnSurface(
        ramps[spec.ramp],
        surface,
        min,
        stepsFor(spec.ramp),
      );
      // Emit as a reference to the resolved step — keeps the SD var() graph intact.
      out[name] = { ref: nameFor(spec.ramp, step) };
    }
  }
  return out;
}
