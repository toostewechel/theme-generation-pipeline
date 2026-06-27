import { useEffect, useRef, useState } from "react";
import { oklch } from "culori";
import type { HueSeed, Oklch } from "@project/src/engine/index.js";
import { ParamSlider } from "./ParamSlider.js";
import { hexOf, parseHex, hueTrack, chromaTrack, swatchCss, REP_L } from "../lib/controls-math.js";

interface SeedControlProps {
  name: string;
  seed: HueSeed;
  // `source` (the verbatim brand color) is emitted ONLY on a hex paste. Slider
  // tuning reshapes the ramp seed and emits no source, so a brand color set by
  // an earlier paste stays pinned.
  onSeed: (seed: HueSeed, source?: Oklch) => void;
  /** When provided, render a remove (✕) button in the seed header. */
  onRemove?: () => void;
}

export function SeedControl({ name, seed, onSeed, onRemove }: SeedControlProps) {
  // displayL echoes a pasted hex's lightness; it never affects generation.
  const [displayL, setDisplayL] = useState(REP_L);
  const [hexBad, setHexBad] = useState(false);
  const badTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hexValue = hexOf(seed.hue, seed.chroma, displayL);

  useEffect(() => () => { if (badTimer.current) clearTimeout(badTimer.current); }, []);

  // Pass `source` straight through: undefined for slider tuning (brand untouched),
  // the exact parsed color for a paste. No swatch-derived fallback — that would
  // overwrite the pinned brand color on every drag.
  const emit = (next: HueSeed, source?: Oklch) => onSeed(next, source);

  const onHexCommit = (raw: string) => {
    const parsed = parseHex(raw);
    const exact = oklch(raw.trim());
    if (!parsed || !exact) {
      setHexBad(true);
      if (badTimer.current) clearTimeout(badTimer.current);
      badTimer.current = setTimeout(() => setHexBad(false), 900);
      return;
    }
    setDisplayL(parsed.l);
    // exact.l! is safe: culori's oklch() always populates l on a non-null result (guarded by !exact above).
    emit({ hue: parsed.hue, chroma: parsed.chroma }, { l: exact.l!, c: exact.c ?? 0, h: exact.h ?? 0 });
  };

  return (
    <div className="seed">
      <div className="seed-head">
        <span className="swatch"><i style={{ background: swatchCss(displayL, seed.hue, seed.chroma) }} /></span>
        <span className="seed-name">{name}</span>
        <input
          className={"hex" + (hexBad ? " hex--bad" : "")}
          type="text" spellCheck={false} defaultValue={hexValue} key={hexValue}
          onBlur={(e) => onHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          title="Paste a brand hex — hue & chroma seed the ramp; the lightness shown just echoes your paste"
        />
        {onRemove && (
          <button
            type="button"
            className="seed-remove"
            onClick={onRemove}
            aria-label={`Remove ${name} accent`}
            title={`Remove ${name} accent`}
          >
            ×
          </button>
        )}
      </div>
      <ParamSlider
        name="Hue" min={0} max={360} step={1} value={seed.hue}
        trackStyle={hueTrack()} format={(v) => `${v}°`} editable
        help="Drag right to walk the color wheel — warm reds → greens → cool blues."
        onValueChange={(v) => emit({ hue: v, chroma: seed.chroma })}
      />
      <ParamSlider
        name="Chroma" min={0} max={0.3} step={0.005} value={seed.chroma}
        trackStyle={chromaTrack(seed.hue)} format={(v) => v.toFixed(3)} editable
        help="Drag right for more vivid; left fades toward gray."
        onValueChange={(v) => emit({ hue: seed.hue, chroma: v })}
      />
    </div>
  );
}
