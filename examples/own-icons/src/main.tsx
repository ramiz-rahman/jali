/**
 * Jali drawing with the host's own icons: `<JaliRoot icons>` takes any of Jali's icon names; this app gives all of
 * them (typed `JaliIcons`, so one missing fails to compile). These are a few strokes on a 16px grid, standing in for
 * an app's icon set. The bundle test (packages/react/src/bundle.test.ts) builds this app.
 *
 * It takes each feature from its own entry, as an app that picks its features does, so every icon a feature draws
 * (⌘K, Settings, "Add to tabs of…", the rename field, held controls) is one of the app's.
 */
import { use } from "react";
import { createRoot } from "react-dom/client";
import { createJali, row, tabs } from "jali-layout";
import { JaliRoot, definePane, type JaliIconProps, type JaliIcons } from "jali-layout/react";
import "./app.css";
import "jali-layout/styles.css";
import { urlSync } from "jali-layout/url";
import { palette } from "jali-layout/palette";
import { settings } from "jali-layout/settings";
import { chooser } from "jali-layout/chooser";
import { pressed } from "jali-layout/pressed";
import { rename } from "jali-layout/rename";

/** One stroked icon from a path on a 16px grid. */
const stroke = (d: string) =>
  function Icon({ size = 16, className, "aria-hidden": hidden }: JaliIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={hidden}
      >
        <path d={d} />
      </svg>
    );
  };

const icons: JaliIcons = {
  close: stroke("M4 4l8 8M12 4l-8 8"),
  maximise: stroke("M9 3h4v4M7 13H3V9M13 3L9 7M3 13l4-4"),
  restore: stroke("M13 7H9V3M3 9h4v4M9 7l4-4M7 9l-4 4"),
  fullScreen: stroke("M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"),
  exitFullScreen: stroke("M6 3v3H3M13 6h-3V3M10 13v-3h3M3 10h3v3"),
  tuck: stroke("M3.5 8h9"),
  putBack: stroke("M6 4L3 7l3 3M3 7h6.5a3 3 0 010 6H8"),
  newTab: stroke("M8 3.5v9M3.5 8h9"),
  more: stroke("M4.5 6.5L8 10l3.5-3.5"),
  menu: stroke("M4 8h.01M8 8h.01M12 8h.01"),
  popOut: stroke("M2.5 3.5h11v9h-11zM8.5 8.5h3.5v2.5H8.5z"),
  current: stroke("M3.5 8.5l3 3 6-7"),
  fold: stroke("M8 2.5v11M2.5 8H6M4.5 6L6 8 4.5 10M13.5 8H10M11.5 6L10 8l1.5 2"),
  grip: stroke("M5 6h.01M8 6h.01M11 6h.01M5 10h.01M8 10h.01M11 10h.01"),
  follow: stroke(
    "M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1",
  ),
  pin: stroke("M10 2.5l3.5 3.5-2.5 1-3 3 .5 2.5L4 8l2.5.5 3-3zM6 10l-3.5 3.5"),
  keep: stroke("M8 2.5v11M5 13.5h6M3.5 9.5c0 2.5 2 4 4.5 4s4.5-1.5 4.5-4M6 4.5h4"),
  activityError: stroke("M4 4l8 8M12 4l-8 8"),
  defaultKind: stroke("M3.5 3.5h9v9h-9z"),
  openBeside: stroke("M2.5 3.5h11v9h-11zM10 3.5v9"),
  addToTabs: stroke("M8 2.5l5.5 3L8 8.5l-5.5-3zM2.5 8L8 11l5.5-3M2.5 10.5L8 13.5l5.5-3"),
  singleView: stroke("M3.5 3.5h9v9h-9z"),
  splitView: stroke("M2.5 3.5h11v9h-11zM8 3.5v9"),
  back: stroke("M6 4L3 7l3 3M3 7h6.5a3 3 0 010 6H8"),
  reset: stroke("M3 4v3h3M3.5 7A5 5 0 113 9"),
  dropLeft: stroke("M13 8H3M7 4L3 8l4 4"),
  dropRight: stroke("M3 8h10M9 4l4 4-4 4"),
  dropTop: stroke("M8 13V3M4 7l4-4 4 4"),
  dropBottom: stroke("M8 3v10M4 9l4 4 4-4"),
  dropSwap: stroke("M3 6h10M10 3l3 3-3 3M13 10H3M6 7l-3 3 3 3"),
  dropTab: stroke("M2.5 2.5h11v11h-11zM8 5v6M5 8h6"),
};

/** The names the person gave notes (double-click a tab, or F2), standing in for an app's own store. */
const names = new Map<number, string>();

/** A note's text, fetched once: a promise per note, standing in for an app's data, so a note suspends while it loads. */
const texts = new Map<number, Promise<string>>();
const textOf = (id: number) => {
  let text = texts.get(id);
  if (!text) {
    text = new Promise((done) => setTimeout(() => done(`What note ${id} says.`), 300));
    texts.set(id, text);
  }
  return text;
};

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => names.get(id) ?? `Note ${id}`,
  icon: stroke("M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12M6 8h4M6 10.5h4"),
  // A note is small: its header keeps Maximise and Close, and the rest of what it can do is in its menu (⋯) and ⌘K.
  buttons: ["maximise", "close"],
  Component: ({ params, openBeside }) => (
    <article className="note">
      <h3>Note {params.id}</h3>
      <p>{use(textOf(params.id))}</p>
      <button onClick={() => openBeside(note({ id: params.id + 1 }))}>
        Open the next note beside
      </button>
    </article>
  ),
  // While its text loads, in the app's own words.
  Loading: ({ params }) => <p className="note">Opening note {params.id}…</p>,
});

// The workspace is the whole page, so its panes are the page's <main>. Notes 2 and 3 share a tab strip.
const jali = createJali({
  panes: [note],
  layout: row(note({ id: 1 }), tabs(note({ id: 2 }), note({ id: 3 }))),
  landmark: "main",
  features: [
    urlSync(),
    palette(),
    settings(),
    chooser(),
    pressed(),
    rename({
      run: ({ ref }, text) => {
        const id = Number(ref.params.id);
        if (text.trim()) names.set(id, text.trim());
        else names.delete(id);
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <JaliRoot jali={jali} icons={icons} className="app" />,
);
