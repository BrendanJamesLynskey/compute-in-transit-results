/**
 * The Colab notebook, rendered at build time: markdown cells as text, code
 * cells highlighted by highlight.js on the server (no highlighter reaches
 * the browser). The notebook has no outputs; it is published as it ran.
 */
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import type { ReactNode } from "react";

import type { Notebook as NB } from "@/lib/data/load";

hljs.registerLanguage("python", python);

const A =
  "focus-ring rounded text-accent underline decoration-accent/40 underline-offset-2 dark:text-accent-light";

/** Inline markdown: **bold**, `code` and [links](url). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2]) out.push(<code key={k++}>{m[2]}</code>);
    else
      out.push(
        <a key={k++} className={A} href={m[4]}>
          {m[3]}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ src }: { src: string }): JSX.Element {
  const blocks = src.split(/\n\s*\n/);
  return (
    <div className="space-y-3 text-sm leading-6">
      {blocks.map((b, i) => {
        if (b.startsWith("# "))
          return (
            <h3 key={i} className="text-base font-semibold">
              {inline(b.slice(2))}
            </h3>
          );
        const lines = b.split("\n");
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={i} className="list-decimal space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}

export function Notebook({ nb }: { nb: NB }): JSX.Element {
  let code = 0;
  return (
    <ol className="space-y-4" data-testid="notebook">
      {nb.cells.map((c, i) => {
        const src = Array.isArray(c.source) ? c.source.join("") : c.source;
        if (c.cell_type === "markdown")
          return (
            <li
              key={i}
              className="min-w-0 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <Markdown src={src} />
            </li>
          );
        code += 1;
        const html = hljs.highlight(src, {
          language: "python",
          ignoreIllegals: true,
        }).value;
        return (
          <li key={i} className="min-w-0">
            <p className="mb-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
              In [{code}]
            </p>
            <pre
              tabIndex={0}
              aria-label={`Code cell ${code}`}
              className="focus-ring hljs min-w-0 overflow-x-auto rounded-lg bg-neutral-100 p-4 text-xs leading-5 dark:bg-neutral-900"
            >
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </li>
        );
      })}
    </ol>
  );
}
