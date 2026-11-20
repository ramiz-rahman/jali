import type { PaneActivity } from "@jali/core";
import { useMessages } from "../state/react";
import { useJaliIcons } from "../icons/context";

/**
 * One activity model. Headers, tabs and the switcher show a dot with a label; the shelf shows a shape as well as a
 * colour (ring, dot, "!", cross), never colour alone. Loading reads as working on the shelf; live is a dot that breathes slowly. Both are public parts
 * (`.jali-activity`, `.jali-activity-shape`), each with its `data-activity`, so an app can draw its own marks.
 */
const ACTIVITY: Record<
  PaneActivity,
  {
    label?: "loading" | "working" | "live" | "needsYou" | "error";
    shelf?: { shape: "ring" | "dot" | "need" | "fail"; state: string };
  }
> = {
  idle: {},
  loading: { label: "loading", shelf: { shape: "ring", state: "working" } },
  working: { label: "working", shelf: { shape: "ring", state: "working" } },
  live: { label: "live", shelf: { shape: "dot", state: "live" } },
  "needs-you": { label: "needsYou", shelf: { shape: "need", state: "needs-you" } },
  error: { label: "error", shelf: { shape: "fail", state: "failed" } },
};

/** The shelf's shape and state for an activity: "working", "live", "needs-you", "failed"; idle has none. */
export const shelfActivity = (a: PaneActivity | undefined) => (a ? ACTIVITY[a].shelf : undefined);

export function Activity({ a, shape = false }: { a: PaneActivity | undefined; shape?: boolean }) {
  const words = useMessages().pane;
  const icon = useJaliIcons();
  if (!a || a === "idle") return null;
  const label = words[ACTIVITY[a].label!];
  if (!shape)
    return (
      <span
        className={`jali-activity jali-activity-${a}`}
        data-activity={a}
        title={label}
        aria-label={label}
        role="img"
      />
    );
  const s = ACTIVITY[a].shelf!;
  if (s.shape === "ring" || s.shape === "dot")
    return (
      <span
        className={`jali-activity-shape jali-ra jali-ra-${s.shape}`}
        data-shape={s.shape}
        data-activity={s.state}
        aria-hidden
      />
    );
  if (s.shape === "need")
    return (
      <span
        className="jali-activity-shape jali-ra jali-ra-need"
        data-shape="need"
        data-activity={s.state}
        aria-hidden
      >
        !
      </span>
    );
  return (
    <span
      className="jali-activity-shape jali-ra jali-ra-fail"
      data-shape="fail"
      data-activity={s.state}
      aria-hidden
    >
      <icon.activityError size={8} aria-hidden />
    </span>
  );
}
