import { useProfile, useStore, useUi } from "@jali/react";

/** Data Studio or a curated page: the lab shows both so the two control models can be compared. */
export function AppSwitch() {
  const p = useProfile();
  const inReview = useUi((s) => !!s.review);
  const { actions, env } = useStore();
  if (!p) return <span className="brand-name">{env.name}</span>;
  return (
    <div className="app-switch" role="radiogroup" aria-label="Workspace">
      <button role="radio" aria-checked={!inReview} className="app-btn" onClick={() => inReview && actions.leaveReview()}>{env.name}</button>
      <button role="radio" aria-checked={inReview} className="app-btn" onClick={() => !inReview && actions.enterReview()}>{p.name}</button>
    </div>
  );
}
