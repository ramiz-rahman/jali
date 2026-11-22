import { useEffect, useRef, type HTMLAttributes, type RefObject } from "react";
import { cssString } from "@jali/core/adapter";
import { useStore } from "../state/react";

const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]';

/** What Tab stops on inside `root`, in order: a radio group is one stop, its checked radio (or every radio, if none is). */
function tabStops(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) =>
      el.tabIndex >= 0 &&
      // Not one that isn't there to press: hidden, inert, or in something not displayed.
      !el.closest("[hidden], [inert]") &&
      el.checkVisibility?.({ visibilityProperty: true }) !== false &&
      !(
        el instanceof HTMLInputElement &&
        el.type === "radio" &&
        !el.checked &&
        root.querySelector(`input[type="radio"][name=${cssString(el.name)}]:checked`)
      ),
  );
}

/** The element `<JaliRoot>` renders its `overlays` in (a toaster), by the workspace's DOM id. */
export const overlaysDomId = (scope: string) => `${scope}-overlays`;

/**
 * Makes everything in the workspace but `keep` inert, and returns the undo: the root, or, when `keep` is inside the
 * root (a pane full screen holds the dialogs), every sibling on the way from `keep` up to the root. And the host's
 * overlays: a toast's Undo is as far out of reach as the panes behind. Jali's live region is in `keep` (the layer),
 * so what the workspace says is still heard.
 */
function inertOutside(keep: Element, root: Element | null, overlays: Element | null) {
  const made: HTMLElement[] = [];
  const hide = (el: Element) => {
    if (el instanceof HTMLElement && !el.inert && el !== keep) {
      el.inert = true;
      made.push(el);
    }
  };
  if (overlays && !overlays.contains(keep)) hide(overlays);
  if (root && !root.contains(keep)) hide(root);
  else
    for (let el = keep; root && el !== root && el.parentElement; el = el.parentElement)
      for (const sib of el.parentElement.children) if (!sib.contains(keep)) hide(sib);
  return () => made.forEach((el) => (el.inert = false));
}

interface ModalDialogProps extends HTMLAttributes<HTMLDivElement> {
  /** The scrim's class: `jali-scrim`, with `jali-scrim-light` for a lighter one. */
  scrim: string;
  role: "dialog" | "alertdialog";
  /** Esc, and a press on the scrim. */
  onClose(): void;
  /** What has focus when the dialog opens. Default: its first tab stop. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * A modal dialog (APG dialog): focus goes in when it opens and back to where it was when it closes; Tab and ⇧Tab wrap
 * inside it; the workspace behind and the host's overlays (a toaster) are inert; Esc and a press on the scrim close it. Render it only while open. While
 * the store holds focus (`focusHeld`), it moves none and leaves the workspace as it is.
 */
export function ModalDialog({
  scrim,
  onClose,
  initialFocus,
  children,
  onKeyDown,
  ...rest
}: ModalDialogProps) {
  const store = useStore();
  const ref = useRef<HTMLDivElement>(null);
  // Where focus was as the dialog opened: read while rendering, before anything moves it.
  const back = useRef(typeof document === "undefined" ? null : document.activeElement);
  useEffect(() => {
    const el = ref.current!;
    if (store.focusHeld) return undefined;
    (initialFocus?.current ?? tabStops(el)[0] ?? el).focus({ preventScroll: true });
    const undo = inertOutside(
      store.dom.layer() ?? el,
      store.dom.root() as Element | null,
      el.ownerDocument.getElementById(overlaysDomId(store.dom.id)),
    );
    const was = back.current as HTMLElement | null;
    return () => {
      undo();
      // Back where it was, unless the change the dialog made moved focus on purpose (or removed where it was).
      const now = document.activeElement;
      if (was?.isConnected && (!now || now === document.body || el.contains(now)))
        was.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        {...rest}
        ref={ref}
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          } else if (e.key === "Tab") {
            const stops = tabStops(ref.current!);
            const first = stops[0],
              last = stops[stops.length - 1];
            const at = document.activeElement;
            const to = e.shiftKey
              ? at === first || at === ref.current
                ? last
                : null
              : at === last
                ? first
                : null;
            if (to || !stops.length) {
              e.preventDefault();
              to?.focus();
            }
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
