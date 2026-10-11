/** The site's pages, shared by the e2e specs. */
export const PAGES = [
  "/",
  "/experiment",
  "/energy",
  "/optics",
  "/transit",
  "/notebook",
  "/method",
];

/** [page, test id] of every animation. */
export const ANIMATIONS = [
  ["/", "hero-home"],
  ["/experiment", "loss-curves"],
  ["/energy", "energy"],
  ["/optics", "feedback"],
  ["/optics", "clip"],
  ["/transit", "explorer"],
  ["/transit", "stages"],
  ["/transit", "queue"],
] as const;
