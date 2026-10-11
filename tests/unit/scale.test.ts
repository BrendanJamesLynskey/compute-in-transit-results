/** The charts' scales and ticks. */
import { describe, expect, it } from "vitest";

import {
  band,
  invert,
  linear,
  linearTicks,
  log,
  logTicks,
  path,
} from "@/lib/viz/scale";

describe("scales", () => {
  it("linear and log map their domains onto their ranges, and invert", () => {
    const l = linear(0, 10, 100, 200);
    expect(l(0)).toBe(100);
    expect(l(5)).toBe(150);
    expect(invert(l, 100, 200, 150)).toBe(5);
    const g = log(1, 100, 0, 200);
    expect(g(10)).toBeCloseTo(100, 12);
    expect(invert(g, 0, 200, 100)).toBeCloseTo(10, 12);
    expect(g.log).toBe(true);
  });
  it("ticks: decades, finer with few decades, round linear steps", () => {
    expect(logTicks(1e8, 1e12)).toEqual([1e8, 1e9, 1e10, 1e11, 1e12]);
    expect(logTicks(1, 100)).toEqual([1, 2, 5, 10, 20, 50, 100]);
    expect(logTicks(1.5, 6)).toEqual([1.5, 2, 3, 4, 5, 6]);
    expect(linearTicks(0, 3000, 3)).toEqual([0, 1000, 2000, 3000]);
    expect(linearTicks(-10, 10, 4)).toEqual([-10, -5, 0, 5, 10]);
  });
  it("paths skip gaps; bands close", () => {
    expect(path([0, 1, 2, 3], [0, NaN, 2, 3])).toBe("M0.0,0.0M2.0,2.0L3.0,3.0");
    expect(band([0, 1], [0, 0], [1, 1])).toBe(
      "M0.0,1.0L1.0,1.0L1.0,0.0L0.0,0.0Z",
    );
  });
});
