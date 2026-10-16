/**
 * The architect's question, "why optics rather than digital logic in the
 * NIC?", as arithmetic on the study's own inputs: the operations a digital
 * block would need to compute the band (or the whole DCT) at the module's
 * port rate, set beside the compute budget the simulation gives the module.
 * No area or energy is claimed for the digital block: neither is in the
 * sources used, so the page compares rates only.
 */
import { MODULES } from "@/lib/transit/model";

export type DigitalRates = {
  valuesPerS: number;
  /** a direct m x k matrix product for the band: k MACs per value */
  bandMacPerValue: number;
  /** a fast (radix-2) DCT of the whole chunk: (m / 2) log2 m MACs per m values */
  fastMacPerValue: number;
  bandFlops: number;
  fastFlops: number;
  budgetLow: number;
  budgetHigh: number;
};

export function digitalRates(
  m: number,
  k: number,
  bytesPerValue = 2,
): DigitalRates {
  const port = MODULES.low.port_rate;
  const valuesPerS = port / bytesPerValue;
  const bandMacPerValue = k;
  const fastMacPerValue = ((m / 2) * Math.log2(m)) / m;
  return {
    valuesPerS,
    bandMacPerValue,
    fastMacPerValue,
    bandFlops: 2 * bandMacPerValue * valuesPerS,
    fastFlops: 2 * fastMacPerValue * valuesPerS,
    budgetLow: MODULES.low.gflops,
    budgetHigh: MODULES.high.gflops,
  };
}
