import { useMemo } from "react";
import { besidePreview, roleOf } from "@jali/core/adapter";
import { useModel, useStore } from "../state/react";

/** ⌥ over a page tab: a dashed outline where ⌥-click would open that view, and a fainter one for each view it moves.
 *  The preview runs the very placement the click commits (besidePreview), so the two cannot differ. */
export function Ghost({ role }: { role: string }) {
  const store = useStore();
  const m = useModel();
  const preview = useMemo(() => besidePreview(store.snapshot(), role), [store, role, m]);
  if (!preview) return null;
  const p = store.env.profile!;
  const name = (id: string) => roleOf(p, id)?.label ?? m.title(id);
  const box = (r: { x: number; y: number; width: number; height: number }) => ({
    left: r.x,
    top: r.y,
    width: r.width,
    height: r.height,
  });

  return (
    <>
      {preview.moved.map((v) => (
        <div
          key={v.id}
          className="jali-ghost jali-ghost-moved"
          data-ghost={v.id}
          style={box(v.rect)}
          aria-hidden
        />
      ))}
      <div className="jali-ghost" data-ghost={role} style={box(preview.incoming)} aria-hidden>
        <span>{store.messages.page.ghost(name(role), preview.leaving.map(name))}</span>
      </div>
    </>
  );
}
