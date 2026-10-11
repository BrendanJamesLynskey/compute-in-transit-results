/**
 * The family's visual language (explained_sites_visual_standard.md §3):
 * Okabe and Ito's colour-blind-safe palette, the same in light and dark
 * mode, as on the companion sites; this site adds one colour per kind of
 * configuration, energy selector, simulated variant and hot spot. Colours are fills and strokes, never text on white
 * (sky and yellow text fail contrast). "Active" is a highlight, "done" is
 * muted, and waiting is grey plus a hatch pattern, never colour alone.
 *
 * Okabe, M. and Ito, K. (2008), "Color Universal Design (CUD): how to make
 * figures and presentations that are friendly to colorblind people",
 * https://jfly.uni-koeln.de/color/
 */

export const OKABE_ITO = {
  black: "#000000",
  orange: "#E69F00",
  sky: "#56B4E9",
  green: "#009E73",
  yellow: "#F0E442",
  blue: "#0072B2",
  vermillion: "#D55E00",
  purple: "#CC79A7",
} as const;

/**
 * One colour per kind of configuration (the experiment's A to F), the same
 * on every page. Within a kind, lines are told apart by dash and marker,
 * never by colour alone. The first optics design (diverged) is vermillion,
 * the "error" colour; yellow is always drawn with a dark outline.
 */
export const KIND_COLOUR = {
  A: OKABE_ITO.blue,
  B: OKABE_ITO.orange,
  C: OKABE_ITO.green,
  D: OKABE_ITO.purple,
  E: OKABE_ITO.sky,
  Ec: "#737373",
  E0: OKABE_ITO.vermillion,
  F: "#a3a3a3",
} as const;

/** The energy selectors (results.md section 2's columns). */
export const SELECTOR_COLOUR: Record<string, string> = {
  topk: OKABE_ITO.orange,
  low: OKABE_ITO.green,
  zigzag: OKABE_ITO.sky,
  high: OKABE_ITO.purple,
  random: "#a3a3a3",
  calib: OKABE_ITO.blue,
};

/** The simulation's variants (A, B, C as measured; E; the hypothetical C′, E′). */
export const VARIANT_COLOUR: Record<string, string> = {
  adamw: OKABE_ITO.blue,
  topk: OKABE_ITO.orange,
  band: OKABE_ITO.green,
  "band-pluggable": OKABE_ITO.sky,
  "band-allreduce": OKABE_ITO.purple,
  "band-switch": OKABE_ITO.vermillion,
};

/** Where a step's time goes (the simulation's hot-spot categories). */
export const CATEGORY_COLOUR: Record<string, string> = {
  compute: "#737373",
  "intra-DC link": OKABE_ITO.sky,
  "inter-DC link": OKABE_ITO.blue,
  "module port": OKABE_ITO.orange,
  "module optics": OKABE_ITO.purple,
  "module compute": OKABE_ITO.vermillion,
  FPGA: OKABE_ITO.green,
};

/** States of an element in an animation. */
export const STATE_COLOUR = {
  active: OKABE_ITO.blue,
  error: OKABE_ITO.vermillion,
} as const;

/** Muted ("done", "idle") greys: Tailwind neutral-400 and neutral-600. */
export const MUTED = { light: "#a3a3a3", dark: "#525252" } as const;
