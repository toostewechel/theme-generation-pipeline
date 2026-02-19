import { getReferences } from "style-dictionary/utils";
import type {
  Format,
  FormatFnArguments,
  TransformedToken,
} from "style-dictionary/types";

const typographyPropertyMap: Record<string, string> = {
  fontFamily: "font-family",
  fontWeight: "font-weight",
  fontSize: "font-size",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  fontStyle: "font-style",
  textDecoration: "text-decoration",
  textTransform: "text-transform",
};

function resolvePropertyValue(
  refString: unknown,
  dictionary: FormatFnArguments["dictionary"],
  mixinName: string,
  camelKey: string,
): string {
  if (typeof refString !== "string") {
    return String(refString);
  }

  try {
    const refs = getReferences(
      refString,
      dictionary.unfilteredTokens ?? dictionary.tokens,
      { usesDtcg: true },
    );
    if (refs.length > 0) {
      return `var(--${refs[0].name})`;
    }
  } catch (e) {
    console.warn(
      `Could not resolve reference for ${mixinName}.${camelKey}: ${e}`,
    );
  }

  const match = refString.match(/^\{(.+)\}$/);
  if (match) {
    const varName = match[1].replace(/\./g, "-");
    return `var(--${varName})`;
  }

  return refString;
}

function buildMixin(
  token: TransformedToken,
  dictionary: FormatFnArguments["dictionary"],
): string {
  const mixinName = token.name;
  const originalValue = token.original.$value;

  if (typeof originalValue !== "object" || originalValue === null) {
    console.warn(
      `Skipping mixin "${mixinName}": expected object $value, got ${typeof originalValue}`,
    );
    return `// Warning: could not generate mixin for ${mixinName}`;
  }

  const properties = Object.entries(originalValue)
    .map(([camelKey, refString]) => {
      const cssProperty = typographyPropertyMap[camelKey];
      if (!cssProperty) {
        console.warn(
          `Unknown typography property "${camelKey}" in ${mixinName}`,
        );
        return null;
      }

      const value = resolvePropertyValue(
        refString,
        dictionary,
        mixinName,
        camelKey,
      );
      return `  ${cssProperty}: ${value};`;
    })
    .filter(Boolean)
    .join("\n");

  return `@mixin ${mixinName} {\n${properties}\n}`;
}

export const typographyMixinsFormat: Format = {
  name: "scss/typography-mixins",
  format: async ({ dictionary }: FormatFnArguments) => {
    const header =
      "// Do not edit directly, this file was auto-generated.\n\n";

    const typographyTokens = dictionary.allTokens.filter(
      (token) => token.$type === "typography",
    );

    const mixins = typographyTokens.map((token) =>
      buildMixin(token, dictionary),
    );

    return header + mixins.join("\n\n") + "\n";
  },
};
