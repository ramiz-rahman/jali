import type { ActiveItemPort } from "jali";
import { useActiveItemPort } from "jali/react";
import { orderKind } from "./kinds";

// Any list that keeps its current item through an ActiveItemPort (Chakni's collections do).
declare function OrderList(props: { activeItem: ActiveItemPort | null }): React.ReactNode;

export function OrdersPane() {
  const port = useActiveItemPort({
    toRef: (itemId) => orderKind({ id: Number(itemId) }),
    idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
  });
  return <OrderList activeItem={port} />;
}
