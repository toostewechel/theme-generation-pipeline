import { Slider } from "@base-ui-components/react/slider";
import { NumberField } from "@base-ui-components/react/number-field";
import { Tooltip } from "@base-ui-components/react/tooltip";

interface ParamSliderProps {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
  trackStyle?: string;
  format?: (v: number) => string;
  editable?: boolean;
  help?: string;
  description?: string;
  ticks?: { pos: number; label: string }[];
}

export function ParamSlider(props: ParamSliderProps) {
  const {
    name,
    min,
    max,
    step,
    value,
    onValueChange,
    trackStyle,
    format = String,
    editable,
    help,
    description,
    ticks,
  } = props;

  return (
    <div className="ctl">
      <div className="ctl-top">
        <span className="ctl-name">{name}</span>
        {help && (
          <Tooltip.Root>
            <Tooltip.Trigger className="ctl-help" aria-label={`${name} help`}>
              ?
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="top" sideOffset={6}>
                <Tooltip.Popup className="tooltip">{help}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <span className="ctl-val">
          {editable ? (
            <NumberField.Root
              value={value}
              min={min}
              max={max}
              step={step}
              onValueChange={(v) => v != null && onValueChange(v)}
            >
              <NumberField.Group>
                <NumberField.Input className="vbox" />
              </NumberField.Group>
            </NumberField.Root>
          ) : (
            <span className="vbox">{format(value)}</span>
          )}
        </span>
      </div>
      {description && <p className="ctl-desc">{description}</p>}
      <Slider.Root
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onValueChange(v)}
      >
        <Slider.Control
          className={trackStyle ? "track track--gradient" : "track track--plain"}
          style={trackStyle ? { backgroundImage: trackStyle } : undefined}
        >
          <Slider.Track>
            {ticks?.map((t) => (
              <span
                key={t.label}
                className="tick"
                style={{ left: `${t.pos * 100}%` }}
              />
            ))}
            <Slider.Thumb className="thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      {ticks && (
        <div className="tick-row">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="tick-lbl"
              style={{ left: `${t.pos * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
