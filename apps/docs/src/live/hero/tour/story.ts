/**
 * The hero's story: one morning at the shop, told with the real workspace. Each step is something the person wants,
 * and the layout answers it: the detail follows, notes open beside, a kept order and an earlier one compare, a drag
 * lines them up, and the layout tree shows that all of it is one small piece of data. Clicks go through the same
 * code as a reader's (shop/open.ts), so the tour shows what a click really does.
 */
import { customers, orders, ordersOf } from "../../shop/data";
import { notesKind } from "../../shop/kinds";
import { openOrder } from "../../shop/open";
import { inside, type Driver } from "./driver";

export interface Step {
  caption: string;
  /** Shown beside the caption: the address the layout writes (on the step about the link). */
  aside?: "address";
  /** Leave the step out (said nothing, shown done): when it can't show what it says, as on a phone. */
  skip?(t: Driver): boolean;
  run(t: Driver): Promise<void>;
}

/** The order list's pane in the hero's layout (shop/layouts.ts, "desk"). */
const LIST = "orders";

function customerCalled(short: string) {
  const c = customers.find((x) => x.short === short);
  if (!c) throw new Error(`The tour's story needs a customer called ${short} (shop/data.ts)`);
  return c;
}

/** The story is Huda's: his big wholesale order today, and the earlier one, refunded when a basket arrived split. */
const huda = customerCalled("Huda");
const [today, earlier] = ordersOf(huda.id);
if (!today || !earlier)
  throw new Error("The tour's story needs two orders of Huda's (shop/data.ts)");
/** Browsed on the way in: the two orders under his in the list, then back up to his. */
const at = orders.indexOf(today);
const browsed = [...orders.slice(at + 1, at + 3), today];

/** A pane, found by kind: the tour can't know the ids Jali gives the panes it opens. */
const byKind = (
  t: Driver,
  kind: string,
  also?: (p: { kept?: boolean; follows?: boolean }) => boolean,
) => t.model().panes.find((p) => p.ref.kind === kind && (!also || also(p)))?.id;
const row = (t: Driver, id: number) => t.ws.querySelector(`[data-pane="${LIST}"] [id$="-o-${id}"]`);

/** A pane that is folded or behind a tab is shown first (a phone shows one pane at a time). */
async function reveal(t: Driver, pane: string | undefined) {
  if (!pane || t.model().visible.includes(pane)) return;
  t.actions.focus(pane);
  await t.wait(900);
}

/** Point at an element, then press it: the cursor's part of a click. */
async function press(t: Driver, el: Element | null, before: number, after = 0) {
  t.point(el);
  await t.wait(t.cut ? 0 : before);
  t.point(el, true);
  await t.wait(t.cut ? 0 : after);
}

export const STORY: Step[] = [
  {
    caption: "Pick an order. Its detail and its customer follow.",
    async run(t) {
      // The tree waits for the end: the workspace has the whole figure until then.
      t.panel("closed");
      await t.wait(600);
      for (const o of browsed) {
        await press(t, row(t, o.id), 600);
        openOrder(t.actions, t.model(), LIST, o.id);
        await t.wait(1150);
      }
      t.point(null);
      // One pane at a time: show the detail, which followed.
      await reveal(t, byKind(t, "order"));
      await t.wait(500);
    },
  },
  {
    caption: `Big order. Check ${huda.short}'s notes beside him.`,
    async run(t) {
      const customer = byKind(t, "customer");
      if (!customer) return;
      await reveal(t, customer);
      await press(t, t.pane(customer, ".live-k-row"), 700, 250);
      t.actions.openBeside(customer, notesKind({ customer: huda.id }));
      t.point(null);
      await t.wait(2600);
    },
  },
  {
    caption: "Keep this order, and open his last one beside it.",
    async run(t) {
      const order = byKind(t, "order", (p) => !!p.follows);
      if (!order) return;
      await press(t, t.pane(order, ".jali-follow-toggle"), 700, 250);
      t.actions.setKept(order, true);
      await t.wait(t.cut ? 0 : 900);
      await press(t, row(t, earlier.id), 650);
      openOrder(t.actions, t.model(), LIST, earlier.id);
      t.point(null);
      await t.wait(2400);
    },
  },
  {
    caption: "Drag it next to the first, so the two line up.",
    // A drag needs panes side by side: one at a time (a phone) has nothing to drop on.
    skip: (t) => t.model().onePane,
    async run(t) {
      const kept = byKind(t, "order", (p) => !!p.kept);
      const moved = t.model().panes.find((p) => p.ref.params.id === earlier.id)?.id;
      if (!kept || !moved) return;
      await t.drag(moved, t.pane(moved, ".jali-pane-title"), inside(t.pane(kept), 0.93, 0.5));
      await t.wait(2200);
    },
  },
  {
    caption: "All of it is one layout tree: plain data that lives in the link.",
    aside: "address",
    async run(t) {
      // The JSON, not the map: the map redraws what is on screen, the JSON shows it is data the link can carry.
      t.panel("json");
      await t.wait(t.cut ? 1600 : 2000);
      // The kept order's lines, and the pane they describe, light together; the cursor rests on what keeps it.
      const kept = byKind(t, "order", (p) => !!p.kept);
      if (kept) {
        const first = t.light(kept);
        const lines = [
          ...(first?.parentElement?.querySelectorAll(`[data-node="${CSS.escape(kept)}"]`) ?? []),
        ];
        const line = lines.find((l) => l.textContent?.includes('"kept"')) ?? first;
        await t.wait(t.cut ? 0 : 500);
        t.point(line?.querySelector(".j-key") ?? line);
        await t.wait(2600);
        t.point(null);
        t.light(null);
      }
      await t.wait(1200);
    },
  },
  {
    caption: "Your turn. Drag a pane, or click anything.",
    async run(t) {
      await t.wait(2800);
    },
  },
];
