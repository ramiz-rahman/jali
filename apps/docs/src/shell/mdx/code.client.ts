/**
 * The code tools (./Code.tsx): `[data-wrap-toggle]` wraps long lines on every block on the site (`data-code-wrap` on
 * <html>, remembered), and `[data-copy-code]` copies the code its block shows (for an install line, the command of
 * the manager chosen).
 */
import { copyText, showCopied } from "../../client/clipboard";
import { all } from "../../client/dom";
import { STORAGE_KEYS, writeStored } from "../../ui/lib/storage";

/** A block's text as written: each line's text, without the zero-width space that holds an empty line open. */
const codeText = (pre: Element | undefined) =>
  pre
    ? all(".code-line", pre)
        .map((l) => (l.textContent ?? "").replace(/​/g, ""))
        .join("\n")
    : "";

export function initCodeTools() {
  const root = document.documentElement;
  const setWrap = (on: boolean) => {
    root.toggleAttribute("data-code-wrap", on);
    for (const b of all("[data-wrap-toggle]")) b.setAttribute("aria-pressed", String(on));
  };
  setWrap(root.hasAttribute("data-code-wrap"));
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.codeWrap) setWrap(e.newValue === "1");
  });
  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    const wrap = target.closest<HTMLElement>("[data-wrap-toggle]");
    if (wrap) {
      // Blocks above change height: keep the button where the reader's pointer is.
      const top = wrap.getBoundingClientRect().top;
      const on = !root.hasAttribute("data-code-wrap");
      writeStored(STORAGE_KEYS.codeWrap, on ? "1" : "0");
      setWrap(on);
      const moved = wrap.getBoundingClientRect().top - top;
      if (Math.abs(moved) > 1) window.scrollBy({ top: moved, behavior: "instant" });
      return;
    }
    const copy = target.closest<HTMLElement>("[data-copy-code]");
    if (!copy) return;
    // The block the figure shows: its one <pre>, or the one an install line shows now.
    const shown = all(".code-pre", copy.closest(".code") ?? copy).find(
      (pre) => !pre.closest("[hidden]"),
    );
    const label = copy.getAttribute("aria-label") ?? "Copy code";
    void copyText(codeText(shown)).then((ok) => showCopied(copy, ok, { label }));
  });
}
