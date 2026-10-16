import { describe, expect, it } from "vitest";

import { chainInputs } from "@/lib/data/load";
import { digitalRates } from "@/lib/digital";

describe("the digital alternative's arithmetic", () => {
  it("counts the operations a digital block needs at the port rate", () => {
    const c = chainInputs();
    const d = digitalRates(c.m, c.k);
    // 25 GB/s of 2-byte (BF16) values
    expect(d.valuesPerS).toBe(12.5e9);
    // the band: k = 16 MACs per value; a 256-point fast DCT: 4 per value
    expect(d.bandMacPerValue).toBe(16);
    expect(d.fastMacPerValue).toBe(4);
    expect(d.fastFlops).toBe(100e9);
    expect(d.bandFlops).toBe(400e9);
    // the module's budget in the simulation: 10 to 99 GFLOP/s
    expect([d.budgetLow, d.budgetHigh]).toEqual([10e9, 99e9]);
  });
});
