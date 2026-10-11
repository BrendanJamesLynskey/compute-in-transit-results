/**
 * Axes for the SVG charts: gridlines, ticks and labels, in currentColor so
 * they follow the theme. Usable from Server and Client Components.
 */
import type { Scale } from "@/lib/viz/scale";

export function XAxis({
  scale,
  ticks,
  y,
  top,
  label,
  format,
}: {
  scale: Scale;
  ticks: number[];
  /** Pixel row of the axis line. */
  y: number;
  /** Pixel row of the gridlines' top. */
  top: number;
  label: string;
  format: (v: number) => string;
}): JSX.Element {
  const [r0, r1] = [scale(scale.domain[0]), scale(scale.domain[1])];
  return (
    <g className="text-neutral-500 dark:text-neutral-400" fontSize={11}>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={scale(t)}
            x2={scale(t)}
            y1={top}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.18}
          />
          <text
            x={scale(t)}
            y={y + 14}
            textAnchor={
              scale(t) > r1 - 24
                ? "end"
                : scale(t) < r0 + 4 && r0 < 30
                  ? "start"
                  : "middle"
            }
            fill="currentColor"
          >
            {format(t)}
          </text>
        </g>
      ))}
      <line
        x1={r0}
        x2={r1}
        y1={y}
        y2={y}
        stroke="currentColor"
        strokeOpacity={0.5}
      />
      <text
        x={(r0 + r1) / 2}
        y={y + 30}
        textAnchor="middle"
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}

export function YAxis({
  scale,
  ticks,
  x,
  right,
  label,
  format,
}: {
  scale: Scale;
  ticks: number[];
  x: number;
  right: number;
  label: string;
  format: (v: number) => string;
}): JSX.Element {
  const [r0, r1] = [scale(scale.domain[0]), scale(scale.domain[1])];
  return (
    <g className="text-neutral-500 dark:text-neutral-400" fontSize={11}>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x}
            x2={right}
            y1={scale(t)}
            y2={scale(t)}
            stroke="currentColor"
            strokeOpacity={0.18}
          />
          <text x={x - 5} y={scale(t) + 4} textAnchor="end" fill="currentColor">
            {format(t)}
          </text>
        </g>
      ))}
      <line
        x1={x}
        x2={x}
        y1={r0}
        y2={r1}
        stroke="currentColor"
        strokeOpacity={0.5}
      />
      <text
        transform={`translate(${x - 38},${(r0 + r1) / 2}) rotate(-90)`}
        textAnchor="middle"
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}
