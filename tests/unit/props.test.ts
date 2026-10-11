/** The slim views the pages hand to the widgets. */
import { describe, expect, it } from "vitest";

import { experimentResults } from "@/lib/data/load";
import {
  clipProps,
  energyProps,
  idsWhere,
  ladderProps,
  lossSeries,
  rowOf,
} from "@/lib/experiment/props";
import { fixed } from "@/lib/format";

describe("props", () => {
  it("loss series: every configuration, final means formatted as results.md's", () => {
    const s = lossSeries();
    const rows = experimentResults().rows;
    expect(s).toHaveLength(rows.length);
    s.forEach((x, i) =>
      expect(fixed(x.mean.at(-1)!, 3)).toBe(fixed(rows[i]!.final_val, 3)),
    );
    expect(idsWhere((g) => g.kind === "A")).toEqual([rows[0]!.group]);
    expect(rowOf(rows[1]!.group).label).toBe(rows[1]!.label);
    expect(() => rowOf("nope")).toThrow();
  });
  it("ladder, energy and clip views", () => {
    const l = ladderProps();
    expect(l.targets).toHaveLength(5);
    expect(l.rows.every((r) => r.cells.length === 5)).toBe(true);
    const e = energyProps();
    expect(e.after).toBe(200);
    expect(e.keep).toBe(0.0625);
    expect(e.families).toHaveLength(5);
    const d = e.families.find((f) => f.key === "calib/2d/64")!;
    expect(d.energy["momentum/all/calib"]![0]).toBeNull();
    const c = clipProps();
    expect(c.filter((x) => x.kind === "E0")).toHaveLength(6);
    expect(c.find((x) => x.kind === "Ec")!.enob).toBeNull();
  });
});
