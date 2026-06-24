export interface DriftReport {
  /** Names present in both Figma and the pipeline. */
  matched: string[];
  /** In Figma, not in the pipeline — new/renamed in Figma; reflect in engine or token files. */
  missingInPipeline: string[];
  /** In the pipeline, not in Figma — removed/renamed in Figma? */
  extraInPipeline: string[];
  /** Matched an ignore pattern; excluded from the drift buckets. */
  ignored: string[];
  /** True when missingInPipeline or extraInPipeline is non-empty. */
  hasDrift: boolean;
}

export function diffTokenNames(
  pipeline: Set<string>,
  figma: Set<string>,
  opts: { ignore?: (string | RegExp)[] } = {},
): DriftReport {
  const ignore = opts.ignore ?? [];
  const isIgnored = (name: string) =>
    ignore.some((p) => (typeof p === "string" ? p === name : p.test(name)));

  const matched: string[] = [];
  const missingInPipeline: string[] = [];
  const extraInPipeline: string[] = [];
  const ignored: string[] = [];

  for (const name of new Set([...pipeline, ...figma])) {
    if (isIgnored(name)) {
      ignored.push(name);
      continue;
    }
    const inPipeline = pipeline.has(name);
    const inFigma = figma.has(name);
    if (inPipeline && inFigma) matched.push(name);
    else if (inFigma) missingInPipeline.push(name);
    else extraInPipeline.push(name);
  }

  for (const arr of [matched, missingInPipeline, extraInPipeline, ignored]) arr.sort();

  return {
    matched,
    missingInPipeline,
    extraInPipeline,
    ignored,
    hasDrift: missingInPipeline.length + extraInPipeline.length > 0,
  };
}
