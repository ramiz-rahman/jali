import { Activity, KindIcon, useTitleOf, useModel, useUi } from "@jali/react";

// Your own list of open panes, with Jali's icon and activity marks.
export function OpenPanes() {
  const m = useModel();
  const titleOf = useTitleOf();
  const activity = useUi((s) => s.activity);
  return (
    <ul>
      {m.panes.map((p) => (
        <li key={p.id}>
          <KindIcon kind={p.ref.kind} size={14} /> {titleOf(p)} <Activity a={activity[p.id]} />
        </li>
      ))}
    </ul>
  );
}
