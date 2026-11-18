import { usePaneState } from "@jali/react";

type Sort = { column: "id" | "total"; dir: "asc" | "desc" };

// Kept by the workspace: through folds, tabs and reloads. Dropped when the pane closes or shows another object.
export function OrdersTable() {
  const [sort, setSort] = usePaneState<Sort>("sort", { column: "id", dir: "asc" });
  const flip = () => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));
  return (
    <button onClick={flip}>
      Sorted by {sort.column}, {sort.dir}
    </button>
  );
}
