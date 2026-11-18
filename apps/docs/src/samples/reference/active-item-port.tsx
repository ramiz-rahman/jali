import type { ActiveItemPort } from "@jali/core";
import { useActiveItemPort } from "@jali/react";

// Any list that keeps its current item through an ActiveItemPort (Chakni's collections do).
declare function OrderList(props: { activeItem: ActiveItemPort | null }): React.ReactNode;

export function OrdersPane() {
  const port = useActiveItemPort({
    toRef: (itemId) => ({ kind: "order", params: { id: Number(itemId) } }),
    idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
  });
  return <OrderList activeItem={port} />;
}
