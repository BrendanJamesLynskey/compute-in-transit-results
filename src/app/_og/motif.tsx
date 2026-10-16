/**
 * This site's favicon glyph (src/app/icon.svg) and its card's graphic.
 * Glyph: the diamond of the site, the letter C, #1f6f7d.
 */
import { lossSeries } from "@/lib/experiment/props";
import { G } from "@/lib/quote";
import { KIND_COLOUR } from "@/lib/viz/palette";

export function Glyph({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M16 0 32 16 16 32 0 16z" fill="#1f6f7d" />
      <path
        d="M17.06 11.95Q15.6 11.95 14.82 13.04Q14.05 14.13 14.05 16.03Q14.05 17.95 14.76 19Q15.48 20.05 17.06 20.05Q17.8 20.05 18.53 19.88Q19.26 19.71 20.12 19.41V21.55Q19.33 21.87 18.55 22.02Q17.78 22.17 16.82 22.17Q14.97 22.17 13.77 21.4Q12.57 20.64 12 19.25Q11.43 17.87 11.43 16.02Q11.43 14.2 12.08 12.81Q12.74 11.41 13.99 10.62Q15.24 9.83 17.06 9.83Q17.95 9.83 18.85 10.06Q19.75 10.29 20.57 10.67L19.75 12.74Q19.08 12.42 18.39 12.18Q17.71 11.95 17.06 11.95Z"
        fill="#fff"
      />
    </svg>
  );
}

/**
 * The landing hero's picture: validation loss over training (mean over seeds) for the dense
 * baseline (A), top-k (B), the fixed low band (C), a random fixed set (F) and the repaired
 * emulated optics (E), from the run logs at build time.
 */
export function Motif(): JSX.Element {
  const show: string[] = [G.A, G.B, G.C1d256, G.Frandom, G.E10];
  const series = lossSeries().filter((s) => show.includes(s.id));
  const all = series.flatMap((s) => s.mean);
  const hi = Math.min(Math.max(...all), 4.5);
  const lo = Math.min(...all) - 0.05;
  const steps = Math.max(...series.flatMap((s) => s.step));
  const x = (st: number) => 20 + (400 * st) / steps;
  const y = (v: number) => 20 + (380 * (hi - Math.min(v, hi))) / (hi - lo);
  return (
    <svg width="440" height="420" viewBox="0 0 440 420">
      <line
        x1={20}
        y1={404}
        x2={420}
        y2={404}
        stroke="#475569"
        strokeWidth={3}
      />
      <line x1={16} y1={20} x2={16} y2={404} stroke="#475569" strokeWidth={3} />
      {series.map((s) => (
        <polyline
          key={s.id}
          points={s.step.map((st, i) => `${x(st)},${y(s.mean[i]!)}`).join(" ")}
          fill="none"
          stroke={KIND_COLOUR[s.kind as keyof typeof KIND_COLOUR] ?? "#94a3b8"}
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
