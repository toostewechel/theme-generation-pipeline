import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { emitFrontMatter, mergeDesignMd, SKELETON_SECTIONS } from "./emit.js";
import { extractDesignMdData } from "./extract.js";
import { loadTokenMap } from "./load-tokens.js";

const map = loadTokenMap({ colorMode: "light", radiusMode: "medium" });
const data = extractDesignMdData(map, {
  name: "Framna",
  mode: "light",
  radiusMode: "medium",
});

describe("emitFrontMatter", () => {
  const fm = emitFrontMatter(data);

  it("round-trips through a YAML parser", () => {
    const inner = fm.replace(/^---\n/, "").replace(/\n---\n$/, "");
    const parsed = parseYaml(inner) as Record<string, unknown>;
    expect(parsed.name).toBe("Framna");
    expect((parsed.colors as Record<string, string>).primary).toMatch(/^#/);
    const h1 = (parsed.typography as Record<string, Record<string, unknown>>).h1;
    expect(h1.fontFamily).toBe("Framna Serif");
    expect(h1.fontSize).toBe("4rem");
    expect((parsed.rounded as Record<string, string>).sm).toBe("3px");
    expect((parsed.spacing as Record<string, string>).md).toBe("16px");
  });

  it("double-quotes hex values so # is not parsed as a YAML comment", () => {
    expect(fm).toMatch(/primary: "#[0-9a-f]{6}/);
  });
});

describe("mergeDesignMd", () => {
  it("writes front matter plus skeleton body when no file exists", () => {
    const out = mergeDesignMd(null, data);
    expect(out.startsWith("---\n")).toBe(true);
    const headings = [...out.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([...SKELETON_SECTIONS]);
  });

  it("preserves an existing body byte-for-byte and replaces only front matter", () => {
    const original = mergeDesignMd(null, data);
    const authored = original.replace(
      /## Overview\n[^#]*/,
      "## Overview\n\nHand-written prose about Framna.\n\n",
    );
    const darkData = extractDesignMdData(
      loadTokenMap({ colorMode: "dark", radiusMode: "medium" }),
      { name: "Framna", mode: "dark", radiusMode: "medium" },
    );
    const merged = mergeDesignMd(authored, darkData);
    expect(merged).toContain("Hand-written prose about Framna.");
    const authoredBody = authored.replace(/^---\n[\s\S]*?\n---\n/, "");
    const mergedBody = merged.replace(/^---\n[\s\S]*?\n---\n/, "");
    expect(mergedBody).toBe(authoredBody);
    expect(merged).not.toBe(authored); // front matter did change
  });

  it("resets the body to the skeleton with force", () => {
    const original = mergeDesignMd(null, data);
    const authored = original.replace("## Overview", "## Overview\n\nProse.");
    const forced = mergeDesignMd(authored, data, { force: true });
    expect(forced).toBe(original);
  });

  it("throws on a file without a front matter block", () => {
    expect(() => mergeDesignMd("# not a design.md\n", data)).toThrowError(
      /front matter/i,
    );
  });
});
