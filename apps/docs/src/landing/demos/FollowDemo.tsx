/**
 * Following: the orders, the order following them, and its customer following the order, under a line that says what
 * the order pane is doing (Following, or Kept), what to try, and the one button that changes it.
 */
import { useMemo, useSyncExternalStore } from "react";
import { AnchorSimpleIcon, LinkSimpleHorizontalIcon } from "@phosphor-icons/react";
import type { Jali } from "jali-layout";
import { NamedWorkspace } from "../../live/embed";
import { useShopDemo } from "./useShopDemo";

interface Pane {
  id: string;
  title: string;
}

/** What the order details of the list are doing: one follows it, one is kept, both, or there are none yet. */
type FollowState =
  | { mode: "none" }
  | { mode: "following"; follower: Pane }
  | { mode: "kept"; kept: Pane }
  | { mode: "both"; follower: Pane; kept: Pane };

function followState(jali: Jali): FollowState {
  const panes = jali.model().panes.filter((p) => p.linkedTo === "orders");
  const pick = (p: { id: string; title: string } | undefined) => p && { id: p.id, title: p.title };
  const follower = pick(panes.find((p) => p.follows));
  const kept = pick(panes.find((p) => p.kept));
  if (follower && kept) return { mode: "both", follower, kept };
  if (kept) return { mode: "kept", kept };
  if (follower) return { mode: "following", follower };
  return { mode: "none" };
}

/** The bar for a state: its badge, what to try, and the one action that changes it. */
function describe(s: FollowState, jali: Jali) {
  switch (s.mode) {
    case "following":
      return {
        badge: "Following",
        kept: false,
        text: `${s.follower.title} shows the order selected in Orders. Pick another order: it changes in place, and its customer with it.`,
        action: {
          label: `Keep ${s.follower.title}`,
          run: () => jali.actions.setKept(s.follower.id, true),
        },
      };
    case "kept":
      return {
        badge: "Kept",
        kept: true,
        text: `${s.kept.title} stays on its order. Open another order from the list, and it opens beside it to compare.`,
        action: { label: "Follow again", run: () => jali.actions.setKept(s.kept.id, false) },
      };
    case "both":
      return {
        badge: "Kept and following",
        kept: true,
        text: `${s.kept.title} is kept. ${s.follower.title} follows the list: pick another order and only it changes.`,
        // Back to one detail that follows: the newer follower goes, and the kept one follows again. (Let go beside a
        // follower, Jali would keep that follower in its place instead, so there is one.)
        action: {
          label: "Follow again",
          run: () => {
            jali.actions.close(s.follower.id);
            jali.actions.setKept(s.kept.id, false);
          },
        },
      };
    case "none":
      return {
        badge: "Following",
        kept: false,
        text: "Open an order from the list, and its detail follows the list.",
        action: null,
      };
  }
}

export function FollowDemo() {
  const { jali } = useShopDemo("chain");
  // The state as text, so React re-renders only when it changes.
  const key = useSyncExternalStore(
    jali.subscribe,
    () => JSON.stringify(followState(jali)),
    () => JSON.stringify(followState(jali)),
  );
  const state = useMemo(() => JSON.parse(key) as FollowState, [key]);
  const { badge, kept, text, action } = describe(state, jali);
  return (
    <div className="landing-follow-demo">
      <div className="landing-follow-bar" role="group" aria-label="What the order pane does">
        {/* The same marks as the toggle in the pane's header: a link while it follows, an anchor once kept. */}
        <span className="landing-follow-state" data-mode={state.mode}>
          {kept ? (
            <AnchorSimpleIcon aria-hidden size={14} weight="bold" />
          ) : (
            <LinkSimpleHorizontalIcon aria-hidden size={14} weight="bold" />
          )}
          {badge}
        </span>
        <p className="landing-follow-text" aria-live="polite">
          {text}
        </p>
        {action ? (
          <button type="button" className="landing-follow-action" onClick={action.run}>
            {action.label}
          </button>
        ) : null}
      </div>
      <NamedWorkspace
        jali={jali}
        height={340}
        label="Orders, the order following them, and its customer following the order"
      />
    </div>
  );
}
