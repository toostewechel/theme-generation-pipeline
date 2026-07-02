/**
 * Normalize a Figma variable name to the pipeline's flat token key.
 * `color/neutral/700` → `color-neutral-700`. This is the match key used to
 * update existing variables in place; it must be the inverse of any pretty
 * slash-path grouping applied on the Figma side.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
