"use client"

import * as React from "react"
import { Check, Copy, FileCode2, X } from "lucide-react"
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx"
import { haptic } from "#src/vendor/cyberspec/lib/haptics.ts"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import { copyText } from "#src/vendor/cyberspec/lib/clipboard.ts"
import "#src/vendor/cyberspec/components/ui/cyber/code-block.css"

type Language = "ts" | "tsx" | "js" | "bash" | "json" | "css" | "text"

// What a stretch of code is. "name" is whatever gives code its structure
// in a language: a JSX tag, a JSON key, a CSS property, a shell command.
type Kind = "comment" | "string" | "keyword" | "number" | "constant" | "name" | "punct" | "plain"
type Token = { kind: Kind; text: string }

// A grammar is a list of rules tried in order at each position. A rule is a
// sticky pattern and the kind it yields, or a function that looks at what's
// around the match and decides, returning null to let the next rule try.
type Rule = [pattern: RegExp, kind: Kind | ((source: string, start: number, end: number) => Kind | null)]

const words = (list: string) => new Set(list.split(" "))

const doubleQuoted = `"(?:\\\\.|[^"\\\\\\n])*"`
const singleQuoted = `'(?:\\\\.|[^'\\\\\\n])*'`

// ── JavaScript and TypeScript ───────────────────────────────────────────

const jsKeywords = words(
  "async await break case catch class const continue debugger default delete do else enum export extends finally for function if implements import in instanceof interface keyof let new private protected public readonly return satisfies static super switch this throw try typeof var void while yield",
)
// Words that are keywords only where the grammar puts them: `type Foo =` is
// one, the `type` in `type="submit"` isn't.
const jsContextual = words("as from of type")
const jsConstants = words("true false null undefined NaN Infinity")

const jsWord =
  (jsx: boolean) =>
  (source: string, start: number, end: number): Kind => {
    const word = source.slice(start, end)
    const before = source[start - 1]
    // A member of something, whatever it's called: `list.default`.
    if (before === ".") return "plain"
    if (jsConstants.has(word)) return "constant"
    if (jsKeywords.has(word)) return "keyword"
    if (jsContextual.has(word)) return /^\s*[^\s=:,;.)}\]?]/.test(source.slice(end, end + 16)) ? "keyword" : "plain"
    if (jsx) {
      // A tag: the word right after `<` or `</`, unless that `<` follows a
      // name or a closing bracket, where it's a generic or a comparison.
      const open = before === "<" ? start - 1 : before === "/" && source[start - 2] === "<" ? start - 2 : -1
      if (open >= 0 && !/[\w$)\]]/.test(source[open - 1] ?? "")) return "name"
    }
    return "plain"
  }

const javascript = (jsx: boolean): Rule[] => [
  [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, "comment"],
  [new RegExp(`${doubleQuoted}|${singleQuoted}|\`(?:\\\\[\\s\\S]|[^\`\\\\])*\``, "y"), "string"],
  [/(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)n?/y, "number"],
  [/[A-Za-z_$][\w$]*/y, jsWord(jsx)],
]

// ── JSON ────────────────────────────────────────────────────────────────

const json: Rule[] = [
  // A string followed by a colon is a key.
  [new RegExp(doubleQuoted, "y"), (source, _start, end) => (/^\s*:/.test(source.slice(end, end + 8)) ? "name" : "string")],
  [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, "number"],
  [/\b(?:true|false|null)\b/y, "constant"],
]

// ── CSS ─────────────────────────────────────────────────────────────────

