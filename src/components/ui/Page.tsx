/**
 * Page scaffolding shared by every page: the kicker, title and lead, and
 * sections with anchored headings. Server Components.
 */
import type { ReactNode } from "react";

export const A =
  "focus-ring rounded text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent dark:text-accent-light";

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <header>
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-accent-light">
        {kicker}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {children && (
        <div className="mt-4 max-w-3xl text-lg text-neutral-600 dark:text-neutral-300">
          {children}
        </div>
      )}
    </header>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="mt-12 scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">
        <a href={`#${id}`} className="focus-ring rounded hover:underline">
          {title}
        </a>
      </h2>
      <div className="mdx-content min-w-0">{children}</div>
    </section>
  );
}

export function Main({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {children}
    </main>
  );
}
