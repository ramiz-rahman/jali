import { X } from "lucide-react";
import type { PaneActivity } from "@jali/core/adapter";
import { useMessages } from "../state/react";

/**
 * One activity model. Headers, tabs and the switcher show a dot with a label; the shelf shows a shape as well as a
 * colour (ring, "!", cross), never colour alone. Loading reads as working on the shelf.
 */
const ACTIVITY: Record<
  PaneActivity,
  {
    label?: "loading" | "working" | "needsYou" | "error";
    shelf?: { shape: "ring" | "need" | "fail"; state: string };
  }
> = {
  idle: {},
  loading: { label: "loading", shelf: { shape: "ring", state: "working" } },
  working: { label: "working", shelf: { shape: "ring", state: "working" } },
  "needs-you": { label: "needsYou", shelf: { shape: "need", state: "needs-you" } },
  error: { label: "error", shelf: { shape: "fail", state: "failed" } },
};

/** The shelf's shape and state for an activity: "working", "needs-you", "failed"; idle has none. */
export const shelfActivity = (a: PaneActivity | undefined) => (a ? ACTIVITY[a].shelf : undefined);

export function Activity({ a, shape = false }: { a: PaneActivity | undefined; shape?: boolean }) {
  const words = useMessages().pane;
  if (!a || a === "idle") return null;
  const label = words[ACTIVITY[a].label!];
  if (!shape)
    return (
      <span
        className={`jali-activity jali-activity-${a}`}
        title={label}
        aria-label={label}
        role="img"
      />
    );
  const s = ACTIVITY[a].shelf!;
  if (s.shape === "ring")
    return <span className="jali-ra jali-ra-ring" data-shape="ring" aria-hidden />;
  if (s.shape === "need")
    return (
      <span className="jali-ra jali-ra-need" data-shape="need" aria-hidden>
        !
      </span>
    );
  return (
    <span className="jali-ra jali-ra-fail" data-shape="fail" aria-hidden>
      <X size={8} strokeWidth={3.5} />
    </span>
  );
}
