/**
 * Root layout for the App Router.
 *
 * Server Component, copied from transformer-explainer's layout (via the companion sites): HTML
 * scaffold, the global stylesheet, the site header and the footer. Dark mode follows
 * the system setting (`darkMode: "media"` in tailwind.config.ts).
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Compute in Transit: Results",
    template: "%s · Compute in Transit: Results",
  },
  description:
    "Can a fixed frequency band replace DeMo's top-k so a photonic link module can compress gradients in transit? The experiment's loss curves, captured energy and emulated optics, the training-transit simulation's break-evens, and the Colab notebook that ran it.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