const css: Rule[] = [
  [/\/\*[\s\S]*?\*\//y, "comment"],
  [new RegExp(`${doubleQuoted}|${singleQuoted}`, "y"), "string"],
  [/@[\w-]+/y, "keyword"],
  [/#[\da-fA-F]{3,8}(?![\w-])/y, "constant"],
  [
    /--[\w-]+|-?[A-Za-z_][\w-]*/y,
    (source, start, end) => {
      if (source.startsWith("--", start)) return "constant"
      if (source[start - 1] === "!") return "keyword"
      // A property: a word, a colon, then a value that ends before any
      // brace opens. `a:hover {` is a selector; `color: red;` isn't.
      const after = /^\s*:(?!:)[^{}\n;]*(;|\}|\n|$)/.test(source.slice(end, end + 200))
      return after ? "name" : "plain"
    },
  ],
  [/[+-]?(?:\d*\.)?\d+(?:%|[a-zA-Z]+)?/y, "number"],
]

// ── Shell ───────────────────────────────────────────────────────────────

const bashKeywords = words("if then else elif fi for in do done while until case esac function return export local readonly cd echo exit set unset source alias sudo")
const afterSpace = (source: string, start: number) => start === 0 || /\s/.test(source[start - 1] ?? "")

const bash: Rule[] = [
  [/#[^\n]*/y, (source, start) => (afterSpace(source, start) ? "comment" : null)],
  [new RegExp(`"(?:\\\\.|[^"\\\\])*"|${singleQuoted}`, "y"), "string"],
  [/\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|[0-9@#?*!$-])/y, "constant"],
  [/--?[A-Za-z][\w-]*/y, (source, start) => (afterSpace(source, start) ? "constant" : null)],
  [/\d+(?:\.\d+)?(?![\w.-])/y, (source, start) => (afterSpace(source, start) || source[start - 1] === "=" ? "number" : null)],
  [
    /[A-Za-z_][\w.-]*/y,
    (source, start, end) => {
      if (bashKeywords.has(source.slice(start, end))) return "keyword"
      // A command: the first word of a line, or of what follows a pipe, a
      // semicolon, `&&` or `$(`.
      return /(?:^|[\n|;&(])[ \t]*$/.test(source.slice(Math.max(0, start - 40), start)) ? "name" : "plain"
    },
  ],
]

const grammars: Record<Exclude<Language, "text">, Rule[]> = {
  ts: javascript(false),
  tsx: javascript(true),
  js: javascript(true),
  json,
  css,
  bash,
}

const tags: Record<Language, string> = { ts: "TS", tsx: "TSX", js: "JS", bash: "Bash", json: "JSON", css: "CSS", text: "Text" }

// One pass over the source: at each position the first rule that matches
// wins, and anything no rule wants is punctuation or plain text. Neighbors
// of the same kind are joined, so the page gets as few spans as it can.
function tokenize(source: string, rules: Rule[]) {
  const tokens: Token[] = []
  const push = (kind: Kind, text: string) => {
    const last = tokens[tokens.length - 1]
    if (last && last.kind === kind) last.text += text
    else tokens.push({ kind, text })
  }
  let index = 0
  scan: while (index < source.length) {
    for (const [pattern, kind] of rules) {
      pattern.lastIndex = index
      const match = pattern.exec(source)
      if (!match || !match[0]) continue
      const end = index + match[0].length
      const resolved = typeof kind === "function" ? kind(source, index, end) : kind
      if (!resolved) continue
      push(resolved, match[0])
      index = end
      continue scan
    }
    push(/[\s\p{L}\p{N}_]/u.test(source[index] ?? "") ? "plain" : "punct", source[index] ?? "")
    index += 1
  }
  return tokens
}

// Tokens can run across lines (a block comment, a template string): cut
// them at the line breaks, so each line can be laid out with its number.
function toLines(tokens: Token[]) {
  const lines: Token[][] = [[]]
  for (const token of tokens) {
    token.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1]!.push({ kind: token.kind, text: part })
    })
  }
  return lines
}

// Below this width there's no room over the panel for a tab, a tag and a
// key with a word on it.
const compactBelow = 288

// Two facts about the panel that depend on its size: whether its content
// overflows it, either way, and whether it's too narrow for the full head.
function usePanelSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ overflows: false, compact: false })
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => {
      const overflows = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1
      const compact = node.offsetWidth < compactBelow
      setSize((last) => (last.overflows === overflows && last.compact === compact ? last : { overflows, compact }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return size
}

// Code on a panel: numbered lines, highlighted by a small tokenizer of its
// own, under a tab with the file's name, a language tag and a copy key. The
// key confirms in the signal color, the line numbers light with it, and the
// result is announced.
//
// - `code`: the source. A blank first line and trailing blank lines are
//   dropped, so it can be written as a template string.
// - `language`: "ts", "tsx", "js", "bash", "json", "css", or "text" for no
//   highlighting.
// - `filename`: printed on the tab, and used to name the block.
// - `label` names the block for assistive technology when there's no
//   filename, or when the filename isn't enough.
// - `numbers`: set it false to drop the line numbers.
// - `maxLines`: the block scrolls vertically past this many lines.
//
// Long lines scroll sideways inside the panel rather than wrapping, and
// whenever the panel scrolls it can take focus, so the arrow keys move it.
// In a narrow column the key keeps only its icon, and the tag gives its
// room to the filename.
function CodeBlock({
  code,
  language = "text",
  filename,
  label,
  numbers = true,
  maxLines,
  onCopy,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "onCopy"> & {
  code: string
  language?: Language
  filename?: string
  label?: string
  numbers?: boolean
  maxLines?: number
  onCopy?: (code: string) => void
}) {
  const source = React.useMemo(() => code.replace(/^\n/, "").replace(/\s+$/, ""), [code])
  const lines = React.useMemo(() => toLines(language === "text" ? [{ kind: "plain", text: source }] : tokenize(source, grammars[language])), [source, language])
  const bytes = React.useMemo(() => new TextEncoder().encode(source).length, [source])
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle")
  const timer = React.useRef<number | undefined>(undefined)
  const mounted = React.useRef(true)
  const body = React.useRef<HTMLDivElement>(null)
  const { overflows, compact } = usePanelSize(body)
  const name = label ?? filename ?? `${tags[language]} code`

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(timer.current)
    }
  }, [])

  // Returning the Promise keeps the key pending until the clipboard answers.
  const copy = async () => {
    window.clearTimeout(timer.current)
    try {
      await copyText(source)
      if (!mounted.current) return
      setState("copied")
      sfx("success")
      haptic("success")
      onCopy?.(source)
    } catch {
      if (!mounted.current) return
      setState("failed")
      sfx("deny")
      haptic("error")
    }
    if (mounted.current) timer.current = window.setTimeout(() => setState("idle"), 1800)
  }

  const digits = Math.max(2, String(lines.length).length)
  return (
    <div
      data-kit="code-block"
      data-language={language}
      data-state={state}
      data-compact={compact ? "" : undefined}
      style={{ "--max-lines": maxLines, "--digits": digits, ...style } as React.CSSProperties}
      {...props}
    >
      <div data-kit="code-block-head">
        {filename && (
          <span data-kit="code-block-file" data-frame="tr" title={filename}>
            <FileCode2 aria-hidden />
            <span data-kit="code-block-filename">{filename}</span>
          </span>
        )}
        <span data-kit="code-block-lang">{tags[language]}</span>
        <span data-kit="code-block-copy">
          {/* The key plays the outcome's sound itself, so the press is silent. */}
          <Button
            size="sm"
            tone={state === "copied" ? "signal" : state === "failed" ? "flag" : "secondary"}
            // In a narrow column the key is its icon alone; the word stays
            // in its name.
            icon={compact}
            data-sfx="none"
            onClick={copy}
          >
            {state === "copied" ? <Check aria-hidden /> : state === "failed" ? <X aria-hidden /> : <Copy aria-hidden />}
            <span data-kit="code-block-copy-label">{state === "copied" ? "Copied" : state === "failed" ? "Failed" : "Copy"}</span>
            <span data-sr-only> {name}</span>
          </Button>
        </span>
      </div>
      <div
        ref={body}
        data-kit="code-block-body"
        data-frame="br"
        data-numbers={numbers ? "" : undefined}
        // A panel that scrolls has to be reachable without a pointer.
        tabIndex={overflows ? 0 : undefined}
        role={overflows ? "region" : undefined}
        aria-label={overflows ? name : undefined}
      >
        <pre data-kit="code-block-pre">
          <code>
            {lines.map((line, index) => (
              <span key={index} data-kit="code-block-line">
                {numbers && (
                  <span data-kit="code-block-number" aria-hidden>
                    {String(index + 1).padStart(digits, "0")}
                  </span>
                )}
                <span data-kit="code-block-text">
                  {line.map((token, at) =>
                    token.kind === "plain" ? (
                      token.text
                    ) : (
                      <span key={at} data-token={token.kind}>
                        {token.text}
                      </span>
                    ),
                  )}
                  {"\n"}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
      <span data-micro aria-hidden>
        LN {String(lines.length).padStart(2, "0")} // {bytes} B // UTF-8
      </span>
      <span data-sr-only role="status">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn't copy" : ""}
      </span>
    </div>
  )
}

export { CodeBlock }
export type { Language as CodeBlockLanguage }
