/**
 * Every vendored file is its source's, byte for byte, at the pinned commit
 * (the SHA-256 in VENDORED.json, written by scripts/vendor.py; CI's data job
 * re-runs that script against fresh clones), and the derived files were
 * generated at the same commits.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runsFile, vendored } from "@/lib/data/load";

import C from "@/data/derived/transit_constants.json";

import parity from "../fixtures/transit_parity.json";

const EXPERIMENT = "b1f62d394ac79250df9ce555d3a55d85cf1cd517";
const SIM = "c6de1f4019547050ae7bacbb4ab13f9d9ee9586c";

function sha(path: string): string {
  return createHash("sha256")
    .update(readFileSync(join(process.cwd(), path)))
    .digest("hex");
}

describe("VENDORED.json", () => {
  const v = vendored();
  it("lists the six vendored files at the pinned commits", () => {
    expect(v.vendored.map((f) => [f.file, f.commit])).toEqual([
      ["src/data/vendor/experiment/results.json", EXPERIMENT],
      ["src/data/vendor/experiment/results.md", EXPERIMENT],
      ["src/data/vendor/experiment/optics_investigation.md", EXPERIMENT],
      ["public/run_sweep.ipynb", EXPERIMENT],
      ["src/data/vendor/sim/results.json", SIM],
      ["src/data/vendor/sim/results.md", SIM],
    ]);
  });
  it("every file's SHA-256 matches", () => {
    for (const f of [...v.vendored, ...v.derived])
      expect(sha(f.file), f.file).toBe(f.sha256);
  });
  it("the derived files come from the same commits", () => {
    expect(runsFile().commit).toBe(EXPERIMENT);
    expect(C.commit).toBe(SIM);
    expect(parity.commit).toBe(SIM);
  });
  it("the simulation's inputs are the experiment's results at the same commit", () => {
    const sim = JSON.parse(
      readFileSync(
        join(process.cwd(), "src/data/vendor/sim/results.json"),
        "utf8",
      ),
    );
    expect(sim.experiment.commit).toBe(EXPERIMENT);
    expect(sim.experiment.sha256["results.json"]).toBe(
      sha("src/data/vendor/experiment/results.json"),
    );
    expect(sim.experiment.sha256["results.md"]).toBe(
      sha("src/data/vendor/experiment/results.md"),
    );
  });
  it("the notebook has no outputs (it is published as run)", () => {
    const nb = JSON.parse(
      readFileSync(join(process.cwd(), "public/run_sweep.ipynb"), "utf8"),
    );
    for (const c of nb.cells)
      if (c.cell_type === "code") expect(c.outputs).toEqual([]);
  });
});
