import type { ClipboardEvent } from "react";

export function copyRaw(e: ClipboardEvent, exact = false) {
  const selection = window.getSelection();
  const node = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
  const element = node?.closest<HTMLElement>("[data-raw]");
  if (element?.dataset.raw !== undefined && selection && (exact ? selection.toString() === element.textContent : selection.toString().length <= (element.textContent?.length ?? 0))) {
    e.clipboardData.setData("text/plain", element.dataset.raw);
    e.preventDefault();
  }
}
