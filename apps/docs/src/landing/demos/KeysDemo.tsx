/**
 * The keys: a customer beside a stack of tabs, and under them the sheet of keys this workspace's keymap holds, as an
 * app might show its shortcuts. A row runs its command when clicked; a key pressed in the panes runs it as well,
 * and either way its row lights, so a key visibly lands. After ⌘K, the rows it starts wait for their second key.
 *
 * Its last section is a setting, because settings are commands too: what a drop on a pane's middle does. Jali gives
 * that command no key, so the demo binds it one, as an app may bind any command.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { KeyboardIcon } from "@phosphor-icons/react";
import type { Jali } from "jali";
import { PALETTE_ID, formatKeys, matchChord, runCommand } from "jali/adapter";
import { NamedWorkspace, useHydrated } from "../../live/embed";
import { useShopDemo } from "./useShopDemo";

const KEYS: { id: string; text: string }[] = [
  { id: PALETTE_ID, text: "Command palette" },
  { id: "pane.focus.next", text: "Next pane" },
  { id: "pane.zoom", text: "Maximise" },
  { id: "pane.tuck", text: "Tuck away" },
  { id: "pane.close", text: "Close" },
  { id: "pane.undo_close", text: "Bring back" },
];

const CENTRE_DROP = "settings.centre_drop.toggle";
const SHOWN = new Set([...KEYS.map((k) => k.id), CENTRE_DROP]);

type CentreDrop = "swap" | "tab";

const DROPS: { value: CentreDrop; name: string; does: string }[] = [
  { value: "swap", name: "Swap", does: "Drag a pane onto another's middle: the two trade places." },
  {
    value: "tab",
    name: "Add as tab",
    does: "Drag a pane onto another's middle: it joins it as a tab.",
  },
];

/**
 * What a drop on a pane's middle leaves: two panes that traded places (the arrows between them lit), or one pane with
 * the dropped one as a new tab (that tab lit).
 */
function DropGlyph({ value }: { value: CentreDrop }) {
  return (
    <svg className="landing-drop-glyph" viewBox="0 0 34 18" aria-hidden>
      {value === "swap" ? (
        <>
          <rect x="0.5" y="0.5" width="11" height="17" rx="2" />
          <rect x="22.5" y="0.5" width="11" height="17" rx="2" />
          <path
            data-lit=""
            d="M14.5 6.5h5m-1.75-1.75 1.75 1.75-1.75 1.75M19.5 11.5h-5m1.75-1.75-1.75 1.75 1.75 1.75"
          />
        </>
      ) : (
        <>
          <rect x="0.5" y="0.5" width="33" height="17" rx="2" />
          <path d="M0.5 6.5h33M11.5 0.5v6" />
          <rect data-lit="" x="12" y="1.5" width="10" height="4.5" rx="1" />
        </>
      )}
    </svg>
  );
}

