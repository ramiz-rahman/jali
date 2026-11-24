/** The 404 names the address it was served for (./NotFound.tsx: `[data-not-found-path]`), which the file can't know. */
export function initNotFound() {
  const slot = document.querySelector("[data-not-found-path]");
  if (!slot) return;
  const code = document.createElement("code");
  code.className = "inline-code";
  code.textContent = window.location.pathname;
  slot.replaceChildren(code);
}
