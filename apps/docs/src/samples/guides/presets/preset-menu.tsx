import { useActions, useEnv, useUi } from "@jali/react";

/** The presets as buttons in your own top bar. Render it inside <Jali>. */
export function PresetMenu() {
  const { presets } = useEnv();
  const current = useUi((s) => s.presetId);
  const actions = useActions();
  return (
    <nav aria-label="Layouts">
      {presets.map((p) => (
        <button key={p.id} aria-pressed={p.id === current} onClick={() => actions.preset(p.id)}>
          {p.label}
        </button>
      ))}
    </nav>
  );
}