/** A key sequence as keycaps, one per step ("⌘K", "⌘["); `pressed`: how many of its steps are already down. */
function Caps({ label, pressed = 0 }: { label: string; pressed?: number }) {
  return (
    <span className="landing-caps">
      {label.split(" ").map((step, i) => (
        <kbd
          key={i}
          data-pressed={i < pressed || undefined}
          data-next={(pressed > 0 && i === pressed) || undefined}
        >
          {step}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Which of the sheet's commands a key pressed in the demo runs, as Jali's keyboard layer decides it (`matchChord`
 * against the keymap): a one-step binding, or the second step after a prefix. It only listens: Jali runs the command.
 * `prefix` is the first step while it waits for a second ("⌘K").
 */
function useKeysPressed(keymap: Jali["keymap"], onRun: (id: string) => void) {
  const [prefix, setPrefix] = useState<string | null>(null);
  type Chord = NonNullable<ReturnType<Jali["keymap"]["isPrefix"]>>;
  const pending = useRef<{ chord: Chord; timer: number } | null>(null);
  const clear = () => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
    setPrefix(null);
  };
  useEffect(() => clear, []);
  const onKeyDownCapture = (e: KeyboardEvent) => {
    if (e.repeat || ["Meta", "Control", "Shift", "Alt"].includes(e.key)) return;
    const match = (c: Chord) => matchChord(c, e.nativeEvent, keymap.platform);
    if (pending.current) {
      const id = keymap.find(match, pending.current.chord);
      clear();
      if (id && SHOWN.has(id)) onRun(id);
      return;
    }
    const id = keymap.find(match);
    if (id && SHOWN.has(id)) onRun(id);
    const chord = keymap.isPrefix(match);
    if (chord) {
      pending.current = { chord, timer: window.setTimeout(clear, 2500) };
      setPrefix(keymap.format([chord]));
    }
  };
  return { prefix, onKeyDownCapture };
}

export function KeysDemo() {
  const { jali } = useShopDemo("stack", { keymap: { [CENTRE_DROP]: "Mod+K Mod+D" } });
  const [lit, setLit] = useState<{ id: string; n: number } | null>(null);
  const light = (id: string) => setLit((l) => ({ id, n: (l?.n ?? 0) + 1 }));
  const run = (id: string) => {
    if (id === PALETTE_ID) jali.dialogs.openPalette();
    else runCommand(jali, id);
    light(id);
  };
  const keys = useKeysPressed(jali.keymap, light);
  const drop = useSyncExternalStore(
    jali.subscribe,
    () => jali.get().settings.centreDrop,
    () => jali.get().settings.centreDrop,
  );
  const now = DROPS.find((d) => d.value === drop) ?? DROPS[0]!;
  const titleId = useId();
  // The keymap reads the platform from `navigator`, which the build machine has too. Until the page hydrates, the
  // keys are written for Windows and Linux on every machine, so the prerender and hydration match; then for the
  // reader's own platform.
  const hydrated = useHydrated();
  const label = (id: string) => {
    if (hydrated) return jali.keymap.label(id);
    const seq = jali.keymap.sequences(id)[0];
    return seq ? formatKeys(seq, "other") : "";
  };
  /** How many of a row's steps are down: its first, while ⌘K waits for a second key it takes. */
  const pressed = (id: string) => {
    const steps = label(id).split(" ");
    return keys.prefix && steps.length > 1 && steps[0] === keys.prefix ? 1 : 0;
  };
  // The two choices are a radio group: the arrows move between them, as between any radios.
  const onSwitchKey = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    run(CENTRE_DROP);
    (e.currentTarget.querySelector('[aria-checked="false"]') as HTMLElement | null)?.focus();
  };
  // The row that just ran lights; two names for the same light, alternating, so it lights again however often it runs.
  const ran = (id: string) => (lit?.id === id ? (lit.n % 2 ? "a" : "b") : undefined);
  return (
    <div className="landing-keys-demo" onKeyDownCapture={keys.onKeyDownCapture}>
      <NamedWorkspace
        jali={jali}
        height={340}
        label="A customer beside a stack of tabs, to try the keys in"
      />
      <section
        className="landing-sheet"
        aria-labelledby={titleId}
        data-armed={keys.prefix ? "" : undefined}
      >
        <header className="landing-sheet-head">
          <KeyboardIcon aria-hidden size={16} />
          <span id={titleId}>Keys</span>
          <small aria-live="polite">
            {keys.prefix ? `${keys.prefix}, then…` : "Click one, or press it in the panes above"}
          </small>
        </header>
        <ul className="landing-sheet-list">
          {KEYS.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                className="landing-sheet-row"
                data-ran={ran(k.id)}
                data-waiting={pressed(k.id) > 0 || undefined}
                onClick={() => run(k.id)}
              >
                <span>{k.text}</span>
                <Caps label={label(k.id)} pressed={pressed(k.id)} />
              </button>
            </li>
          ))}
        </ul>
        <div
          className="landing-sheet-setting"
          role="group"
          aria-label="A setting: what a drop on a pane's middle does"
          data-ran={ran(CENTRE_DROP)}
          data-waiting={pressed(CENTRE_DROP) > 0 || undefined}
        >
          <p className="landing-sheet-section">Settings are commands too</p>
          <div className="landing-sheet-setting-head">
            <span>A drop on a pane's middle</span>
            <Caps label={label(CENTRE_DROP)} pressed={pressed(CENTRE_DROP)} />
          </div>
          <span
            className="landing-drop-switch"
            role="radiogroup"
            aria-label="A drop on a pane's middle"
            onKeyDown={onSwitchKey}
          >
            {DROPS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={d.value === drop}
                tabIndex={d.value === drop ? 0 : -1}
                onClick={() => d.value !== drop && run(CENTRE_DROP)}
              >
                <DropGlyph value={d.value} />
                {d.name}
              </button>
            ))}
          </span>
          <p className="landing-sheet-hint" aria-live="polite">
            {now.does}
          </p>
        </div>
      </section>
    </div>
  );
}
