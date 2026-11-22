/**
 * Who hears what an instance did, and when. Changes are gathered while a commit runs (an action, a raw write, and
 * anything they call) and told once it ends: subscribers once, then the app's events (`jali.on`) in the order the
 * batches ended. A listener that acts ends a batch of its own while one is being told: its events wait behind that
 * one's, so the app hears changes in the order they were made, and the last `layout` event is the layout now.
 *
 * The store owns the state; this owns batching, the queue of batches to tell, and turning two states into events.
 */
import * as core from "../layout/engine";
import { sameRef } from "../layout/ops/ref";
import { currentInput, type JaliInput } from "../dom/input";
import type { ActionName } from "../actions/public";
import type { Op } from "./apply";
import type { JaliEvent, JaliEvents } from "./instance";
import type { UiState } from "./store";

export interface CommitEvents {
  /** Listen to one of the app's events; returns the stop. Toasts sent before anyone listened are told now. */
  on<E extends JaliEvent>(event: E, handler: (event: JaliEvents[E]) => void): () => void;
  /** Hear every change, once per batch. */
  subscribe(fn: () => void): () => void;
  /** Run `run` as one batch (or as part of the one running): told once the outermost batch ends. */
  batch<T>(run: () => T): T;
  /** The state changed in this batch. */
  changed(): void;
  /** A layout op was committed in this batch, for `action` when one is named. */
  committed(op: Op, action?: ActionName): void;
  /** The state the running batch started from, or undefined outside a batch. */
  batchStart(): UiState | undefined;
  /** A toast, for whoever listens to `on("toast")`; kept until someone does. */
  toast(t: Omit<JaliEvents["toast"], "input">): void;
}

/** The events of an instance whose state `read` gives. */
export function createEvents(read: () => UiState): CommitEvents {
  const handlers = new Map<JaliEvent, Set<(e: never) => void>>();
  const subs = new Set<() => void>();
  const pendingToasts: JaliEvents["toast"][] = [];
  const emit = <E extends JaliEvent>(event: E, e: JaliEvents[E]) => {
    for (const fn of handlers.get(event) ?? []) {
      try {
        (fn as (e: JaliEvents[E]) => void)(e);
      } catch (err) {
        console.error(err);
      }
    }
  };

  let depth = 0;
  /** The state changed in this batch: subscribers hear it once, when the batch ends. */
  let changed = false;
  /** Batches that ended and are still to be told, oldest first. */
  const queue: {
    before: UiState;
    after: UiState;
    ops: Op[];
    named?: ActionName;
    input: JaliInput;
  }[] = [];
  let telling = false;
  let from: UiState = read();
  /** Where this batch's change came from, read when it starts. */
  let input: JaliInput = "code";
  /** Layout ops committed in this batch: a refit alone is not a layout change. */
  let ops: Op[] = [];
  /** The first public action that committed a layout op in this batch. */
  let named: ActionName | undefined;

  /** Tells the app what a batch changed: its own `ops`, `named` and `input`, read as it ended. A listener that acts
   *  starts a batch of its own, which must not rename this one's `layout` event. */
  const told = (
    before: UiState,
    after: UiState,
    ops: readonly Op[],
    named: ActionName | undefined,
    input: JaliInput,
  ) => {
    if (after.layout !== before.layout) {
      const was = new Map(core.tree.panes(before.layout.root).map((p) => [p.id, p.ref]));
      const pinnedBefore = new Map(
        core.tree.panes(before.layout.root).map((p) => [p.id, !!p.pinned]),
      );
      const now = core.tree.panes(after.layout.root);
      const ids = new Set(now.map((p) => p.id));
      for (const [pane, ref] of was) if (!ids.has(pane)) emit("close", { pane, ref, input });
      for (const p of now) {
        const previous = was.get(p.id);
        if (!previous) emit("open", { pane: p.id, ref: p.ref, input });
        else if (!sameRef(previous, p.ref))
          emit("open", { pane: p.id, ref: p.ref, previous, input });
      }
      for (const p of now) {
        const was = pinnedBefore.get(p.id);
        if (was !== undefined && was !== !!p.pinned)
          emit("pin", { pane: p.id, pinned: !!p.pinned, input });
      }
    }
    if (after.view.focused !== before.view.focused)
      emit("focus", { pane: after.view.focused, previous: before.view.focused, input });
    if (after.layout !== before.layout && ops.length)
      emit("layout", {
        layout: after.layout,
        source: ops.includes("arrive") ? "address" : "action",
        ...(named && !ops.includes("arrive") ? { action: named } : {}),
        input,
      });
  };

  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) handlers.set(event, (set = new Set()));
      set.add(handler as (e: never) => void);
      if (event === "toast") for (const t of pendingToasts.splice(0)) emit("toast", t);
      return () => {
        set.delete(handler as (e: never) => void);
        if (!set.size) handlers.delete(event);
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    batch(run) {
      if (depth++ === 0) {
        from = read();
        ops = [];
        named = undefined;
        input = currentInput();
      }
      try {
        return run();
      } finally {
        if (--depth === 0) {
          // Everything the batch did is in place (state, address, announcement) before anyone hears of it:
          // subscribers once, then the events, in the order batches ended.
          const state = read();
          if (handlers.size && from !== state)
            queue.push({ before: from, after: state, ops, named, input });
          if (changed) {
            changed = false;
            for (const fn of subs) fn();
          }
          if (!telling) {
            telling = true;
            try {
              for (let e; (e = queue.shift());) told(e.before, e.after, e.ops, e.named, e.input);
            } finally {
              telling = false;
            }
          }
        }
      }
    },
    changed: () => {
      changed = true;
    },
    committed(op, action) {
      ops.push(op);
      named ??= action;
    },
    batchStart: () => (depth ? from : undefined),
    toast(t) {
      const e = { ...t, input: currentInput() };
      if (handlers.has("toast")) emit("toast", e);
      else pendingToasts.push(e);
    },
  };
}
