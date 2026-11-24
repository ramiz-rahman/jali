/**
 * The nav as a drawer on a phone (./TopBar.tsx: `#nav-drawer`, a native <dialog>, opened by `[data-drawer-open]`):
 * it closes from its button, a press on the backdrop, or a link followed.
 */
export function initNavDrawer() {
  const drawer = document.querySelector<HTMLDialogElement>("#nav-drawer");
  const open = document.querySelector<HTMLButtonElement>("[data-drawer-open]");
  if (!drawer || !open) return;
  open.addEventListener("click", () => {
    drawer.showModal();
    open.setAttribute("aria-expanded", "true");
  });
  drawer.addEventListener("close", () => open.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t === drawer || t.closest("[data-drawer-close]") || t.closest("a")) drawer.close();
  });
}
