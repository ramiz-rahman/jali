import { Activity, KindIcon, useWorkspaceModel, useWorkspaceState } from "@jali/react";

// Your own list of open panes, with Jali's icon and activity marks.
export function OpenPanes() {
  const m = useWorkspaceModel();
  const activity = useWorkspaceState((s) => s.activity);
  return (
    <ul>
      {m.panes.map((p) => (
        <li key={p.id}>
          <KindIcon kind={p.ref.kind} size={14} /> {m.title(p.id)} <Activity a={activity[p.id]} />
        </li>
      ))}
    </ul>
  );
}
