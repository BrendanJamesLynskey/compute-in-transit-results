/**
 * Site-wide header.
 *
 * Server Component, adapted from the companion sites' `SiteHeader` (same
 * layout and classes). This site is not in their cross-site switch: it
 * belongs to the Compute in Transit series, so the header links to the
 * series' hub instead.
 */
import Link from "next/link";

import { HUB_URL } from "@/lib/site";

const NAV = [
  { href: "/experiment", label: "Experiment" },
  { href: "/energy", label: "Energy" },
  { href: "/optics", label: "Optics" },
  { href: "/transit", label: "Transit" },
  { href: "/notebook", label: "Notebook" },
  { href: "/method", label: "Method" },
] as const;

export function SiteHeader(): JSX.Element {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="focus-ring rounded font-mono text-sm font-medium tracking-tight"
        >
          compute-in-transit-results
        </Link>
        <nav
          aria-label="Site"
          className="flex flex-wrap items-center gap-1 text-sm sm:gap-3"
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="focus-ring inline-flex min-h-11 items-center rounded px-2 text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
            >
              {n.label}
            </Link>
          ))}
          <a
            href={HUB_URL}
            className="focus-ring inline-flex min-h-11 items-center rounded border border-neutral-300 px-2 text-neutral-700 hover:border-accent hover:text-neutral-950 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-white"
          >
            Series hub ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
