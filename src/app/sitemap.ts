/**
 * /sitemap.xml: every page, at this site's production address.
 */
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

const PAGES = [
  "/",
  "/experiment",
  "/energy",
  "/optics",
  "/transit",
  "/notebook",
  "/method",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: p === "/" ? SITE_URL : `${SITE_URL}${p}` }));
}
