/** Number formats, matching the simulator's results.py. */
import { describe, expect, it } from "vitest";

import {
  fixed,
  int,
  ms,
  pct,
  pct1,
  plusFixed,
  pyG,
  reached,
  sci,
  signed,
  signedPct,
  sub,
  sup,
  trim,
} from "@/lib/format";

describe("formats", () => {
  it("fixed: separators and Python's round-half-even on exact ties", () => {
    expect(fixed(1234567.891, 1)).toBe("1,234,567.9");
    expect(fixed(-1234.5, 0)).toBe("-1,234");
    expect(fixed(1235.5, 0)).toBe("1,236");
    expect(fixed(0.125, 2)).toBe("0.12");
    expect(fixed(-0.001, 0)).toBe("-0");
  });
  it("ms and signed percentages", () => {
    expect(ms(0.3555)).toBe("355.5 ms");
    expect(ms(1.61)).toBe("1,610 ms");
    expect(signedPct(0.28)).toBe("+28%");
    expect(signedPct(-0.004)).toBe("-0%");
    expect(signedPct(25.77)).toBe("+2577%");
  });
});

describe("this site's Python formats", () => {
  it("pyG: Python's ,.3g", () => {
    expect(pyG(1.56826, 3)).toBe("1.57");
    expect(pyG(0.83, 3)).toBe("0.83");
    expect(pyG(10.0004, 3)).toBe("10");
    expect(pyG(12.5, 3)).toBe("12.5");
    expect(pyG(1234.5, 3)).toBe("1.23e+03");
    expect(pyG(0.00001234, 3)).toBe("1.23e-05");
    expect(pyG(0, 3)).toBe("0");
  });
  it("plusFixed, reached, pct1", () => {
    expect(plusFixed(5.796, 2)).toBe("+5.80");
    expect(plusFixed(-85.2371, 2)).toBe("-85.24");
    expect(plusFixed(1569.18, 2)).toBe("+1569.18");
    expect(reached(null)).toBe("not reached");
    expect(reached(Infinity)).toBe("not reached");
    expect(reached(1.63007)).toBe("1.63");
    expect(pct1(0.6315)).toBe("63.1%");
  });
  it("trim, sci, int, sup, sub, signed, minus", () => {
    expect(trim(200, 3)).toBe("200");
    expect(trim(0.5, 3)).toBe("0.5");
    expect(trim(-3, 3)).toBe("−3");
    expect(trim(1e-6)).toBe("1 × 10⁻⁶");
    expect(trim(0)).toBe("0");
    expect(trim(Infinity)).toBe("∞");
    expect(trim(NaN)).toBe("NaN");
    expect(sci(0)).toBe("0");
    expect(int(1234.4)).toBe("1,234");
    expect(sup(-12)).toBe("⁻¹²");
    expect(sub(2, 1)).toBe("₂₁");
    expect(sub(12, 1)).toBe("₁₂,₁");
    expect(signed(-3)).toBe("(−3)");
    expect(signed(3)).toBe("3");
    expect(pct(0.25)).toBe("25%");
  });
});
