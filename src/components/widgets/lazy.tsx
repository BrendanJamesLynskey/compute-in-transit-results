"use client";

/**
 * Code-split client widgets: each loads its own chunk after the page shell,
 * so pages stay light (the pattern of the companion sites' lazy.tsx). Each
 * widget takes its data as props from the server page.
 */
import dynamic from "next/dynamic";

function Placeholder({ what }: { what: string }): JSX.Element {
  return (
    <p
      data-pending-widget
      className="my-8 min-h-96 text-sm text-neutral-600 dark:text-neutral-400"
    >
      Loading the {what}…
    </p>
  );
}

const loading = (what: string) =>
  function Loading(): JSX.Element {
    return <Placeholder what={what} />;
  };

export const LossCurves = dynamic(() => import("./LossCurves"), {
  ssr: false,
  loading: loading("loss curves"),
});
export const EnergyRace = dynamic(() => import("./EnergyRace"), {
  ssr: false,
  loading: loading("energy animation"),
});
export const FeedbackLoop = dynamic(() => import("./FeedbackLoop"), {
  ssr: false,
  loading: loading("error-feedback animation"),
});
export const ClipTimeline = dynamic(() => import("./ClipTimeline"), {
  ssr: false,
  loading: loading("optics runs"),
});
export const TransitExplorer = dynamic(() => import("./TransitExplorer"), {
  ssr: false,
  loading: loading("bandwidth explorer"),
});
export const StageBars = dynamic(() => import("./StageBars"), {
  ssr: false,
  loading: loading("module stages"),
});
export const BreakEven = dynamic(() => import("./BreakEven"), {
  ssr: false,
  loading: loading("break-even curves"),
});
export const WanQueue = dynamic(() => import("./WanQueue"), {
  ssr: false,
  loading: loading("shared-WAN animation"),
});
export const ChainDiagram = dynamic(() => import("./ChainDiagram"), {
  ssr: false,
  loading: loading("chain animation"),
});
