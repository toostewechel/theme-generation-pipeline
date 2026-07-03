import type { DesignMdData } from "./types.js";

export const SKELETON_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Shapes",
] as const;

const PLACEHOLDER = "<!-- authored by the generate-design-md skill -->";

/** Quote scalars that YAML would misread (leading #, colon+space, comma in flow maps). */
function scalar(value: string | number): string {
  if (typeof value === "number") return String(value);
  if (/^[A-Za-z0-9][A-Za-z0-9 ._%-]*$/.test(value) || /^-?\d/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function emitFrontMatter(data: DesignMdData): string {
  const lines: string[] = ["---", `name: ${scalar(data.name)}`];

  lines.push("colors:");
  for (const [slot, hex] of Object.entries(data.colors)) {
    lines.push(`  ${slot}: "${hex}"`);
  }

  lines.push("typography:");
  for (const [slot, t] of Object.entries(data.typography)) {
    const props = [
      `fontFamily: ${scalar(t.fontFamily)}`,
      `fontSize: ${scalar(t.fontSize)}`,
      `fontWeight: ${t.fontWeight}`,
      `lineHeight: ${scalar(t.lineHeight)}`,
      `letterSpacing: ${scalar(t.letterSpacing)}`,
    ];
    lines.push(`  ${slot}: { ${props.join(", ")} }`);
  }

  lines.push("rounded:");
  for (const [slot, v] of Object.entries(data.rounded)) {
    lines.push(`  ${slot}: ${scalar(v)}`);
  }

  lines.push("spacing:");
  for (const [slot, v] of Object.entries(data.spacing)) {
    lines.push(`  ${slot}: ${scalar(v)}`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function skeletonBody(): string {
  return SKELETON_SECTIONS.map((s) => `## ${s}\n\n${PLACEHOLDER}\n`).join("\n");
}

const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n/;

export function mergeDesignMd(
  existing: string | null,
  data: DesignMdData,
  opts: { force?: boolean } = {},
): string {
  const frontMatter = emitFrontMatter(data);
  if (existing === null || opts.force) {
    return `${frontMatter}\n${skeletonBody()}`;
  }
  if (!FRONT_MATTER_RE.test(existing)) {
    throw new Error(
      "Existing file has no leading YAML front matter block; refusing to overwrite (use --force to regenerate)",
    );
  }
  return existing.replace(FRONT_MATTER_RE, frontMatter);
}
