import { layout, type Layout, type LayoutContext, type ViewState } from "@jali/core";
import { store } from "./store";

// Every operation is pure: a layout in, a new layout out. The store's context has the room, the gap and the kinds.
const ctx: LayoutContext = store.ctx();
const start: Layout = store.get().layout;
const view: ViewState = { focused: "orders", focusHistory: ["orders"] };

const opened = layout.openBeside(start, view, "orders", { kind: "order", params: { id: 1043 } }, ctx);
opened.mode;       // "beside", "replaced" (an earlier link reused) or "tab" (no room)

const closed = layout.close(opened.layout, opened.view, opened.opened, ctx);
const boxes = layout.resolve(closed.layout, closed.view, ctx).panes;   // a rect for every pane

const code = layout.encode(closed.layout);                    // "1.WzEseyJ…": what goes in ?l=
const back = layout.decode(code, store.env.kinds.registry()); // the same layout, or null when it can't be read
export { boxes, back };
