/**
 * A pane's actions, written once: each is a command in ⌘K while the pane is focused, a key the pane answers to, and
 * (where the pane prints one) a key on its toolbar. So "Loop this line" has one title, one key and one `run`
 * wherever the person finds it.
 *
 * Jali gives the focused content every key first: the pane takes the keys its actions name, with `preventDefault()`,
 * and lets the rest (Space for the transport, ⌘K and the workspace's chords) bubble on.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { keyHint } from "jali-layout";
import { useCommands } from "jali-layout/react";
import { Key, type KeyProps } from "../ui/atoms/Key";
import { typingIn } from "../ui/lib/input";

/**
 * A key an action answers to: `KeyboardEvent.key` (a letter in either case), with the modifiers it needs. Any other
 * modifier makes it another key, but for Shift, which only counts when the key asks for it.
 */
export interface PaneKey {
  key: string;
  /** ⌘ on a Mac, Ctrl elsewhere. */
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface PaneAction {
  id: string;
  /** In ⌘K, and the toolbar key's tooltip (with its key). */
  title: string;
  run(): void;
  /** The keys it answers to; ⌘K shows the first. */
  keys?: readonly PaneKey[];
  /** Why it can't run now; its keys are still the pane's, and do nothing. */
  disabled?: false | string;
  /** A key only, not a command (the lists' peek on ⇧Space). */
  keyOnly?: boolean;
  /** A latch's state, for its toolbar key. */
  latched?: boolean;
  /** What its toolbar key shows: a glyph, a legend. */
  face?: ReactNode;
  /** The toolbar key's tooltip, when it says more than the title. */
  tip?: string;
}

/** "Mod+S", "Alt+Enter", "E" for a key: the hint ⌘K and a tooltip print. */
const hintOf = ({ key, mod, alt, shift }: PaneKey) =>
  keyHint(
    [
      mod && "Mod",
      alt && "Alt",
      shift && "Shift",
      key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key,
    ]
      .filter(Boolean)
      .join("+"),
  );

const matches = (k: PaneKey, e: KeyboardEvent) =>
  e.key.toLowerCase() === k.key.toLowerCase() &&
  (e.metaKey || e.ctrlKey) === !!k.mod &&
  e.altKey === !!k.alt &&
  (!k.shift || e.shiftKey);

/**
 * Registers the actions as the pane's commands, and gives back the pane's key handler: it runs the action a key
 * names and claims the key. It returns whether it did, so a list can try its own moves first or after.
 */
export function usePaneActions(actions: readonly PaneAction[]): (e: KeyboardEvent) => boolean {
  useCommands(
    actions
      .filter((a) => !a.keyOnly)
      .map(({ id, title, run, keys, disabled }) => ({
        id,
        title,
        run,
        keys: keys?.[0] && hintOf(keys[0]),
        disabled,
      })),
  );
  return (e) => {
    if (typingIn(e)) return false;
    const action = actions.find((a) => a.keys?.some((k) => matches(k, e)));
    if (!action) return false;
    e.preventDefault();
    if (!action.disabled) action.run();
    return true;
  };
}

/** An action's key on a toolbar: its face, its tooltip with its key, its latch. */
export function ActionKey({ action, ...key }: { action: PaneAction } & KeyProps) {
  const hint = action.keys?.[0] && hintOf(action.keys[0]);
  return (
    <Key
      latched={action.latched}
      title={action.tip ?? (hint ? `${action.title} (${hint})` : action.title)}
      disabled={!!action.disabled}
      onClick={action.run}
      {...key}
    >
      {action.face}
    </Key>
  );
}
