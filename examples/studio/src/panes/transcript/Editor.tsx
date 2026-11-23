/** The line being corrected. Esc or ⌘↵ leaves it (the text stays in the draft); ⌘S saves every correction. */
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

/**
 * The field grows with its text and never scrolls, so Home, End and the Page keys would go on to scroll the list
 * round it and throw the row out of view. Here they are the caret's alone: Home and End take it to the start and the
 * end of the text (Shift extends the selection), and the Page keys do nothing.
 */
function moveCaret(e: KeyboardEvent<HTMLTextAreaElement>) {
  e.preventDefault();
  e.stopPropagation();
  if (e.key !== "Home" && e.key !== "End") return;
  const el = e.currentTarget;
  const to = e.key === "Home" ? 0 : el.value.length;
  if (!e.shiftKey) return el.setSelectionRange(to, to);
  const anchor = el.selectionDirection === "backward" ? el.selectionEnd : el.selectionStart;
  el.setSelectionRange(
    Math.min(anchor, to),
    Math.max(anchor, to),
    to < anchor ? "backward" : "forward",
  );
}

export function Editor({
  text,
  onChange,
  onDone,
  onSave,
}: {
  text: string;
  onChange(text: string): void;
  onDone(): void;
  onSave(): void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      className="tr-editor"
      aria-label="Correct the segment's text"
      value={text}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onClick={(e) => e.stopPropagation()}
      onBlur={onDone}
      onKeyDown={(e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (["Home", "End", "PageUp", "PageDown"].includes(e.key) && !mod) moveCaret(e);
        else if (e.key === "Escape" || (e.key === "Enter" && mod)) {
          e.preventDefault(); // ours: the first Esc leaves the field, not Jali's peek or maximise
          onDone();
        } else if (e.key === "Enter") e.preventDefault();
        else if (e.key === "s" && mod) {
          e.preventDefault();
          onSave();
        }
      }}
    />
  );
}
