/**
 * Draws the chain animation as SVG strings, so the results site and the
 * static decks show the same pictures from the same model: the block
 * diagram (TX GPU → module → network → RX GPU, with the error-feedback
 * loop), the data panel of a stage (the chunk's numbers at that point), and
 * the bytes on a hop. Colours are CSS variables with Okabe–Ito fallbacks
 * (--chain-a, --chain-b, --chain-muted, --chain-band, --chain-box,
 * --chain-line); text is currentColor, so a host page's light and dark
 * themes both work. No imports beyond the model's types, so the decks'
 * build can compile it with model.ts.
 */
import type {
  Block,
  ChainBytes,
  ChainMode,
  Source,
  Stage,
  View,
} from "./model";
import { BLOCKS } from "./model";

const C = {
  a: "var(--chain-a, #0072B2)",
  b: "var(--chain-b, #D55E00)",
  muted: "var(--chain-muted, #a3a3a3)",
  band: "var(--chain-band, rgba(0,158,115,0.18))",
  box: "var(--chain-box, rgba(127,127,127,0.08))",
  line: "var(--chain-line, #737373)",
};
/** The source tags: a filled pill with a letter, colour and letter both (never colour alone). */
export const TAG: Record<
  Source,
  { letter: string; fill: string; ink: string; name: string }
