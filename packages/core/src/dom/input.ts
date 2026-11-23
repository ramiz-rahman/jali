/**
 * Where a change came from: the kind of input a person used, or the app's own code. Every event carries it
 * (`jali.on("close", ({ input }) => …)`), so an app can tell a person's close from its own.
 *
 * A person's input is read from the page: a capture listener on the document notes each pointer press and key press,
 * and the note lasts until the current task ends, so an action that runs in that event's handlers (Jali's or the
 * app's) sees it. Anything that runs later (after a timer or an await) reads as `code`, except an action held for an
 * answer: the store runs its end inside `withInput`, with the input of whoever asked.
 */

/**
 * - `mouse`, `touch`, `pen`: a pointer of that kind.
 * - `keyboard`: a key.
 * - `virtual`: a click with no pointer or key behind it, as a screen reader sends.
 * - `code`: the app's own code, with no input of a person's behind it.
 */
export type JaliInput = "mouse" | "touch" | "pen" | "keyboard" | "virtual" | "code";

let noted: JaliInput | undefined;
let clear: ReturnType<typeof setTimeout> | undefined;
let held: JaliInput[] = [];
/** How many started instances listen on each document (a floating window's is a document of its own). */
const listening = /* @__PURE__ */ new WeakMap<Document, number>();

/** The element the last pointer press landed on in each document, until a key is pressed there. */
const pressed = /* @__PURE__ */ new WeakMap<Document, Element>();

/**
 * The control the last pointer press on `doc` landed on (a button, a link, or what a button is inside), while no key
 * has been pressed since. Safari does not focus a button it is clicked on, so a dialog opened from a button finds
 * focus on the page body, or on what had it before: the pressed control is where focus belongs when it closes.
 */
export function lastPressedControl(
  doc: Document | undefined = globalThis.document,
): HTMLElement | null {
  const el = doc ? pressed.get(doc) : undefined;
  const control = el?.closest<HTMLElement>(
    'button, a[href], [role="button"], summary, input, select, textarea',
  );
  // A menu's item closes the menu: it is never where focus goes back to.
  return control?.isConnected && !control.closest('[role="menu"]') ? control : null;
}

const note = (input: JaliInput) => {
  noted = input;
  if (clear === undefined)
    clear = setTimeout(() => {
      noted = undefined;
      clear = undefined;
    });
};
const onPointer = (e: PointerEvent) => {
  if (e.type === "pointerdown" && e.target instanceof Element)
    pressed.set(e.target.ownerDocument, e.target);
  note(e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse");
};
const onKey = (e: KeyboardEvent) => {
  const at = e.target;
  const doc = at instanceof Node ? (at.ownerDocument ?? (at as Document)) : undefined;
  if (doc) pressed.delete(doc);
  note("keyboard");
};
/** A click is a pointer's when a press came first in this task; otherwise a key's (Enter, Space) or a virtual one. */
const onClick = (e: MouseEvent) => {
  if (noted === undefined) note(e.detail === 0 ? "virtual" : "mouse");
};

/** The input behind a change starting now. */
export const currentInput = (): JaliInput => held.at(-1) ?? noted ?? "code";

/** Run `fn` with every change it makes marked as `input`: a held action's end, as whoever asked for it. */
export function withInput<T>(input: JaliInput, fn: () => T): T {
  held.push(input);
  try {
    return fn();
  } finally {
    held.pop();
  }
}

/** What each document is listened to for, in the capture phase. */
const LISTENERS = [
  ["pointerdown", onPointer],
  ["pointerup", onPointer],
  ["keydown", onKey],
  ["click", onClick],
] as [string, EventListener][];

/** Listen for a person's input on `doc` while any instance is started there. Returns the stop. */
export function trackInput(doc: Document | undefined = globalThis.document): () => void {
  if (!doc) return () => {};
  const n = listening.get(doc) ?? 0;
  listening.set(doc, n + 1);
  if (n === 0) for (const [type, fn] of LISTENERS) doc.addEventListener(type, fn, true);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const left = (listening.get(doc) ?? 1) - 1;
    listening.set(doc, left);
    if (left === 0) {
      pressed.delete(doc);
      for (const [type, fn] of LISTENERS) doc.removeEventListener(type, fn, true);
    }
  };
}
