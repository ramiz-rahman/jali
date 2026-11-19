# Curated pages

A designed page about one item, with tabs of views, that the person can read one view at a time or lay out side by side.

A free workspace starts empty, or from a preset, and the person builds it. That suits work where the layout is the work: exploring data, comparing records.

Much work is about one item at a time: a customer, a case, a loan application. For that, a page someone designed is better. It shows the right views in the right order, and the person can still lay them out their own way. Jali calls this a curated page. Both run on the same workspace. The difference is where the person controls the layout: from the panes in a free workspace, from a tab strip on a curated page.

> **Note: See one working.** The [Loan review example](../examples.md#loan-review) is a curated page: a queue of applications at the left, then Overview, Application, Borrower, Loan history, Group and Field officer as tabs.

## A profile describes the page

`definePage` makes the page's definition (its [profile](../get-started/key-concepts.md#curated-page)). You pass it to the workspace as `page`, beside your kinds.

`customer-page.tsx`

```tsx
import { LayoutIcon, LifebuoyIcon, ShoppingCartIcon, UserIcon } from "@phosphor-icons/react";
import { pane, row } from "@jali/core";
import { definePage, type PageView } from "@jali/react";
import { customer, customerOrders, customerOverview, customerTickets } from "./customer";
import { customers } from "./data";

// The page's views, in tab order. A view says whether its pane gives way first when room runs out.
const roles: PageView[] = [
  { id: "overview", label: "Overview", priority: "supporting", icon: LayoutIcon },
  { id: "profile", label: "Customer", priority: "primary", icon: UserIcon },
  { id: "orders", label: "Orders", priority: "supporting", icon: ShoppingCartIcon },
  { id: "tickets", label: "Tickets", priority: "supporting", icon: LifebuoyIcon },
];

// What each view shows for one customer. Another customer swaps these in place.
const bind = (id: number) => ({
  overview: customerOverview({ customer: id }),
  profile: customer({ id }),
  orders: customerOrders({ customer: id }),
  tickets: customerTickets({ customer: id }),
});

// Split view's designed layout: every view is in it, and Overview starts hidden.
const build = (id: number) => {
  const refs = bind(id);
  return row(
    { id: "page" },
    ...roles.map((r) =>
      pane(refs[r.id as keyof typeof refs], {
        id: r.id,
        role: r.id,
        priority: r.priority,
        hidden: r.id === "overview",
      }),
    ),
  );
};

// The list beside the page, and the header above its tabs.
function Rail({ item, activate }: { item: number; activate: (item: number) => void }) {
  return (
    <nav aria-label="Customers">
      {customers.map((c) => (
        <button key={c.id} aria-current={c.id === item} onClick={() => activate(c.id)}>
          {c.name}
        </button>
      ))}
    </nav>
  );
}
function Header({ item }: { item: number }) {
  return (
    <header>
      <h1>{customers.find((c) => c.id === item)?.name}</h1>
    </header>
  );
}

export const customerPage = definePage({
  id: "customer",
  name: "Customer",
  itemNoun: "customer",
  viewers: { full: "account manager", limited: "support agent" },
  roles,
  home: "overview",
  build,
  bind,
  firstItem: 7,
  Rail,
  Header,
});
```

- **`roles`** are the page's views, in tab order. Each is a [role](../get-started/key-concepts.md#role): an id, a label, an icon, and a priority. A role's pane in the layout has the role's id as its node id.
- **`bind(item)`** says what each view shows for one item. Choosing another item from the list swaps every view's object in place.
- **`build(item)`** is the designed layout for Split view. Every role is in it; the ones that should not show at first are listed in `overlay.hidden`.
- **`home`** is the view Single mode opens on.
- **`Rail`** is the list of items at the left, and **`Header`** sits above the tabs. Both are your components. `Rail` gets `activate(item)` to switch items.
- **`viewers`** names the two kinds of person who use the page (below).

Items are numbers: `item` is the id a link carries.

## Opening the page

While a page is open, `<JaliView>` renders it: your rail, your header, the tabs, and the panes. `<PageBar>` holds the mode switch, the investigation and Reset; put it in your own top bar.

`workspace.ts`

```tsx
import { createJali } from "@jali/core";
import { customer, customerOrders, customerOverview, customerTickets, order } from "./customer";
import { customerPage } from "./customer-page";
import { listOnly } from "./layouts";
import { ticketList } from "./ticket-list";

export const jali = createJali({
  panes: [customerOverview, customer, customerOrders, customerTickets, order, ticketList],
  page: customerPage,
  layout: listOnly,
});

// A link with ?page=customer opens the page. Open it from code, a menu or ⌘K ("Open Customer") otherwise.
if (!jali.get().page) jali.actions.openPage({ item: 7 });
```

A link opens a page with `?page=customer&item=7&tab=orders`. Without one, open it with `jali.actions.openPage()`, or from ⌘K ("Open Customer"). `jali.actions.leavePage()` goes back to the free workspace. A page-only app (a page and no presets or layout) needs neither: the workspace starts on its page.

## Single: one view at a time

Single is the default. It shows one view, chosen from the tabs, like any web app. The pane has no header of its own, because the selected tab already names it.

Clicking a tab swaps the view in place; nothing moves. A link inside a view opens as a [peek](../get-started/key-concepts.md#peek), since there is no second pane for it to open into, and the announcement says how to open links beside.

## Split view: views side by side

In Split view, the tabs become a palette of views that the person lays out with full freedom.

- **Drag a tab** into the panes. An edge places the view beside that pane; the centre adds it to that pane's tabs.
- **⌥-click a tab** (Alt-click) to open it beside the view in use. Holding ⌥ over a tab draws where it would go, and that preview is exactly what the click does.
- **Click a tab** to bring the view on screen. If it is on screen, it is focused. If it is behind another tab, that tab is chosen. If it is not on screen, it takes the place and the size of the view in use, and that view goes back to the tabs.
- **Close a view** and it goes back to the tabs. Each view exists once.

**Why a click never reshapes:** a click is the lightest thing a person does. If it added a pane and pushed the others aside, every click would rearrange the screen. Adding a view is always a deliberate gesture: a drag or ⌥-click.

The first switch to Split view starts from the profile's design. Switching back to Single keeps the split layout exactly, and switching again restores it. Dragging a tab out of Single switches to Split view for you.

## Views never fold into each other's tabs

When there is no room for a view the person places, the least recently used views go back to the page's tabs, supporting views before the primary one. The announcement names them. A view never folds into a tab group inside a pane, because that would repeat the page's tabs inside a pane.

## Investigating

In Split view, following a link opens an **opened** pane after the page's views, marked with a tint and an "Opened" tag. The opened panes together are the investigation. They stay in one region at the right, so the designed layout stays readable.

Nothing the person placed gives way to an opened pane. If there is no room beside, the opened pane becomes the shown tab of the pane the link was in, at that pane's size. If even that needs more room, views go back to the page's tabs; none folds.

**Back to** the page (in `<PageBar>`, or ⌘K) closes every opened pane and returns the layout to exactly how it was before the first link, unless the person rearranged the views meanwhile. Undo (⌘K ⌘Z) reopens them.

Choosing another item swaps every view in place and closes the investigation, because the opened panes belonged to the item before.

## What is whose

- The **mode** and the **split layout** belong to the person. They are kept on their device, through the [storage port](../get-started/key-concepts.md#ports), without the opened panes. Reset puts the layout back to the design.
- A **link** carries content only: the item, the view in use and the opened panes. The same link opens in each reader's own layout. A link with opened panes opens in Split view, since Single cannot show them.

## Viewers

A page can be used by two kinds of person, named by `viewers`. The `full` viewer may switch to Split view and open links beside. The `limited` viewer works in Single only and opens links as a peek. The sample names them "account manager" and "support agent".

`jali.actions.setCanInvestigate(false)` sets the limited one. In a product, your app sets it from the person's role.
