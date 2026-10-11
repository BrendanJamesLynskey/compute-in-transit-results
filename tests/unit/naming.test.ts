/**
 * The naming rule on the sources: nothing the site is built from, serves
 * or vendors names the module's developer company (CI runs the same check
 * on the build output, `pnpm naming`).
 */
import { describe, expect, it } from "vitest";

// @ts-expect-error: a plain ES module script, no types
import { hits, scan } from "../../scripts/check-naming.mjs";

describe("naming", () => {
  it("the checker finds the name in any case, and only the name", () => {
    // the name is assembled from its letters' codes so this file does not contain it
    const name = String.fromCharCode(79, 112, 116, 97, 108, 121, 115, 121, 115);
    expect(hits(`a ${name} b`)).toEqual([2]);
    expect(hits(`x${name.toUpperCase()}.com`)).toEqual([1]);
    expect(hits("a photonic link module (arXiv:2608.21536)")).toEqual([]);
  });
  it("no source, public or vendored file names the company", () => {
    const r = scan([
      "src",
      "public",
      "scripts",
      "tests",
      "VENDORED.json",
      "README.md",
      "RUNBOOK.md",
    ]);
    expect(r.files).toBeGreaterThan(30);
    expect(r.bad).toEqual([]);
  });
});
