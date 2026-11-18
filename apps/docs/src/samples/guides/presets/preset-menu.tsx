import { useWorkspace, useWorkspaceState } from "@jali/react";

/** The presets as buttons in your own top bar. Render it inside <Jali>. */
export function PresetMenu() {
  const { env, actions } = useWorkspace();
  const current = useWorkspaceState((s) => s.presetId);
  return (
    <nav aria-label="Layouts">
      {env.presets.map((p) => (
        <button key={p.id} aria-pressed={p.id === current} onClick={() => actions.preset(p.id)}>
          {p.label}
        </button>
      ))}
    </nav>
  );
}
