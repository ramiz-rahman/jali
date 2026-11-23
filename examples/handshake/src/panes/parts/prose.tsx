/**
 * Renders the course's markup (markup.ts). Glossary links are buttons, because they act (they open the glossary)
 * rather than navigate; the caller says what opening a term does.
 */
import { Fragment, type ReactNode } from "react";
import { termById } from "#src/course/glossary.ts";
import { parseBody, parseInline, type Block, type Inline } from "#src/course/markup.ts";

interface Open {
  onTerm: (id: string) => void;
}

function Runs({ runs, onTerm }: Open & { runs: readonly Inline[] }): ReactNode {
  return runs.map((r, i) => {
    switch (r.t) {
      case "text":
        return <Fragment key={i}>{r.v}</Fragment>;
      case "code":
        return <code key={i}>{r.v}</code>;
      case "em":
        return (
          <em key={i}>
            <Runs runs={r.v} onTerm={onTerm} />
          </em>
        );
      case "strong":
        return (
          <strong key={i}>
            <Runs runs={r.v} onTerm={onTerm} />
          </strong>
        );
      case "term": {
        const term = termById(r.id);
        const label = r.label ?? term?.term ?? r.id;
        // An unknown id is a typo the course tests catch; on screen it stays readable and inert.
        if (!term) return <Fragment key={i}>{label}</Fragment>;
        return (
          <button key={i} type="button" className="term" onClick={() => onTerm(r.id)}>
            {label}
            <span data-sr-only> (open in the glossary)</span>
          </button>
        );
      }
    }
  });
}

/** A line of markup, with no block around it. */
export function InlineText({ text, onTerm }: Open & { text: string }) {
  return <Runs runs={parseInline(text)} onTerm={onTerm} />;
}

function BlockView({ block, onTerm }: Open & { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p>
          <Runs runs={block.v} onTerm={onTerm} />
        </p>
      );
    case "ul":
      return (
        <ul>
          {block.v.map((item, i) => (
            <li key={i}>
              <Runs runs={item} onTerm={onTerm} />
            </li>
          ))}
        </ul>
      );
    case "pre":
      return (
        <pre tabIndex={0}>
          <code>{block.v}</code>
        </pre>
      );
  }
}

/** Blocks of prose: pass the entries as written in the data files. */
export function Prose({ body, onTerm }: Open & { body: readonly string[] }) {
  return (
    <div className="prose">
      {parseBody(body).map((b, i) => (
        <BlockView key={i} block={b} onTerm={onTerm} />
      ))}
    </div>
  );
}
