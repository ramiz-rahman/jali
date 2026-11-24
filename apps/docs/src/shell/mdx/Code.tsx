/**
 * Code: `<Code>`, fenced blocks and inline code. Highlighted at build time (./highlight.ts); copy and wrap work in the
 * browser (./code.client.ts), which finds the buttons by their data attributes.
 */
import { Children, isValidElement, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import type { ThemedToken } from "shiki/core";
import { CheckIcon, CopyIcon, FileIcon } from "@phosphor-icons/react";
import { langOf, parseRanges, tokenize } from "./highlight";
import { textOf } from "./text";

export function CopyButton({ label = "Copy code" }: { label?: string }) {
  return (
    <button
      type="button"
      className="code-tool code-copy"
      aria-label={label}
      title={label}
      data-copy-code=""
    >
      <CopyIcon aria-hidden size={15} className="icon-idle" />
      <CheckIcon aria-hidden size={15} className="icon-done" />
      <span className="visually-hidden" aria-live="polite"></span>
    </button>
  );
}

/**
 * Wrap lines: the editors' glyph (a line that runs on, hooks round and returns under itself, then a short line).
 * Phosphor has none, so it is drawn on Phosphor's 256 grid with its regular stroke (16, round caps).
 */
function WrapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={16}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M40 64H216M40 128H180a32 32 0 0 1 0 64H140M164 168l-24 24 24 24M40 192H96" />
    </svg>
  );
}

/** Wrapping long lines is one choice for the whole site: `data-code-wrap` on <html>, remembered. */
function WrapButton() {
  return (
    <button
      type="button"
      className="code-tool code-wrap"
      aria-label="Wrap lines"
      title="Wrap lines"
      aria-pressed={false}
      data-wrap-toggle=""
    >
      <WrapIcon size={15} />
    </button>
  );
}

const fontStyleOf = (t: ThemedToken): CSSProperties | undefined => {
  const f = t.fontStyle ?? 0;
  return f > 0
    ? { fontStyle: f & 1 ? "italic" : undefined, fontWeight: f & 2 ? 600 : undefined }
    : undefined;
};

/** The columns a line's leading whitespace takes (a tab is two, as tab-size is): a wrapped line hangs below it. */
function indentOf(line: ThemedToken[]): number {
  const lead = /^[ \t]*/.exec(line.map((t) => t.content).join(""))?.[0] ?? "";
  let n = 0;
  for (const c of lead) n += c === "\t" ? 2 : 1;
  return n;
}

const trimCode = (code: string) => code.replace(/\n+$/, "");
/** A one-line shell command reads as a command, not a listing: it has no line number. */
const isOneLineShell = (code: string, lang: string) =>
  langOf(lang) === "sh" && !trimCode(code).includes("\n");

/** The highlighted lines of a block, with no frame or tools: the body of `<Code>`, an install line, an import line. */
export function CodeBody({
  code,
  lang,
  highlight,
  numbers,
}: {
  code: string;
  lang: string;
  highlight?: string;
  numbers: boolean;
}) {
  const text = trimCode(code);
  const tokens = tokenize(text, lang);
  const lit = parseRanges(highlight);
  const lines = tokens ?? text.split("\n").map((l) => [{ content: l, offset: 0 } as ThemedToken]);
  const digits = String(lines.length).length;
  return (
    <pre
      className="code-pre"
      tabIndex={0}
      data-lang={lang}
      data-lit={lit.size ? "" : undefined}
      data-numbers={numbers ? "" : undefined}
      style={numbers ? ({ "--code-digits": `${digits}ch` } as CSSProperties) : undefined}
    >
      <code>
        {lines.map((line, i) => {
          const indent = indentOf(line);
          return (
            <span
              key={i}
              className="code-line"
              data-n={numbers ? i + 1 : undefined}
              data-lit={lit.has(i + 1) || undefined}
              style={indent ? ({ "--code-indent": `${indent}ch` } as CSSProperties) : undefined}
            >
              <span className="code-text">
                {line.length && line.some((t) => t.content)
                  ? line.map((t, j) => (
                      <span
                        key={j}
                        style={{ color: tokens ? t.color : undefined, ...fontStyleOf(t) }}
                      >
                        {t.content}
                      </span>
                    ))
                  : "​"}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}

/**
 * A code sample: `code` is the text (often `import x from "./sample.tsx?raw"`), `highlight` is "3-5,9".
 * `numbers` shows line numbers; on by default, off by default for a one-line shell command.
 */
export function Code({
  code,
  lang = "tsx",
  filename,
  highlight,
  numbers,
}: {
  code: string;
  lang?: string;
  filename?: string;
  highlight?: string;
  numbers?: boolean;
}) {
  const tools = (
    <>
      <WrapButton />
      <CopyButton />
    </>
  );
  return (
    <figure
      className="code"
      data-code=""
      data-lang={lang}
      data-has-header={filename ? "" : undefined}
    >
      {filename ? (
        <figcaption className="code-header">
          <span className="code-filename">
            <FileIcon aria-hidden size={14} />
            {filename}
          </span>
          <span className="code-tools">{tools}</span>
        </figcaption>
      ) : (
        <div className="code-tools code-tools-float">{tools}</div>
      )}
      <CodeBody
        code={code}
        lang={lang}
        highlight={highlight}
        numbers={numbers ?? !isOneLineShell(code, lang)}
      />
    </figure>
  );
}

/** Fenced code blocks: the text and language come from the Markdown; the block looks exactly like <Code>. */
export function Pre(props: ComponentPropsWithoutRef<"pre"> & Record<string, unknown>) {
  const child = Children.toArray(props.children)[0];
  const className = isValidElement<{ className?: string }>(child)
    ? (child.props.className ?? "")
    : "";
  const lang = /language-([\w-]+)/.exec(className)?.[1] ?? "text";
  const filename = props["data-filename"] as string | undefined;
  const highlight = props["data-highlight"] as string | undefined;
  return (
    <Code code={textOf(props.children)} lang={lang} filename={filename} highlight={highlight} />
  );
}

/** Inline code. A short token with no spaces (`[data-theme="dark"]`) never breaks inside itself, at a hyphen or not. */
export function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  const text = typeof props.children === "string" ? props.children : "";
  const whole = text.length > 0 && text.length <= 32 && !/\s/.test(text);
  return <code className="inline-code" data-whole={whole || undefined} {...props} />;
}
