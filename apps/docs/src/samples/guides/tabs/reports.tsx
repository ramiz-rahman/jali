import { useSyncExternalStore } from "react";
import { createJali, pane, tabs } from "jali";
import { definePane, useTitle } from "jali/react";
import { ChartBarIcon } from "@phosphor-icons/react";
import { defaultFeatures } from "jali/features";
import { rename } from "jali/rename";

// Your data: saved reports, with the name and pin the person gave each. Jali stores neither.
interface Report {
  id: number;
  name: string;
  pinned: boolean;
}
let reports: Report[] = [
  { id: 1, name: "Weekly revenue", pinned: true },
  { id: 2, name: "Refunds by region", pinned: false },
  { id: 3, name: "Late orders", pinned: false },
];
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
function save(id: number, change: Partial<Report>) {
  reports = reports.map((r) => (r.id === id ? { ...r, ...change } : r));
  listeners.forEach((fn) => fn());
}
const byId = (id: number) => reports.find((r) => r.id === id);

export const reportKind = definePane("report", {
  params: { id: Number },
  title: ({ id }) => `Report ${id}`,
  icon: ChartBarIcon,
  width: { min: 360 },
  Component: function ReportPane({ params }) {
    const report = useSyncExternalStore(subscribe, () => byId(params.id));
    useTitle(report?.name); // the tab shows the saved name, and follows a rename
    return <h3>{report?.name}</h3>;
  },
});

const idOf = (ref: { params: unknown }) => (ref.params as { id: number }).id;

export const jali = createJali({
  panes: [reportKind],
  // One group of tabs; the report pinned in your data starts pinned.
  layout: tabs(
    ...reports.map((r) =>
      pane(reportKind({ id: r.id }), { id: `report-${r.id}`, pinned: r.pinned }),
    ),
  ),
  features: [
    ...defaultFeatures(),
    // Double-click or F2 on a tab opens a field; Enter saves the name in your data.
    rename({
      can: (p) => p.ref.kind === "report",
      run: (p, text) => {
        if (text.length > 60) return false; // keeps the field open, marked invalid
        save(idOf(p.ref), { name: text });
      },
    }),
  ],
  // Your items, after Jali's own in the tab's menu.
  tabMenu: (p) =>
    p.ref.kind === "report"
      ? [{ id: "report.export", title: "Export as CSV", run: () => exportCsv(idOf(p.ref)) }]
      : undefined,
});

// A pin from the menu, setPinned, a link or Back: write it back to your data.
jali.on("pin", ({ pane: id, pinned }) => {
  const node = jali.model().pane(id);
  if (node?.ref.kind === "report") save(idOf(node.ref), { pinned });
});

function exportCsv(id: number) {
  console.log("export", id);
}