> = {
  paper: {
    letter: "P",
    fill: "#009E73",
    ink: "#000",
    name: "paper (arXiv:2608.21536)",
  },
  experiment: {
    letter: "X",
    fill: "#0072B2",
    ink: "#fff",
    name: "the experiment's model",
  },
  simulation: {
    letter: "S",
    fill: "#CC79A7",
    ink: "#000",
    name: "the simulation",
  },
  assumption: { letter: "A", fill: "#E69F00", ink: "#000", name: "assumption" },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n2 = (v: number) => (Math.round(v * 10) / 10).toString();

type Box = { id: Block; x: number; y: number; w: number; h: number };

/** Short labels for narrow boxes. */
const SHORT: Record<Block, (m: ChainMode) => string> = {
  grad: () => "gradient g",
  delta: () => "δ ← decay·δ + lr·g",
  chunk: () => "1-D chunks of 256",
  port: () => "host card → QSFP56",
  quant: () => "P-bit integers",
  mzm: () => "4 × modulator",
  oft: () => "optical FT",
  pd: () => "read 16 of 256",
  adc: () => "TIAs / ADCs",
  fpga: () => "FPGA: Σ 2^b·plane",
  fibre: () => "values, no indices",
  net: (m) => (m === "Eprime" ? "switch sum" : "all-gather"),
  place: () => "place, mean",
  idct: () => "inverse DCT",
  sign: () => "sign → weights",
  feedback: () => "error feedback",
};

/** A block's short label, for narrow boxes. */
export const shortLabel = (id: Block, mode: ChainMode): string =>
  SHORT[id](mode);

/** A block's label (the network block depends on the variant). */
export function blockLabel(id: Block, mode: ChainMode): string {
  if (id === "net")
    return mode === "Eprime" ? "switch sums, loopback" : "all-gather";
  return BLOCKS.find((b) => b.id === id)!.label;
}

const GROUP_NAME = (g: string, mode: ChainMode) =>
  g === "tx"
    ? "TX GPU"
    : g === "module"
      ? mode === "Eprime"
        ? "module at the switch port (E′)"
        : "pluggable module (E)"
      : g === "net"
        ? "fibre and network"
        : "RX GPU";

/**
 * The block diagram. `active` is the block of the current stage; `done`
 * lists the blocks already passed. Four columns when wide, two when narrow.
 */
export function diagramSvg(
  width: number,
  mode: ChainMode,
  active: Block,
  done: Block[],
): string {
  const narrow = width < 560;
  const cols: string[][] = narrow
    ? [
        ["tx", "module"],
        ["net", "rx"],
      ]
    : [["tx"], ["module"], ["net"], ["rx"]];
  const gap = narrow ? 18 : 22;
  const colW = (width - gap * (cols.length - 1)) / cols.length;
  const bh = 46;
  const vg = 12;
  const head = 22;
  const boxes: Box[] = [];
  const heads: string[] = [];
  let maxY = 0;
  cols.forEach((groups, ci) => {
    const x = ci * (colW + gap);
    let y = 0;
    for (const g of groups) {
      heads.push(
        `<text x="${n2(x + (narrow ? 22 : 0))}" y="${n2(y + 14)}" font-size="12" font-weight="600" fill="currentColor">${esc(GROUP_NAME(g, mode))}</text>`,
      );
      y += head;
      for (const b of BLOCKS.filter((b) => b.group === g)) {
        // narrow: the feedback box leaves a strip on the left for the arrow from the TX GPU to the module
        const inset = narrow && b.id === "feedback" ? 22 : 0;
        boxes.push({ id: b.id, x: x + inset, y, w: colW - inset, h: bh });
        y += bh + vg;
      }
      y += 8;
    }
    maxY = Math.max(maxY, y);
  });
  const at = (id: Block) => boxes.find((b) => b.id === id)!;
  const parts: string[] = [];
  // the forward path, in chain order (feedback excluded)
  const chain = BLOCKS.filter((b) => b.id !== "feedback").map((b) => b.id);
  for (let i = 1; i < chain.length; i++) {
    const a = at(chain[i - 1]!);
    const b = at(chain[i]!);
    const d =
      Math.abs(a.x - b.x) < 1
        ? b.y - (a.y + a.h) > vg + 1
          ? `M${n2(a.x + 10)} ${n2(a.y + a.h)} V${n2(b.y - 1)}`
          : `M${n2(a.x + a.w / 2)} ${n2(a.y + a.h)} V${n2(b.y - 1)}`
        : `M${n2(a.x + a.w)} ${n2(a.y + a.h / 2)} H${n2(a.x + a.w + gap / 2)} V${n2(b.y + b.h / 2)} H${n2(b.x - 1)}`;
    parts.push(
      `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="1.4" marker-end="url(#chain-arrow)"/>`,
    );
  }
  // error feedback: the sender's own values come back from the network, and leave the delta
  const net = at("net");
  const fb = at("feedback");
  const de = at("delta");
  const fbOn = active === "feedback";
  const dash = `fill="none" stroke="${fbOn ? C.b : C.line}" stroke-width="${fbOn ? 2.2 : 1.4}" stroke-dasharray="5 4" marker-end="url(#chain-arrow)"`;
  if (narrow)
    parts.push(
      `<path d="M${n2(net.x)} ${n2(net.y + net.h / 2)} H${n2(fb.x + fb.w + gap / 2)} V${n2(fb.y + fb.h * 0.7)} H${n2(fb.x + fb.w + 1)}" ${dash}/>`,
    );
  else
    parts.push(
      `<path d="M${n2(net.x + net.w / 2)} ${n2(net.y + net.h)} V${n2(maxY + 4)} H${n2(fb.x + fb.w / 2)} V${n2(fb.y + fb.h + 1)}" ${dash}/>`,
    );
  parts.push(
    `<path d="M${n2(fb.x + fb.w)} ${n2(fb.y + fb.h * 0.3)} H${n2(fb.x + fb.w + gap * 0.3)} V${n2(de.y + de.h / 2)} H${n2(de.x + de.w + 1)}" ${dash}/>`,
  );
  // the blocks
  for (const bx of boxes) {
    const b = BLOCKS.find((x) => x.id === bx.id)!;
    const on = bx.id === active;
    const past = done.includes(bx.id);
    const tagW = b.tags.length * 17 + 6;
    const full = blockLabel(b.id, mode);
    // monospace-ish estimate (0.58 em a character): the short label when the long one would not fit
    const label =
      full.length * 12 * 0.58 > bx.w - tagW - 10 ? SHORT[b.id](mode) : full;
    const sub =
      b.id === "net"
        ? mode === "Eprime"
          ? "simulated (hypothetical)"
          : "every worker's values"
        : b.sub;
    parts.push(
      `<g data-block="${b.id}" data-active="${on}" opacity="${on || past ? 1 : 0.55}">` +
        `<rect x="${n2(bx.x)}" y="${n2(bx.y)}" width="${n2(bx.w)}" height="${bx.h}" rx="6" fill="${on ? C.band : C.box}" stroke="${on ? C.a : C.line}" stroke-width="${on ? 2.5 : 1}"/>` +
        `<text x="${n2(bx.x + 7)}" y="${n2(bx.y + 18)}" font-size="12" font-weight="${on ? 700 : 500}" fill="currentColor">${esc(label)}</text>` +
        `<text x="${n2(bx.x + 7)}" y="${n2(bx.y + 37)}" font-size="11" fill="currentColor" opacity="0.75">${esc(sub)}</text>` +
        b.tags
          .map((t, i) => {
            const T = TAG[t];
            const tx = bx.x + bx.w - 18 - i * 17;
            return `<rect x="${n2(tx)}" y="${n2(bx.y + 4)}" width="15" height="15" rx="3" fill="${T.fill}"/><text x="${n2(tx + 7.5)}" y="${n2(bx.y + 15.5)}" font-size="11" font-weight="700" text-anchor="middle" fill="${T.ink}">${T.letter}</text>`;
          })
          .join("") +
        `</g>`,
    );
  }
  const h = maxY + (narrow ? 4 : 12);
  return (
    `<svg viewBox="0 0 ${n2(width)} ${n2(h)}" width="100%" role="img" aria-label="Block diagram of the chain, ${mode === "Eprime" ? "variant E′ (band computed and summed at the switch)" : "variant E (pluggable module, all-gather)"}: TX GPU, the module, the fibre and network, the RX GPU, with the error-feedback loop dashed" style="display:block;overflow:visible">` +
    `<defs><marker id="chain-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${C.line}"/></marker></defs>` +
    heads.join("") +
    parts.join("") +
    `</svg>`
  );
}

/** The legend of the source tags, as HTML-safe SVG. */
export function legendSvg(width: number): string {
  const items = (Object.keys(TAG) as Source[]).map((s) => TAG[s]);
  const perRow = width < 560 ? 2 : 4;
  const cw = width / perRow;
  const rows = Math.ceil(items.length / perRow);
  return (
    `<svg viewBox="0 0 ${n2(width)} ${rows * 20}" width="100%" role="img" aria-label="Source tags: P paper, X the experiment's model, S the simulation, A assumption" style="display:block">` +
    items
      .map((T, i) => {
        const x = (i % perRow) * cw;
        const y = Math.floor(i / perRow) * 20;
        return `<rect x="${n2(x)}" y="${y + 2}" width="15" height="15" rx="3" fill="${T.fill}"/><text x="${n2(x + 7.5)}" y="${y + 13.5}" font-size="11" font-weight="700" text-anchor="middle" fill="${T.ink}">${T.letter}</text><text x="${n2(x + 20)}" y="${y + 14}" font-size="11" fill="currentColor">${esc(T.name)}</text>`;
      })
      .join("") +
    `</svg>`
  );
}

const TONE = { a: C.a, b: C.b, muted: C.muted } as const;

function legend(
  series: { name: string; tone: keyof typeof TONE }[],
  x0: number,
): string {
  let x = x0;
  return series
    .map((s) => {
      const out = `<rect x="${n2(x)}" y="4" width="10" height="10" fill="${TONE[s.tone]}"/><text x="${n2(x + 14)}" y="13" font-size="11" fill="currentColor">${esc(s.name)}</text>`;
      x += 24 + s.name.length * 6.5;
      return out;
    })
    .join("");
}

/** The data panel of a stage: the chunk's numbers at that point of the chain. */
export function viewSvg(view: View, width: number): string {
  const nar = width < 560;
  const L = 4;
  const R = width - 4;
  const top = 22;
  let h = 150;
  const parts: string[] = [];
  const bandRect = (
    band: number | undefined,
    m: number,
    y0: number,
    y1: number,
  ) =>
    band
      ? `<rect x="${n2(L)}" y="${n2(y0)}" width="${n2(((R - L) * band) / m)}" height="${n2(y1 - y0)}" fill="${C.band}"/>`
      : "";
  if (view.kind === "strip") {
    const m = view.series[0]!.values.length;
    const mx = Math.max(
      1e-300,
      ...view.series.flatMap((s) => s.values.map(Math.abs)),
    );
    const y0 = top + 4;
    const y1 = h - 6;
    const mid = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    parts.push(bandRect(view.band, m, y0, y1));
    parts.push(
      `<path d="M${L} ${n2(mid)} H${n2(R)}" stroke="${C.line}" stroke-width="0.6"/>`,
    );
    for (const s of view.series) {
      const dx = (R - L) / m;
      const d = s.values
        .map(
          (v, i) =>
            `${i ? "L" : "M"}${n2(L + (i + 0.5) * dx)} ${n2(mid - (v / mx) * half)}`,
        )
        .join("");
      parts.push(
        `<path d="${d}" fill="none" stroke="${TONE[s.tone]}" stroke-width="${s.tone === "muted" ? 1 : 1.5}"/>`,
      );
    }
    parts.push(legend(view.series, L));
    if (view.band)
      parts.push(
        `<text x="${n2(R)}" y="13" font-size="11" text-anchor="end" fill="currentColor">${nar ? `shaded: band 0–${view.band - 1}` : `shaded: the band, positions 0–${view.band - 1} of ${m}`}</text>`,
      );
  } else if (view.kind === "bits" || view.kind === "outputs") {
    const rows = view.kind === "bits" ? view.bits : view.rows;
    const P = rows.length;
    const m = rows[0]!.length;
    const lab = 54;
    const rh = Math.max(13, Math.min(16, 160 / P));
    h = top + P * rh + 8;
    const dx = (R - L - lab) / m;
    if (view.band)
      parts.push(
        `<rect x="${n2(L + lab)}" y="${top}" width="${n2(dx * view.band)}" height="${n2(P * rh)}" fill="${C.band}"/>`,
      );
    rows.forEach((r, b) => {
      const y = top + (P - 1 - b) * rh;
      parts.push(
        `<text x="${L}" y="${n2(y + rh - 1.5)}" font-size="11" fill="currentColor">${b === P - 1 && view.kind === "bits" ? "sign" : `plane ${b}`}</text>`,
      );
      if (view.kind === "bits") {
        const d = r
          .map((v, i) =>
            v
              ? `M${n2(L + lab + i * dx)} ${n2(y + 1)}h${n2(Math.max(0.6, dx - 0.3))}v${n2(rh - 2)}h${n2(-Math.max(0.6, dx - 0.3))}z`
              : "",
          )
          .join("");
        parts.push(`<path d="${d}" fill="${C.a}"/>`);
      } else {
        const mx = Math.max(1e-300, ...r.map(Math.abs));
        const d = r
          .map(
            (v, i) =>
              `${i ? "L" : "M"}${n2(L + lab + (i + 0.5) * dx)} ${n2(y + rh / 2 - Math.sign(v) * Math.sqrt(Math.abs(v) / mx) * (rh / 2 - 1))}`,
          )
          .join("");
        parts.push(
          `<path d="${d}" fill="none" stroke="${C.a}" stroke-width="1"/>`,
        );
      }
    });
    parts.push(
      `<text x="${L}" y="13" font-size="11" fill="currentColor">${view.kind === "bits" ? `${P} binary planes of ${m} values (filled = 1)` : nar ? "all outputs (√ scale); shaded: read" : `every output of each plane (√ scale); shaded: the ${view.band} read`}</text>`,
    );
  } else if (view.kind === "planes") {
    const P = view.ideal.length;
    const k = view.ideal[0]!.length;
    const lab = 54;
    const rh = Math.max(14, Math.min(18, 160 / P));
    h = top + P * rh + 8;
    const mx = Math.max(
      1e-300,
      ...view.ideal.flat().map(Math.abs),
      ...(view.read ?? []).flat().map(Math.abs),
    );
    const cw = (R - L - lab) / k;
    view.ideal.forEach((r, b) => {
      const y = top + (P - 1 - b) * rh;
      const mid = y + rh / 2;
      parts.push(
        `<text x="${L}" y="${n2(y + rh - 2)}" font-size="11" fill="currentColor">${P === 1 ? "band" : `plane ${b}`}</text>`,
      );
      r.forEach((v, j) => {
        const x = L + lab + j * cw;
        const hh = Math.sqrt(Math.abs(v) / mx) * (rh / 2 - 1);
        parts.push(
          `<rect x="${n2(x + 1)}" y="${n2(v >= 0 ? mid - hh : mid)}" width="${n2(Math.max(1, cw - 2))}" height="${n2(Math.max(0.5, hh))}" fill="${view.read ? C.muted : C.a}"/>`,
        );
        if (view.read) {
          const u = view.read[b]![j]!;
          const yy =
            mid - Math.sign(u) * Math.sqrt(Math.abs(u) / mx) * (rh / 2 - 1);
          parts.push(
            `<path d="M${n2(x + 1)} ${n2(yy)} h${n2(Math.max(1, cw - 2))}" stroke="${C.b}" stroke-width="1.6"/>`,
          );
        }
      });
    });
    parts.push(
      `<text x="${L}" y="13" font-size="11" fill="currentColor">${view.read ? (nar ? "grey exact, orange as read (√)" : "grey: each plane's exact band; orange tick: as read, with noise (√ scale)") : `the ${k} band outputs of each plane (√ scale)`}</text>`,
    );
  } else if (view.kind === "values") {
    const k = view.series[0]!.values.length;
    const mx = Math.max(
      1e-300,
      ...view.series.flatMap((s) => s.values.map(Math.abs)),
    );
    const y0 = top + 4;
    const y1 = h - 6;
    const mid = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    const gw = (R - L) / k;
    const bw = (gw - 2) / view.series.length;
    parts.push(
      `<path d="M${L} ${n2(mid)} H${n2(R)}" stroke="${C.line}" stroke-width="0.6"/>`,
    );
    view.series.forEach((s, si) =>
      s.values.forEach((v, j) => {
        const hh = (Math.abs(v) / mx) * half;
        parts.push(
          `<rect x="${n2(L + j * gw + 1 + si * bw)}" y="${n2(v >= 0 ? mid - hh : mid)}" width="${n2(Math.max(1, bw - 1))}" height="${n2(Math.max(0.5, hh))}" fill="${TONE[s.tone]}"/>`,
        );
      }),
    );
    parts.push(legend(view.series, L));
  } else {
    const rows = view.sum
      ? [...view.rows, view.sum.map((v) => v / view.rows.length)]
      : view.rows;
    const k = rows[0]!.length;
    const lab = 62;
    const rh = 16;
    h = top + rows.length * rh + 8;
    const mx = Math.max(1e-300, ...rows.flat().map(Math.abs));
    const cw = (R - L - lab) / k;
    rows.forEach((r, w) => {
      const y = top + w * rh;
      const mid = y + rh / 2;
      const isSum = !!view.sum && w === rows.length - 1;
      parts.push(
        `<text x="${L}" y="${n2(y + rh - 3)}" font-size="11" fill="currentColor">${isSum ? "sum ÷ W" : `worker ${w}`}</text>`,
      );
      r.forEach((v, j) => {
        const hh = (Math.abs(v) / mx) * (rh / 2 - 1);
        parts.push(
          `<rect x="${n2(L + lab + j * cw + 1)}" y="${n2(v >= 0 ? mid - hh : mid)}" width="${n2(Math.max(1, cw - 2))}" height="${n2(Math.max(0.5, hh))}" fill="${isSum ? C.b : C.a}"/>`,
        );
      });
    });
    parts.push(
      `<text x="${L}" y="13" font-size="11" fill="currentColor">${nar ? `${k} band values per worker` : `each worker's ${k} band values${view.sum ? "; last row: the switch's sum ÷ workers" : ""}`}</text>`,
    );
  }
  return `<svg viewBox="0 0 ${n2(width)} ${n2(h)}" width="100%" role="img" aria-label="The chunk's values at this stage" style="display:block">${parts.join("")}</svg>`;
}

/** Bytes per worker per step on this hop: the band (or E′) against top-k, as horizontal bars. */
export function bytesSvg(
  bytes: NonNullable<Stage["bytes"]>,
  all: ChainBytes,
  width: number,
): string {
  const rows: [string, number, string][] = [];
  for (const b of bytes) {
    rows.push([b.label, b.value, C.a]);
    if (b.topk !== undefined) rows.push([b.topkLabel ?? "top-k", b.topk, C.b]);
  }
  const mx = Math.max(all.dense, ...rows.map((r) => r[1]));
  const narrow = width < 560;
  const lab = narrow ? 0 : 230;
  const rh = narrow ? 34 : 20;
  const h = rows.length * rh + 4;
  const parts = rows.map(([name, v, c], i) => {
    const y = i * rh;
    const by = narrow ? y + 16 : y + 3;
    const w = Math.max(2, ((width - lab - 90) * v) / mx);
    return (
      `<text x="0" y="${n2(narrow ? y + 12 : y + 14)}" font-size="11" fill="currentColor">${esc(name)}</text>` +
      `<rect x="${lab}" y="${n2(by)}" width="${n2(w)}" height="13" fill="${c}"/>` +
      `<text x="${n2(lab + w + 5)}" y="${n2(by + 11)}" font-size="11" fill="currentColor">${(v / 1e6).toFixed(2)} MB</text>`
    );
  });
  return `<svg viewBox="0 0 ${n2(width)} ${h}" width="100%" role="img" aria-label="Bytes per worker per step on this hop" style="display:block">${parts.join("")}</svg>`;
}
