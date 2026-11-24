/** Copying, for the page's copy buttons (code, an install line, the page as Markdown), and saying it was copied. */

export async function copyText(text: string | Promise<string>): Promise<boolean> {
  // A promise goes to the clipboard as it is, so a copy that waits for a download keeps the click's permission.
  if (
    typeof text !== "string" &&
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
        }),
      ]);
      return true;
    } catch {
      /* fall through: copy the text once it is here */
    }
  }
  const value = await text;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const copiedTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/**
 * A button that copied says so for a moment: `data-copied` (its check mark), and "Copied" as its name (`label`, for
 * an icon button named by aria-label) or in its live region (`text`, the words it goes back to).
 */
export function showCopied(
  button: HTMLElement,
  ok: boolean,
  idle: { label?: string; text?: string },
) {
  if (!ok) return;
  const live = button.querySelector<HTMLElement>("[aria-live]");
  button.setAttribute("data-copied", "");
  if (idle.label) {
    button.setAttribute("aria-label", "Copied");
    button.title = "Copied";
  }
  if (live) live.textContent = "Copied";
  clearTimeout(copiedTimers.get(button));
  copiedTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute("data-copied");
      if (idle.label) {
        button.setAttribute("aria-label", idle.label);
        button.title = idle.label;
      }
      if (live) live.textContent = idle.text ?? "";
    }, 1600),
  );
}
