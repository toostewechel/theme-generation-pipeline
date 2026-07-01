import { Panel, PanelSection, Switch } from "@ui";
import { SunIcon, MoonIcon } from "@phosphor-icons/react";
import type { ThemeInputs, HueSeed, Oklch } from "@project/src/engine/index.js";
import { Section } from "./Section.js";
import { SeedControl } from "./SeedControl.js";
import { NumericControl } from "./NumericControl.js";
import {
  isSectionModified, resetSection, presentAccentSlots, accentCount,
  addAccent, removeAccent, type SectionKey,
} from "../lib/theme-state.js";

interface SidebarProps {
  state: ThemeInputs;
  baseline: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
  onChange: (next: ThemeInputs) => void;
  onModeToggle: () => void;
  onShowContrastChange: (next: boolean) => void;
  onSave: () => void;
  onCopyFigma: () => void;
  onResetAll: () => void;
}

const STATUS = ["success", "error", "warning", "info"] as const;

export function Sidebar(props: SidebarProps) {
  const {
    state, baseline, mode, showContrast, onChange, onModeToggle,
    onShowContrastChange, onSave, onCopyFigma, onResetAll,
  } = props;
  const mod = (s: SectionKey) => isSectionModified(s, state, baseline);
  const reset = (s: SectionKey) => onChange(resetSection(s, state, baseline));
  const contrast = typeof state.contrast === "number" ? state.contrast : 0.5;

  return (
    <Panel title="Color Studio" onResetControls={onResetAll}>
      <PanelSection>
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[color:var(--muted-foreground)]" style={{ fontSize: 11 }}>
            Tune the seeds — watch the theme rebuild live.
          </p>
          <button
            type="button"
            onClick={onModeToggle}
            aria-label="Toggle dark preview"
            title={mode === "dark" ? "Switch to light" : "Switch to dark"}
            className="inline-flex size-7 items-center justify-center rounded-md border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {mode === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>
        </div>
      </PanelSection>

      <Section id="foundation" title="Foundation"
        description="The gray and contrast every other color is built on"
        modified={mod("foundation")} onReset={() => reset("foundation")}>
        <SeedControl name="neutral" seed={state.neutral}
          onSeed={(seed) => onChange({ ...state, neutral: seed })} />
        <NumericControl name="Contrast" min={0} max={1} step={0.01} value={contrast}
          format={(v) => v.toFixed(2)}
          help="How far apart the light and dark steps sit. Higher = punchier, more separation."
          onValueChange={(v) => onChange({ ...state, contrast: v })} />
      </Section>

      <Section id="accents" title="Accents"
        description="Brand colors: each hue seeds a full tint & shade ramp"
        modified={mod("accents")} onReset={() => reset("accents")}>
        {presentAccentSlots(state).map((key, i, all) => (
          <SeedControl key={key} name={key} seed={state.accents[key]!}
            onSeed={(seed: HueSeed, source?: Oklch) =>
              onChange({
                ...state,
                accents: { ...state.accents, [key]: seed },
                ...(source ? { brand: { ...state.brand, [key]: source } } : {}),
              })
            }
            onRemove={key !== "primary" && i === all.length - 1 ? () => onChange(removeAccent(state)) : undefined}
          />
        ))}
        {accentCount(state) < 3 && (
          <button type="button" onClick={() => onChange(addAccent(state))}
            className="text-[color:var(--link)] text-xs font-medium hover:underline">
            + Add accent
          </button>
        )}
      </Section>

      <Section id="status" title="Status"
        description="Feedback colors: success, error, warning, info."
        modified={mod("status")} onReset={() => reset("status")}>
        {STATUS.map((key) => (
          <SeedControl key={key} name={key} seed={state.status[key]}
            onSeed={(seed) => onChange({ ...state, status: { ...state.status, [key]: seed } })} />
        ))}
      </Section>

      <Section id="darkSurfaces" title="Dark surfaces"
        description="How deep dark mode goes and layer seperation"
        modified={mod("darkSurfaces")} onReset={() => reset("darkSurfaces")}>
        <NumericControl name="Base depth" min={0.05} max={0.4} step={0.005}
          value={state.darkSurfaces!.base}
          format={(v) => `${Math.round(v * 100)}% light`}
          help="Lightness of the darkest surface (the page background). Lower is darker."
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, base: v } })} />
        <NumericControl name="Elevation step" min={0} max={0.08} step={0.002}
          value={state.darkSurfaces!.step}
          format={(v) => `+${(v * 100).toFixed(1)}% / level`}
          help="Lightness added per raised layer — more = stronger separation."
          onValueChange={(v) => onChange({ ...state, darkSurfaces: { ...state.darkSurfaces!, step: v } })} />
      </Section>

      <Section id="output" title="Output" description="Optional tokens & preview display">
        <Switch name="Alpha-over-white tokens" checked={!!state.alpha}
          onCheckedChange={(p) => onChange({ ...state, alpha: p })} />
        <Switch name="Contrast badges" checked={showContrast}
          onCheckedChange={onShowContrastChange} />
      </Section>

      <PanelSection actionGroup="primary">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onResetAll}
            className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            Reset all
          </button>
          <button type="button" onClick={onSave}
            className="ml-auto rounded-md bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)]">
            Save theme
          </button>
          <button type="button" onClick={onCopyFigma} aria-label="Copy for Figma"
            className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium">
            Figma
          </button>
        </div>
      </PanelSection>
    </Panel>
  );
}
