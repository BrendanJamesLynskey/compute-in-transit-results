/**
 * Every number on the landing page's "What it found" (src/lib/findings.ts)
 * against the vendored files, read here independently: the experiment's
 * results.md (sections 1 to 3 and its header) and the simulation's
 * results.md (sections 7a and 7c), cell by cell.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findings } from "@/lib/findings";
import { cell, tableAfter } from "@/lib/md";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const EXP = read("src/data/vendor/experiment/results.md");
const SIM = read("src/data/vendor/sim/results.md");
const f = findings();

const t1 = tableAfter(EXP, "## 1. Loss against communication");
const t2 = tableAfter(EXP, "## 2. Captured energy");
const t3 = tableAfter(EXP, "## 3. Emulated optics");
const t7a = tableAfter(SIM, "### 7a.");
const loss1 = (r: string[]) => Number(r[2]!.split(" ")[0]);
const num = (s: string) => Number(s.replace(/,/g, ""));

describe("What it found: every number is the vendored results'", () => {
  it("the fixed low band against top-k and AdamW (experiment section 1)", () => {
    const low = t1.rows
      .filter((r) => r[0]!.startsWith("C  DeMo, fixed band"))
      .map(loss1);
    expect(low).toHaveLength(3);
    expect(f.lowMin).toBe(Math.min(...low).toFixed(3));
    expect(f.lowMax).toBe(Math.max(...low).toFixed(3));
    expect(f.topk).toBe(
      t1.rows.find((r) => r[0]!.startsWith("B "))![2]!.split(" ")[0],
    );
    expect(f.adamw).toBe(
      t1.rows.find((r) => r[0]!.startsWith("A "))![2]!.split(" ")[0],
    );
    // the figures the brief quoted
    expect([f.lowMin, f.lowMax, f.topk, f.adamw]).toEqual([
      "3.124",
      "3.158",
      "1.785",
      "1.646",
    ]);
  });

  it("captured energy on real momentum (experiment section 2)", () => {
    const r = (run: string) =>
      t2.rows.find(
        (x) => x[0] === run && x[1] === "momentum" && x[2] === "all",
      )!;
    const col = (run: string, c: string) => r(run)[t2.header.indexOf(c)]!;
    expect(f.eLow2d).toBe(col("C, 2d 64", "Low band"));
    expect(f.eTopk2d).toBe(col("C, 2d 64", "Top-k"));
    expect(f.eRandom2d).toBe(col("C, 2d 64", "Random"));
    expect(f.eLow1d).toBe(col("C, 1d 256", "Low band"));
    expect(f.eTopk1d).toBe(col("C, 1d 256", "Top-k"));
    expect([f.eLow2d, f.eTopk2d, f.eRandom2d]).toEqual([
      "0.013",
      "0.643",
      "0.065",
    ]);
  });

  it("the optics: the first design, the repair and the exact band (experiment section 3)", () => {
    const first = t3.rows.filter((r) =>
      r[0]!.endsWith("feedback of the exact band"),
    );
    const repaired = t3.rows.filter((r) =>
      r[0]!.endsWith("feedback of the band sent"),
    );
    expect(f.firstRuns).toBe(first.length);
    const fl = first.map((r) => num(r[1]!));
    const rl = repaired.map((r) => num(r[1]!));
    const clip = first.map((r) => Number(r[2]!.replace("%", "")));
    expect(f.firstMin).toBe(Math.min(...fl).toFixed(3));
    expect(f.firstMax).toBe(Math.max(...fl).toFixed(3));
    expect(f.clipMin).toBe(`${Math.min(...clip).toFixed(2)}%`);
    expect(f.clipMax).toBe(`${Math.max(...clip).toFixed(2)}%`);
    expect(f.repMin).toBe(Math.min(...rl).toFixed(3));
    expect(f.repMax).toBe(Math.max(...rl).toFixed(3));
    expect(f.exactBand).toBe(
      t3.rows.find((r) => r[0]!.includes("perfect optics"))![1],
    );
    // every first-design run ended above every repaired one: it diverged
    expect(Math.min(...fl)).toBeGreaterThan(Math.max(...rl));
    // the hypothesis: the best repaired run below the exact band
    expect(Math.min(...rl)).toBeLessThan(num(f.exactBand));
  });

  it("ENOB: 6 never reaches the target, 8 is the break-even (simulation 7c)", () => {
    const steps = tableAfter(SIM, "### 7c.", 0);
    const never = steps.rows.filter((r) =>
      r.slice(1).every((c) => c === "never"),
    );
    expect(never.map((r) => r[0]).join(", ")).toBe(f.enobNever);
    const be = tableAfter(SIM, "### 7c.", 1).rows.map(
      (r) => r[4]!.split(" ")[0]!,
    );
    const measured = [...new Set(be.filter((c) => c !== "none"))];
    expect(measured).toEqual([f.enobBreakEven]);
    expect([f.enobNever, f.enobBreakEven]).toEqual(["6", "8"]);
    expect(SIM).toContain(
      `Target loss for the headline tables: **${f.target}**`,
    );
  });

  it("where the module could pay (simulation 7a)", () => {
    const be = (x: string, y: string, m: string, s: string) =>
      t7a.rows.find(
        (r) =>
          r[0]!.startsWith(x) &&
          r[1]!.startsWith(y) &&
          r[2] === m &&
          r[3] === s,
      )![4]!;
    const pluggable = t7a.rows.filter(
      (r) => r[0]!.startsWith("E  ") && r[1]!.startsWith("A  "),
    );
    expect(pluggable).toHaveLength(4);
    expect(pluggable.every((r) => r[4] === "none in range")).toBe(true);
    expect(f.pluggableNever).toBe(true);
    expect(f.switchVsA).toBe(be("E'", "A ", "free", "E").split(" ")[0]);
    expect(f.switchVsAExact).toBe(
      be("E'", "A ", "free", "C (exact)").split(" ")[0],
    );
    expect(f.allreduceVsA).toBe(be("C'", "A ", "–", "measured").split(" ")[0]);
    expect(f.switchVsAllreduceExact).toBe(be("E'", "C'", "free", "C (exact)"));
    expect([f.switchVsA, f.switchVsAExact, f.switchVsAllreduceExact]).toEqual([
      "1.57",
      "0.83",
      "none in range",
    ]);
  });

  it("wire bytes, payload ratio, workers and runs (experiment section 1 and header)", () => {
    const a = t1.rows.find((r) => r[0]!.startsWith("A "))![0]!;
    const c = t1.rows.find((r) =>
      r[0]!.startsWith("C  DeMo, fixed band, 1-D 256"),
    )![0]!;
    expect(f.wireAdamw).toBe(cell(t1, a, "Wire / step (bytes)"));
    expect(f.wireBand).toBe(cell(t1, c, "Wire / step (bytes)"));
    expect(`${f.wireRatio}x`).toBe(cell(t1, c, "Wire vs dense"));
    expect(`${f.payloadRatio}x`).toBe(cell(t1, c, "vs dense"));
    expect(EXP).toContain(`${f.workers} simulated workers`);
    expect(EXP).toContain(`from ${f.runs} completed runs`);
  });
});
