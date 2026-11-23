import { useJali, useJaliState } from "jali/react";

/** The presets as buttons in your own top bar. Render it inside <JaliRoot>. */
export function PresetMenu() {
  const { presets, actions } = useJali();
  const current = useJaliState((s) => s.presetId);
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
