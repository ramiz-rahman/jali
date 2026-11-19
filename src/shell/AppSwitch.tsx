import { useJali, useJaliState } from "@jali/react";

/** Data Studio or a curated page: the lab shows both so the two control models can be compared. */
export function AppSwitch() {
  const { actions, env } = useJali();
  const p = env.profile;
  const inPage = useJaliState((s) => !!s.page);
  if (!p) return <span className="brand-name">{env.name}</span>;
  return (
    <div className="app-switch" role="radiogroup" aria-label="Workspace">
      <button
        role="radio"
        aria-checked={!inPage}
        className="app-btn"
        onClick={() => inPage && actions.leavePage()}
      >
        {env.name}
      </button>
      <button
        role="radio"
        aria-checked={inPage}
        className="app-btn"
        onClick={() => !inPage && actions.openPage()}
      >
        {p.name}
      </button>
    </div>
  );
}
