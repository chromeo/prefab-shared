import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Apps import styles.css at the top of their stylesheet (CSS requires @import first). A rule
// outside an @layer then lands at the very top of the built CSS, where same-weight Tailwind
// component rules override it: that is how the 16px iPhone no-zoom rule silently lost to the
// 14px field rule in v1.1.0–v1.3.0. Every rule must sit inside an @layer.
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("styles.css", () => {
  it("keeps every rule inside an @layer", () => {
    let depth = 0;
    const outside = [];
    let token = "";
    for (const ch of css) {
      if (ch === "{") {
        if (depth === 0 && !/^\s*@layer\b/.test(token)) outside.push(token.trim());
        depth++;
        token = "";
      } else if (ch === "}") {
        depth--;
        token = "";
      } else if (depth === 0) token += ch;
    }
    expect(outside).toEqual([]);
  });

  it("sets 16px fields on phones after the field rules, inside the components layer", () => {
    const layer = css.slice(css.indexOf("@layer components"));
    expect(layer.indexOf("font-size: 16px")).toBeGreaterThan(layer.indexOf(".field input"));
  });
});
