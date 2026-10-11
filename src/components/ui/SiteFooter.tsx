/**
 * Site-wide footer: where the numbers come from, and the naming rule's
 * wording for the module.
 */
import Link from "next/link";

import { EXPERIMENT_REPO, GITHUB_URL, HUB_URL, SIM_REPO } from "@/lib/site";

const A =
  "focus-ring rounded underline decoration-neutral-400 underline-offset-2 hover:decoration-current";

export function SiteFooter(): JSX.Element {
  return (
    <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs text-neutral-600 sm:px-6 dark:text-neutral-400">
        <p>
          Every number on this site is read from the results of{" "}
          <a className={A} href={EXPERIMENT_REPO}>
            DeMo_Fixed_Band_Experiment
          </a>{" "}
          and{" "}
          <a className={A} href={SIM_REPO}>
            Training_Transit_Sim
          </a>
          , vendored at pinned commits (
          <Link className={A} href="/method#vendored">
            the method
          </Link>
          ).
        </p>
        <p>
          Part of the{" "}
          <a className={A} href={HUB_URL}>
            Compute in Transit
          </a>{" "}
          series. Source:{" "}
          <a className={A} href={GITHUB_URL}>
            compute-in-transit-results
          </a>{" "}
          (MIT).
        </p>
      </div>
    </footer>
  );
}
