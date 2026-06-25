import { Toggle } from "@base-ui-components/react/toggle";
import { Tooltip } from "@base-ui-components/react/tooltip";
import type { ThemeInputs, HueSeed, Oklch } from "@project/src/engine/index.js";
import { Section } from "./Section.js";
import { SeedControl } from "./SeedControl.js";
import { ParamSlider } from "./ParamSlider.js";
import { FigmaIcon } from "./FigmaIcon.js";
import { IconSun, IconMoon, IconReset } from "./icons.js";
import {
  isSectionModified,
  resetSection,
  type SectionKey,
} from "../lib/theme-state.js";

interface SidebarProps {
  state: ThemeInputs;
  baseline: ThemeInputs;
  mode: "light" | "dark";
  onChange: (next: ThemeInputs) => void;
  onModeToggle: () => void;
  onSave: () => void;
  onCopyFigma: () => void;
  onResetAll: () => void;
}

const ACCENTS = ["primary", "secondary", "tertiary"] as const;
const STATUS = ["success", "error", "warning", "info"] as const;

export function Sidebar(props: SidebarProps) {
  const {
    state,
    baseline,
    mode,
    onChange,
    onModeToggle,
    onSave,
    onCopyFigma,
    onResetAll,
  } = props;
  const mod = (s: SectionKey) => isSectionModified(s, state, baseline);
  const reset = (s: SectionKey) => onChange(resetSection(s, state, baseline));
  const contrast = typeof state.contrast === "number" ? state.contrast : 0.5;

  return (
    <aside id="sidebar">
      <div className="head">
        <div>
          <h1>Color Studio</h1>
          <p>Tune the seeds — watch the theme rebuild live.</p>
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Toggle
                pressed={mode === "dark"}
                onPressedChange={onModeToggle}
                className="mode-toggle"
                aria-label="Toggle dark preview"
              >
                {mode === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
              </Toggle>
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="bottom" sideOffset={6}>
              <Tooltip.Popup className="tooltip">
                {mode === "dark" ? "Switch to light" : "Switch to dark"}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>

      <Section
        id="foundation"
        title="Foundation"
        description="The gray and contrast every other color is built on"
        modified={mod("foundation")}
        onReset={() => reset("foundation")}
      >
        <SeedControl
          name="neutral"
          seed={state.neutral}
          onSeed={(seed) => onChange({ ...state, neutral: seed })}
        />
        <ParamSlider
          name="Contrast"
          min={0}
          max={1}
          step={0.01}
          value={contrast}
          help="How far apart the light and dark steps sit. Higher = punchier, more separation."
          format={(v) => v.toFixed(2)}
          ticks={[
            { pos: 0.25, label: "low" },
            { pos: 0.5, label: "default" },
            { pos: 0.85, label: "high" },
          ]}
          onValueChange={(v) => onChange({ ...state, contrast: v })}
        />
      </Section>

      <Section
        id="accents"
        title="Accents"
        description="Brand colors: each hue seeds a full tint & shade ramp"
        modified={mod("accents")}
        onReset={() => reset("accents")}
      >
        {ACCENTS.map((key) => (
          <SeedControl
            key={key}
            name={key}
            seed={state.accents[key]}
            onSeed={(seed: HueSeed, source?: Oklch) =>
              onChange({
                ...state,
                accents: { ...state.accents, [key]: seed },
                // Brand is only rewritten on a paste (source present); slider tuning
                // leaves the pinned brand color intact.
                ...(source ? { brand: { ...state.brand, [key]: source } } : {}),
              })
            }
          />
        ))}
      </Section>

      <Section
        id="status"
        title="Status"
        description="Feedback colors: success, error, warning, info."
        modified={mod("status")}
        onReset={() => reset("status")}
      >
        {STATUS.map((key) => (
          <SeedControl
            key={key}
            name={key}
            seed={state.status[key]}
            onSeed={(seed) =>
              onChange({ ...state, status: { ...state.status, [key]: seed } })
            }
          />
        ))}
      </Section>

      <Section
        id="darkSurfaces"
        title="Dark surfaces"
        description="How deep dark mode goes and layer seperation"
        modified={mod("darkSurfaces")}
        onReset={() => reset("darkSurfaces")}
      >
        <ParamSlider
          name="Base depth"
          min={0.05}
          max={0.4}
          step={0.005}
          value={state.darkSurfaces!.base}
          description="Lightness of the darkest surface (the page background). Lower is darker."
          format={(v) => `${Math.round(v * 100)}% light`}
          onValueChange={(v) =>
            onChange({
              ...state,
              darkSurfaces: { ...state.darkSurfaces!, base: v },
            })
          }
        />
        <ParamSlider
          name="Elevation step"
          min={0}
          max={0.08}
          step={0.002}
          value={state.darkSurfaces!.step}
          description="Lightness added per raised layer — more = stronger separation."
          format={(v) => `+${(v * 100).toFixed(1)}% / level`}
          onValueChange={(v) =>
            onChange({
              ...state,
              darkSurfaces: { ...state.darkSurfaces!, step: v },
            })
          }
        />
      </Section>

      <div className="sec sec--output">
        <div className="sec-head sec-head--static">
          <span className="sec-chevron-slot" aria-hidden="true" />
          <span className="sec-title">Output</span>
        </div>
        <label className="alpha-toggle">
          <span className="alpha-toggle-text">
            <span className="alpha-toggle-title">Alpha-over-white tokens</span>
            <small>Emit translucent twins of every ramp step, matched over white.</small>
          </span>
          <Toggle
            pressed={!!state.alpha}
            onPressedChange={(p) => onChange({ ...state, alpha: p })}
            className="alpha-switch"
            aria-label="Toggle alpha-over-white tokens"
          />
        </label>
      </div>

      <div className="foot">
        <button
          className="btn btn--ghost"
          onClick={onResetAll}
          title="Reset everything to defaults"
        >
          <IconReset size={14} /> Reset all
        </button>
        <button className="btn btn--primary" onClick={onSave}>
          Save theme
        </button>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                className="btn btn--icon fig-btn"
                onClick={onCopyFigma}
                aria-label="Copy for Figma"
              >
                <FigmaIcon />
              </button>
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6}>
              <Tooltip.Popup className="tooltip">Copy for Figma</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </aside>
  );
}
