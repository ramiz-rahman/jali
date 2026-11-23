/** Size scenario: only the pure layout tree (builders and the `layout` namespace), no workspace and no React. */
import { layout, pane, row, column, tabs, type KindRegistry } from "jali";
import { toLayout } from "jali/adapter";

const kind = (k: string) => ({ kind: k, title: () => k, minWidth: 240, minHeight: 160 });
const kinds: KindRegistry = { list: kind("list"), detail: kind("detail") };
const ctx = { fit: { width: 1200, height: 800, gap: 8, kinds }, paneCap: 6 };
const ref = (k: string, id: number) => ({ kind: k, params: { id } });

const start = toLayout(
  row(pane(ref("list", 1), { id: "list" }), column(ref("detail", 1), tabs(ref("detail", 2)))),
);
const view = { focused: "list", focusHistory: ["list"] };
const opened = layout.openBeside(start, view, "list", ref("detail", 3), ctx);
const closed = layout.close(opened.layout, opened.view, opened.opened, ctx);
const boxes = layout.resolve(closed.layout, closed.view, ctx).panes;
const code = layout.encode(closed.layout);

document.body.textContent = JSON.stringify({ boxes, code, back: layout.decode(code, kinds) });
