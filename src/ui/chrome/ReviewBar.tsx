import { RotateCcw, Undo2 } from "lucide-react";
import { investigation } from "../actions/review";
import { getProfile } from "../profile";
import { useModel, useStore, useUi } from "../state/react";

/**
 * A curated workspace's layout controls live in the top bar: the arrangement, a toggle for each supporting pane, the
 * investigation (panes opened from links) with its way back, and Reset. Pane headers keep only maximise and hide.
 */
export function ReviewBar() {
  const p = getProfile();
  const review = useUi((s) => s.review);
  const m = useModel();
  const { actions } = useStore();
  if (!p || !review) return null;
  const opened = investigation(m.panes).length;
  return (
    <div className="review-bar">
      <div className="seg" role="radiogroup" aria-label="Arrangement">
        {p.arrangements.map((a) => (
          <button key={a.id} role="radio" aria-checked={review.arrangement === a.id} className="seg-btn" onClick={() => actions.arrange(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="role-toggles" role="toolbar" aria-label="Panes">
        {p.roles.filter((r) => r.priority === "supporting").map((r) => {
          const shown = !m.off.includes(r.id);
          const Icon = r.icon;
          return (
            <button key={r.id} className="role-toggle" aria-pressed={shown} onClick={() => actions.toggleRole(r.id)}
              title={shown ? `Hide ${r.label}` : `Show ${r.label}`} data-role={r.id}>
              <Icon size={14} strokeWidth={1.5} aria-hidden /> <span className="role-label">{r.label}</span>
            </button>
          );
        })}
      </div>
      {opened ? (
        <div className="inv" role="group" aria-label="Investigation">
          <span className="inv-mark" aria-hidden />
          <span className="inv-text">Investigating · <b>{opened}</b> opened</span>
          <button className="inv-back" onClick={() => actions.backToReview()}>
            <Undo2 size={13} strokeWidth={1.75} aria-hidden /> Back to review
          </button>
        </div>
      ) : null}
      <button className="icon-btn review-reset" onClick={() => actions.resetArrangement()} aria-label="Reset layout to its design" title="Reset layout · drops your sizes and hidden panes">
        <RotateCcw size={15} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/** Data Studio or a curated workspace: the lab shows both side by side so the two control models can be compared. */
export function AppSwitch() {
  const p = getProfile();
  const inReview = useUi((s) => !!s.review);
  const { actions } = useStore();
  if (!p) return <span className="brand-name">Pane lab</span>;
  return (
    <div className="app-switch" role="radiogroup" aria-label="Workspace">
      <button role="radio" aria-checked={!inReview} className="app-btn" onClick={() => inReview && actions.leaveReview()}>Data Studio</button>
      <button role="radio" aria-checked={inReview} className="app-btn" onClick={() => !inReview && actions.enterReview()}>{p.name}</button>
    </div>
  );
}
