import {
  type ComputedRadiusTable,
  type RadiusParams,
  type Size,
  type Mode,
  SIZES,
  MODES,
  computeAll,
} from "./compute.js";

// Palette — distinct, accessible on dark background
const MODE_COLORS: Record<Mode, string> = {
  sharp: "#a1a1aa",   // zinc
  default: "#60a5fa", // blue
  rounded: "#a78bfa", // violet
  pill: "#f472b6",    // pink
};

function round(v: number, decimals = 1): string {
  const factor = 10 ** decimals;
  return String(Math.round(v * factor) / factor);
}

function pxLabel(v: number): string {
  if (v >= 10000) return "full";
  return `${round(v)}px`;
}

// ─── Mode Columns (Component Previews) ──────────────────────────────

export function renderModeColumns(
  container: HTMLElement,
  computed: ComputedRadiusTable,
  params: RadiusParams,
  visibleModes: Set<Mode>,
): void {
  container.innerHTML = "";
  container.style.setProperty(
    "--visible-mode-count",
    String(visibleModes.size),
  );

  for (const mode of MODES) {
    if (!visibleModes.has(mode)) continue;

    const col = document.createElement("div");
    col.className = "mode-column";

    const data = computed[mode];

    // Header
    const header = document.createElement("div");
    header.className = "mode-header";
    header.innerHTML = `
      <span class="mode-name">${mode}</span>
      <span class="base-badge">base: ${pxLabel(data.base)}</span>
    `;
    col.appendChild(header);

    // Buttons — use adaptive values (matches real component: --radius-adaptive-*)
    // CSS naturally clamps radius to half the element height, so pill mode works
    col.appendChild(
      specimenGroup("Buttons (adaptive)", () => {
        const row = document.createElement("div");
        row.className = "specimen-row";
        for (const size of SIZES) {
          const btn = document.createElement("div");
          btn.className = `preview-btn preview-btn--${size}`;
          btn.style.borderRadius = `${data.adaptive[size]}px`;
          btn.textContent = size.toUpperCase();
          row.appendChild(btn);
        }
        const info = document.createElement("div");
        info.className = "specimen-value";
        info.textContent = SIZES.map(
          (s) => `${s}: ${pxLabel(data.adaptive[s])}`,
        ).join("  ");
        const wrap = document.createElement("div");
        wrap.appendChild(row);
        wrap.appendChild(info);
        return wrap;
      }),
    );

    // Card
    col.appendChild(
      specimenGroup("Card (geometric)", () => {
        const card = document.createElement("div");
        card.className = "preview-card";
        card.style.borderRadius = `${data.geometric.lg}px`;
        card.innerHTML = `
          <div class="preview-card-image" style="border-radius: ${data.geometric.lg}px ${data.geometric.lg}px 0 0"></div>
          <div class="preview-card-body">
            <div class="preview-card-title">Card Title</div>
            <div class="preview-card-text">Supporting text for the card component.</div>
          </div>
        `;
        const info = document.createElement("div");
        info.className = "specimen-value";
        info.textContent = `geometric-lg: ${pxLabel(data.geometric.lg)}`;
        const wrap = document.createElement("div");
        wrap.appendChild(card);
        wrap.appendChild(info);
        return wrap;
      }),
    );

    // Input
    col.appendChild(
      specimenGroup("Input (geometric)", () => {
        const input = document.createElement("div");
        input.className = "preview-input";
        input.style.borderRadius = `${data.geometric.md}px`;
        input.style.display = "flex";
        input.style.alignItems = "center";
        input.textContent = "Placeholder text...";
        const info = document.createElement("div");
        info.className = "specimen-value";
        info.textContent = `geometric-md: ${pxLabel(data.geometric.md)}`;
        const wrap = document.createElement("div");
        wrap.appendChild(input);
        wrap.appendChild(info);
        return wrap;
      }),
    );

    // Badge — single xs specimen
    col.appendChild(
      specimenGroup("Badge (adaptive)", () => {
        const row = document.createElement("div");
        row.className = "specimen-row";
        const badge = document.createElement("div");
        badge.className = "preview-badge";
        badge.style.borderRadius = `${data.adaptive.xs}px`;
        badge.textContent = "Label";
        row.appendChild(badge);
        const info = document.createElement("div");
        info.className = "specimen-value";
        info.textContent = `adaptive-xs: ${pxLabel(data.adaptive.xs)}`;
        const wrap = document.createElement("div");
        wrap.appendChild(row);
        wrap.appendChild(info);
        return wrap;
      }),
    );

    // Avatar — uses adaptive (typically fully rounded)
    col.appendChild(
      specimenGroup("Avatar (adaptive)", () => {
        const avatar = document.createElement("div");
        avatar.className = "preview-avatar";
        avatar.style.borderRadius = `${data.adaptive.xl}px`;
        const info = document.createElement("div");
        info.className = "specimen-value";
        info.textContent = `adaptive-xl: ${pxLabel(data.adaptive.xl)}`;
        const wrap = document.createElement("div");
        wrap.appendChild(avatar);
        wrap.appendChild(info);
        return wrap;
      }),
    );

    container.appendChild(col);
  }
}

function specimenGroup(
  label: string,
  buildContent: () => HTMLElement,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "specimen-group";
  const lbl = document.createElement("div");
  lbl.className = "specimen-group-label";
  lbl.textContent = label;
  group.appendChild(lbl);
  group.appendChild(buildContent());
  return group;
}

// ─── Values Table ───────────────────────────────────────────────────

