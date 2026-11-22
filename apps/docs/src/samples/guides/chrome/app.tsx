import { useState } from "react";
import type { Toast } from "jali";
import {
  IconButton,
  JaliRoot,
  JaliView,
  Shelf,
  useJali,
  useJaliEvent,
  useJaliModel,
  useJaliShortcut,
  useJaliState,
} from "jali/react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { jali } from "./jali";

/** The top bar: the app's name, the presets, and a button that shows its key. */
function TopBar() {
  const { env, actions } = useJali();
  const current = useJaliState((s) => s.presetId);
  const resetKeys = useJaliShortcut("layout.reset"); // its keys in this keymap, or "" until you bind one
  return (
    <header className="top-bar" data-jali-chrome>
      <strong>Orders</strong>
      <nav aria-label="Layouts">
        {env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onClick={() => actions.preset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <IconButton
        label="Reset layout"
        title={resetKeys ? `Reset layout (${resetKeys})` : "Reset layout"}
        onClick={() => actions.resetLayout()}
      >
        <ArrowCounterClockwiseIcon size={16} aria-hidden />
      </IconButton>
    </header>
  );
}

/** The status line: what is focused, and the shelf of tucked panes. */
function StatusLine() {
  const focused = useJaliState((s) => s.view.focused);
  const model = useJaliModel();
  return (
    <footer className="status-line" data-jali-chrome>
      <span>{focused ? model.title(focused) : "No pane focused"}</span>
      <Shelf />
    </footer>
  );
}

/** Jali sends toasts as events and draws none: show them your way. With Sonner, call toast() here instead. */
function Toasts() {
  const { actions } = useJali();
  const [toasts, setToasts] = useState<(Toast & { key: number })[]>([]);
  useJaliEvent("toast", (t) => {
    const key = Date.now();
    setToasts((all) => [...all, { ...t, key }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.key !== key)), 5000);
  });
  return (
    <ol className="toasts" aria-label="Notifications">
      {toasts.map((t) => (
        <li key={t.key} role={t.error ? "alert" : "status"}>
          {t.title}
          {t.undo ? (
            <button type="button" onClick={() => actions.undo()}>
              Undo
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function App() {
  return (
    <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
      <TopBar />
      <JaliView />
      <StatusLine />
    </JaliRoot>
  );
}
