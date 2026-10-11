/**
 * Scales and ticks for the hand-drawn SVG charts (pure, unit-tested). The
 * companion sites draw their SVG without a chart library; so does this one.
 */

export type Scale = ((v: number) => number) & {
  domain: [number, number];
  log: boolean;
};

export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const f = ((v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)) as Scale;
  f.domain = [d0, d1];
  f.log = false;
  return f;
}

export function log(d0: number, d1: number, r0: number, r1: number): Scale {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  const f = ((v: number) =>
    r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0)) as Scale;
  f.domain = [d0, d1];
  f.log = true;
  return f;
}

/** Inverse of a scale (for pointer positions). */
export function invert(s: Scale, r0: number, r1: number, px: number): number {
  const t = (px - r0) / (r1 - r0);
  const [d0, d1] = s.domain;
  return s.log
    ? 10 ** (Math.log10(d0) + t * (Math.log10(d1) - Math.log10(d0)))
    : d0 + t * (d1 - d0);
}

/** Decade ticks (and 2, 5 within a decade when there are few decades). */
export function logTicks(d0: number, d1: number): number[] {
  const out: number[] = [];
  const decades = Math.log10(d1) - Math.log10(d0);
  const mult =
    decades <= 1.5
      ? [1, 1.5, 2, 3, 4, 5, 6, 8]
      : decades <= 3
        ? [1, 2, 5]
        : [1];
  for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++)
    for (const m of mult) {
      const v = m * 10 ** e;
      if (v >= d0 * (1 - 1e-9) && v <= d1 * (1 + 1e-9))
        out.push(Number(v.toPrecision(6)));
    }
  return out;
}

/** About `n` round linear ticks. */
export function linearTicks(d0: number, d1: number, n = 5): number[] {
  const span = d1 - d0;
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => span / s <= n) ?? 10 * p;
  const out: number[] = [];
  for (let v = Math.ceil(d0 / step) * step; v <= d1 + step * 1e-9; v += step)
    out.push(Number(v.toPrecision(6)));
  return out;
}

/** An SVG path through points, skipping non-finite values (gaps). */
export function path(xs: number[], ys: number[]): string {
  let d = "";
  let pen = false;
  xs.forEach((x, i) => {
    const y = ys[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** A closed band between a lower and an upper line. */
export function band(xs: number[], lo: number[], hi: number[]): string {
  const top = xs.map((x, i) => `${x.toFixed(1)},${hi[i]!.toFixed(1)}`);
  const bottom = xs
    .map((x, i) => `${x.toFixed(1)},${lo[i]!.toFixed(1)}`)
    .reverse();
  return `M${top.join("L")}L${bottom.join("L")}Z`;
}
