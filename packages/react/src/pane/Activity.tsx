import { XIcon } from "@phosphor-icons/react";
import type { PaneActivity } from "@jali/core/adapter";

/**
 * One activity model. Headers, tabs and the switcher show a dot with a label; the shelf shows a shape as well as a
 * colour (ring, "!", cross), never colour alone. Loading reads as working on the shelf.
 */
const ACTIVITY: Record<
  PaneActivity,
  { label: string; shelf?: { shape: "ring" | "need" | "fail"; word: string; state: string } }
> = {
  idle: { label: "" },
  loading: { label: "Loading", shelf: { shape: "ring", word: "working", state: "working" } },
  working: { label: "Working", shelf: { shape: "ring", word: "working", state: "working" } },
  "needs-you": {
    label: "Needs you",
    shelf: { shape: "need", word: "needs you", state: "needs-you" },
  },
  error: { label: "Error", shelf: { shape: "fail", word: "failed", state: "failed" } },
};

/** The shelf's words and state for an activity: "working", "needs you", "failed"; idle has none. */
export const shelfActivity = (a: PaneActivity | undefined) => (a ? ACTIVITY[a].shelf : undefined);

export function Activity({ a, shape = false }: { a: PaneActivity | undefined; shape?: boolean }) {
  if (!a || a === "idle") return null;
  if (!shape)
    return (
      <span
        className={`jali-activity jali-activity-${a}`}
        title={ACTIVITY[a].label}
        aria-label={ACTIVITY[a].label}
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
      <XIcon size={8} weight="bold" />
    </span>
  );
}
