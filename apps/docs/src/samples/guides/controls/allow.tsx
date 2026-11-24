import { createJali, row } from "jali-layout";
import { definePane } from "jali-layout/react";

// What the content can handle: a toolbar can't fill a screen, so the kind says so.
const toolbar = definePane("toolbar", {
  title: "Tools",
  allow: { fullScreen: false },
  Component: () => <div>…</div>,
});
const report = definePane("report", {
  params: { id: Number },
  title: ({ id }) => `Report ${id}`,
  Component: () => <div>…</div>,
});

export const jali = createJali({
  panes: [toolbar, report],
  presets: [
    { id: "review", label: "Review", layout: () => row(toolbar(), report({ id: 1 })) },
    { id: "free", label: "Free", layout: () => row(report({ id: 1 }), report({ id: 2 })) },
  ],
  allow: {
    // For every pane: maximise, but not full screen.
    fullScreen: false,
    // It depends: on the Review layout, people arrange panes as they like but never remove one.
    when: ({ action, presetId }) =>
      !(presetId === "review" && (action === "close" || action === "tuck")),
  },
});
