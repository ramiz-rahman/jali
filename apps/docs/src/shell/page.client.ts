/** "Copy page" in a page's header (./Page.tsx: `[data-copy-page]`, the address of the page's Markdown copy). */
import { copyText, showCopied } from "../client/clipboard";

export function initCopyPage() {
  document.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLElement>("[data-copy-page]");
    if (!button) return;
    const md = fetch(button.dataset.copyPage!).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.text();
    });
    void copyText(md)
      .catch(() => false)
      .then((ok) => showCopied(button, ok, { text: "Copy page" }));
  });
}
