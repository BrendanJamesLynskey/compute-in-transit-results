/**
 * Site-wide header.
 *
 * Server Component, adapted from the companion sites' `SiteHeader` (same
 * layout and classes). It carries their cross-site switch, where this site
 * is unlisted (in no track), so its place reads just "Compute in transit",
 * and, because it also belongs to the Compute in Transit series, a link to
 * the series' hub.
 */
import Link from "next/link";

import { HUB_URL } from "@/lib/site";

import { placeOf, SitePlace, SiteSwitch } from "./SiteSwitch";

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
          title={placeOf("transit").title}
          data-site-brand
          className="focus-ring whitespace-nowrap rounded text-sm tracking-tight"
        >
          <SitePlace current="transit" />
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
          {/* This nav wraps on phones, so the switch is pushed to the right
              end of its line: its dropdown opens leftwards (right-0) and would
              otherwise start off-screen. */}
          <div className="ml-auto flex items-center lg:ml-0">
            <SiteSwitch current="transit" />
          </div>
        </nav>
      </div>
    </header>
  );
}