export function renderValuesTable(
  container: HTMLElement,
  computed: ComputedRadiusTable,
  visibleModes: Set<Mode>,
): void {
  const modes = MODES.filter((m) => visibleModes.has(m));
  if (modes.length === 0) {
    container.innerHTML = "";
    return;
  }

  const table = document.createElement("table");
  table.className = "values-table";

  // Header row 1: mode names spanning 2 columns each
  const thead = document.createElement("thead");
  const headerRow1 = document.createElement("tr");
  headerRow1.innerHTML = `<th rowspan="2">Size</th>`;
  for (const mode of modes) {
    const th = document.createElement("th");
    th.colSpan = 2;
    th.className = "mode-group";
    th.textContent = mode;
    headerRow1.appendChild(th);
  }
  thead.appendChild(headerRow1);

  // Header row 2: adaptive / geometric sub-headers
  const headerRow2 = document.createElement("tr");
  for (const _mode of modes) {
    headerRow2.innerHTML += `<th>Adaptive</th><th>Geometric</th>`;
  }
  thead.appendChild(headerRow2);
  table.appendChild(thead);

  // Body: base row + size rows
  const tbody = document.createElement("tbody");

  // Base row
  const baseRow = document.createElement("tr");
  baseRow.innerHTML = `<td>base</td>`;
  for (const mode of modes) {
    const td = document.createElement("td");
    td.colSpan = 2;
    td.style.textAlign = "center";
    td.textContent = pxLabel(computed[mode].base);
    baseRow.appendChild(td);
  }
  tbody.appendChild(baseRow);

  // Size rows
  for (const size of SIZES) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${size}</td>`;
    for (const mode of modes) {
      const adaptive = computed[mode].adaptive[size];
      const geometric = computed[mode].geometric[size];
      const isCapped = geometric < adaptive;

      const tdA = document.createElement("td");
      tdA.textContent = pxLabel(adaptive);
      row.appendChild(tdA);

      const tdG = document.createElement("td");
      tdG.textContent = pxLabel(geometric);
      if (isCapped) tdG.className = "capped";
      row.appendChild(tdG);
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

// ─── Graph (Grouped Bar Chart) ──────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderGraph(
  container: HTMLElement,
  legendContainer: HTMLElement,
  computed: ComputedRadiusTable,
): void {
  container.innerHTML = "";
  legendContainer.innerHTML = "";

  // Use geometric values only (adaptive pill values would break the scale)
  const modes = MODES;

  // Find max geometric value (excluding pill which is always capped anyway)
  let yMax = 0;
  for (const mode of modes) {
    for (const size of SIZES) {
      yMax = Math.max(yMax, computed[mode].geometric[size]);
    }
  }
  if (yMax === 0) yMax = 1;
  yMax = yMax * 1.15; // padding

  const W = 360;
  const H = 160;
  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const groupWidth = plotW / SIZES.length;
  const barWidth = (groupWidth * 0.7) / modes.length;
  const groupPad = groupWidth * 0.15;

  const toY = (px: number) =>
    pad.top + plotH - (Math.min(px, yMax) / yMax) * plotH;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Horizontal grid lines
  const yTicks = niceSteps(0, yMax, 4);
  for (const tick of yTicks) {
    const y = toY(tick);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(pad.left));
    line.setAttribute("x2", String(W - pad.right));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "#27272a");
    line.setAttribute("stroke-width", "0.5");
    svg.appendChild(line);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(pad.left - 4));
    label.setAttribute("y", String(y + 3));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "#52525b");
    label.setAttribute("font-size", "8");
    label.setAttribute("font-family", "var(--font-mono)");
    label.textContent = `${Math.round(tick)}`;
    svg.appendChild(label);
  }

  // Bars per size group
  SIZES.forEach((size, sizeIdx) => {
    const groupX = pad.left + sizeIdx * groupWidth + groupPad;

    modes.forEach((mode, modeIdx) => {
      const val = computed[mode].geometric[size];
      const x = groupX + modeIdx * barWidth;
      const y = toY(val);
      const h = pad.top + plotH - y;

      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(barWidth - 1));
      rect.setAttribute("height", String(Math.max(h, 0)));
      rect.setAttribute("fill", MODE_COLORS[mode]);
      rect.setAttribute("rx", "1.5");
      svg.appendChild(rect);
    });

    // Size label
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute(
      "x",
      String(groupX + (modes.length * barWidth) / 2),
    );
    label.setAttribute("y", String(H - 6));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#52525b");
    label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "var(--font-mono)");
    label.textContent = size;
    svg.appendChild(label);
  });

  container.appendChild(svg);

  // Legend
  for (const mode of modes) {
    const item = document.createElement("div");
    item.className = "graph-legend-item";
    item.innerHTML = `<span class="graph-legend-swatch" style="background:${MODE_COLORS[mode]}"></span><span class="graph-legend-label">${mode}</span>`;
    legendContainer.appendChild(item);
  }
}

function niceSteps(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [0];
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice =
    rough / mag >= 5 ? 10 * mag : rough / mag >= 2 ? 5 * mag : 2 * mag;
  const ticks: number[] = [];
  let tick = Math.ceil(min / nice) * nice;
  while (tick <= max) {
    ticks.push(tick);
    tick += nice;
  }
  return ticks;
}

// ─── CSS Output ─────────────────────────────────────────────────────

import { generateCSS } from "./compute.js";

export function renderCSSOutput(
  container: HTMLElement,
  params: RadiusParams,
): void {
  container.textContent = generateCSS(params);
}
