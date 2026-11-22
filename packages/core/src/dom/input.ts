/**
 * Where a change came from: the kind of input a person used, an agent, or the app's own code. Every event carries it
 * (`jali.on("close", ({ input }) => …)`), so an app can tell a person's close from its own, or from an agent's.
 *
 * A person's input is read from the page: a capture listener on the document notes each pointer press and key press,
 * and the note lasts until the current task ends, so an action that runs in that event's handlers (Jali's or the
 * app's) sees it. Anything that runs later (after a timer or an await) reads as `code`. An agent's actions run inside
 * `withInput("agent", …)`, which wins over the page.
 */

/**
 * - `mouse`, `touch`, `pen`: a pointer of that kind.
 * - `keyboard`: a key.
 * - `virtual`: a click with no pointer or key behind it, as a screen reader sends.
 * - `agent`: an agent, through the agent bridge.
 * - `code`: the app's own code, with no input of a person's behind it.
 */
export type JaliInput = "mouse" | "touch" | "pen" | "keyboard" | "virtual" | "agent" | "code";

let noted: JaliInput | undefined;
let clear: ReturnType<typeof setTimeout> | undefined;
let held: JaliInput[] = [];
/** How many started instances listen on each document (a floating window's is a document of its own). */
const listening = /* @__PURE__ */ new WeakMap<Document, number>();

const note = (input: JaliInput) => {
  noted = input;
  if (clear === undefined)
    clear = setTimeout(() => {
      noted = undefined;
      clear = undefined;
    });
};
const onPointer = (e: PointerEvent) =>
  note(e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse");
const onKey = () => note("keyboard");
/** A click is a pointer's when a press came first in this task; otherwise a key's (Enter, Space) or a virtual one. */
const onClick = (e: MouseEvent) => {
  if (noted === undefined) note(e.detail === 0 ? "virtual" : "mouse");
};

/** The input behind a change starting now. */
export const currentInput = (): JaliInput => held.at(-1) ?? noted ?? "code";

/** Run `fn` with every change it makes marked as `input` (the agent bridge passes `agent`). */
export function withInput<T>(input: JaliInput, fn: () => T): T {
  held.push(input);
  try {
    return fn();
  } finally {
    held.pop();
  }
}

/** Listen for a person's input on `doc` while any instance is started there. Returns the stop. */
export function trackInput(doc: Document | undefined = globalThis.document): () => void {
  if (!doc) return () => {};
  const n = listening.get(doc) ?? 0;
  listening.set(doc, n + 1);
  if (n === 0) {
    doc.addEventListener("pointerdown", onPointer, true);
    doc.addEventListener("pointerup", onPointer, true);
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("click", onClick, true);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const left = (listening.get(doc) ?? 1) - 1;
    listening.set(doc, left);
    if (left === 0) {
      doc.removeEventListener("pointerdown", onPointer, true);
      doc.removeEventListener("pointerup", onPointer, true);
      doc.removeEventListener("keydown", onKey, true);
      doc.removeEventListener("click", onClick, true);
    }
  };
}
