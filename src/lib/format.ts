/**
 * Number formatting for the captions, readouts and prose (from Numerics
 * Explained): integers with thousands separators and typographic minus
 * signs, significant figures switching to scientific notation outside
 * 1e-4 .. 1e7, percentages and subscript indices.
 */

const SUP: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** An integer as superscript digits (with a typographic minus). */
export function sup(k: number): string {
  return String(k)
    .split("")
    .map((c) => SUP[c] ?? c)
    .join("");
}

/** A typographic minus for negative numbers. */
export function minus(s: string): string {
  return s.replace(/^-/, "−");
}

/** Up to `digits` significant figures, without trailing zeros. */
export function trim(v: number, digits = 4): string {
  if (v === 0) return "0";
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "NaN" : v > 0 ? "∞" : "−∞";
  const a = Math.abs(v);
  if (a < 1e-4 || a >= 1e7) return sci(v, digits);
  const s = Number(v.toPrecision(digits));
  return minus(s.toLocaleString("en-GB", { maximumFractionDigits: 10 }));
}

/** Scientific notation: 6.104 × 10⁻⁵. */
export function sci(v: number, digits = 4): string {
  if (v === 0) return "0";
  const [m, e] = v.toExponential(digits - 1).split("e");
  const mant = String(Number(m));
  return `${minus(mant)} × 10${sup(Number(e))}`;
}

/** A fraction as a percentage. */
export function pct(f: number, digits = 0): string {
  return `${(f * 100).toFixed(digits)}%`;
}

/** A whole number with thousands separators. */
export function int(v: number): string {
  return Math.round(v).toLocaleString("en-GB");
}

const SUB: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

/** Subscript indices: sub(2, 1) is "₂₁"; indices above 9 get a comma. */
export function sub(...idx: number[]): string {
  const s = idx.map((i) =>
    String(i)
      .split("")
      .map((c) => SUB[c] ?? c)
      .join(""),
  );
  return idx.some((i) => i > 9) ? s.join(",") : s.join("");
}

/** An integer with a typographic minus, in brackets when negative (for products). */
export function signed(v: number): string {
  return v < 0 ? `(${minus(String(v))})` : String(v);
}

/**
 * `f"{x:,.{dp}f}"`: fixed decimals with thousands separators, the way the
 * simulator's examples/results.py writes results.md (from LLM Inference
 * Explained). Python rounds an exact tie (1234.5 to 0 dp) to even; `toFixed`
 * rounds it up, so ties are detected from the exact decimal expansion and
 * made even.
 */
export function fixed(x: number, dp: number): string {
  const a = Math.abs(x);
  let s = a.toFixed(dp);
  const extra = 25;
  const exact = a.toFixed(Math.min(100, dp + extra));
  if (exact.endsWith("5" + "0".repeat(extra - 1))) {
    const truncated = exact.slice(0, exact.length - extra).replace(/\.$/, "");
    if (Number(truncated.slice(-1)) % 2 === 0) s = truncated;
  }
  const [whole, frac] = s.split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = x < 0 ? "-" : "";
  return frac === undefined ? sign + grouped : `${sign}${grouped}.${frac}`;
}

/** results.py `ms()`: milliseconds, 1 decimal below a second, none above. */
export function ms(x: number): string {
  return x < 1 ? `${fixed(1e3 * x, 1)} ms` : `${fixed(1e3 * x, 0)} ms`;
}

/**
 * A relative change as results.py writes it in section 26:
 * `f"{100 * x:+.0f}%"`, e.g. +28%, -0%, -100%, +2577% (no separators, a
 * minus kept on a change that rounds to zero, as Python does).
 */
export function signedPct(rel: number): string {
  const p = fixed(100 * rel, 0).replace(/,/g, "");
  return `${p.startsWith("-") ? "" : "+"}${p}%`;
}

/**
 * Python's `f"{x:,.{p}g}"` for the range results.md uses (exponent -4 to
 * p - 1): p significant figures, trailing zeros dropped, thousands
 * separators. Outside that range, Python's exponent form.
 */
export function pyG(x: number, p = 3): string {
  if (x === 0) return "0";
  const e = Number(x.toExponential(p - 1).split("e")[1]);
  if (e < -4 || e >= p) {
    const [m, ex] = x.toExponential(p - 1).split("e");
    const mant = m!.includes(".")
      ? m!.replace(/0+$/, "").replace(/\.$/, "")
      : m!;
    const n = Number(ex);
    return `${mant}e${n < 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`;
  }
  const s = fixed(x, Math.max(0, p - 1 - e));
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Python's `f"{x:+.{dp}f}"`: fixed decimals with an explicit sign. */
export function plusFixed(x: number, dp: number): string {
  const s = fixed(x, dp).replace(/,/g, "");
  return s.startsWith("-") ? s : `+${s}`;
}

/** results.py's `fmt`: "not reached" for a variant that never gets there. */
export function reached(x: number | null, dp = 2): string {
  return x === null || !Number.isFinite(x) ? "not reached" : fixed(x, dp);
}

/** Python's `f"{100 * x:.1f}%"`. */
export function pct1(x: number): string {
  return `${fixed(100 * x, 1)}%`;
}
