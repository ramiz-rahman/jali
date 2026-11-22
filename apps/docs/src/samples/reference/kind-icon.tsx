import { Activity, KindIcon, useJaliModel, useJaliState } from "jali/react";

// Your own list of open panes, with Jali's icon and activity marks.
export function OpenPanes() {
  const m = useJaliModel();
  const activity = useJaliState((s) => s.activity);
  return (
    <ul>
      {m.panes.map((p) => (
        <li key={p.id}>
          <KindIcon kind={p.ref.kind} size={14} /> {m.title(p.id)} <Activity activity={activity[p.id]} />
        </li>
      ))}
    </ul>
  );
}
