import { useEffect, useRef, type HTMLAttributes, type RefObject } from "react";
import { cssString, lastPressedControl } from "@jali/core/adapter";
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

/** The element `<JaliRoot>` renders its `overlays` in (a toaster), by the instance's DOM id. */
export const overlaysDomId = (scope: string) => `${scope}-overlays`;

/**
 * Makes everything in the instance but `keep` inert, and returns the undo: the root, or, when `keep` is inside the
 * root (a pane full screen holds the dialogs), every sibling on the way from `keep` up to the root. And the host's
 * overlays: a toast's Undo is as far out of reach as the panes behind. Jali's live region is in `keep` (the layer),
 * so what the instance says is still heard.
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

/** Each document's open modals, oldest first: only the last (topmost) enforces focus, so two guards never compete. */
const open = /* @__PURE__ */ new WeakMap<Document, Set<Element>>();

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
 * inside it; the instance behind and the host's overlays (a toaster) are inert; Esc and a press on the scrim close it. Render it only while open. While
 * the store holds focus (`focusHeld`), it moves none and leaves the instance as it is.
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
  // Where focus was as the dialog opened: read while rendering, before anything moves it. Safari doesn't focus a button
  // it is clicked, so focus is on the page or on what had it before: the control last pressed (and no key since) is what
  // opened it, as it is in a browser that does focus it.
  const back = useRef(
    typeof document === "undefined"
      ? null
      : (lastPressedControl(document) ?? document.activeElement),
  );
  useEffect(() => {
    const el = ref.current!;
    if (store.focusHeld) return undefined;
    const doc = el.ownerDocument;
    const was = back.current as HTMLElement | null;
    const first = () =>
      (initialFocus?.current ?? tabStops(el)[0] ?? el).focus({ preventScroll: true });
    first();
    // A dialog that mounts again where it moves (into a pane that just went full screen) can mount before the one it
    // replaces lets go: that one's root is still inert, so focus can't come in, and its cleanup then puts focus back
    // behind the dialog. Once both are done, focus comes in.
    if (!el.contains(document.activeElement)) queueMicrotask(() => el.isConnected && first());
    const undo = inertOutside(
      store.dom.layer() ?? el,
      store.dom.root() as Element | null,
      el.ownerDocument.getElementById(overlaysDomId(store.dom.id)),
    );
    // Focus never leaves the dialog under Tab. The keydown handler below wraps at the ends, but where the browser's Tab
    // skips buttons (Safari's default), the last stop it would wrap from is one Tab never reaches, so Tab would go on
    // out. Whenever focus leaves while Tab is being pressed, it comes back in at the other end. The browser still
    // decides where Tab goes inside; nothing here moves it.
    let shift: boolean | undefined;
    open.set(doc, (open.get(doc) ?? new Set()).add(el));
    const note = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      shift = e.shiftKey;
      setTimeout(() => (shift = undefined));
    };
    const keep = (to: EventTarget | null) => {
      if (
        shift === undefined ||
        [...open.get(doc)!].pop() !== el ||
        (to instanceof Node && el.contains(to))
      )
        return;
      queueMicrotask(() => {
        if (el.contains(doc.activeElement)) return;
        const stops = tabStops(el);
        (shift ? stops.at(-1) : stops[0])?.focus({ preventScroll: true });
      });
    };
    const out = (e: FocusEvent) => keep(e.relatedTarget);
    doc.addEventListener("keydown", note, true);
    el.addEventListener("focusout", out);
    return () => {
      open.get(doc)!.delete(el);
      doc.removeEventListener("keydown", note, true);
      el.removeEventListener("focusout", out);
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
