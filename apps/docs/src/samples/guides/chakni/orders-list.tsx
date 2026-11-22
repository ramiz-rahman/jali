import type { KeyboardEvent } from "react";
import type { ActiveItemMapping, ActiveItemPort } from "jali";
import { definePane, useActiveItemPort } from "jali/react";

const ORDER_IDS = ["1", "2", "3", "4"];

// Item ids are the collection's; refs are the workspace's. The mapping turns one into the other.
// Keep it outside the component: the port keeps the mapping it was first given.
const orders: ActiveItemMapping = {
  toRef: (id) => ({ kind: "order", params: { id: Number(id) } }),
  idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
};

/**
 * Any list that keeps its cursor through the port. A Chakni collection would take the port in place of this one,
 * once Chakni accepts it (not built yet).
 */
function CursorList({ ids, port }: { ids: string[]; port: ActiveItemPort | null }) {
  const at = port?.itemId ? ids.indexOf(port.itemId) : -1;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!port || e.metaKey || e.ctrlKey || e.altKey) return;
    const step = e.key === "j" ? 1 : e.key === "k" ? -1 : 0;
    if (step) port.write(ids[Math.max(0, Math.min(ids.length - 1, at + step))] ?? null, "step");
    else if (e.key === " " && at >= 0) port.write(ids[at]!, "open");
    else return;
    e.preventDefault();
  };
  return (
    <ul role="listbox" aria-label="Orders" tabIndex={0} onKeyDown={onKeyDown}>
      {ids.map((id, i) => (
        <li key={id} role="option" aria-selected={i === at} onClick={() => port?.write(id, "step")}>
          Order {id}
        </li>
      ))}
    </ul>
  );
}

export const orderQueue = definePane("order-queue", {
  title: "Order queue",
  width: { min: 320 },
  height: { min: 240 },
  Component: function OrderQueue() {
    // The port for the pane this renders in; null in the peek sheet, which has no list of its own.
    const port = useActiveItemPort(orders);
    return <CursorList ids={ORDER_IDS} port={port} />;
  },
});
