import type { Settings as S } from "@jali/core";
import { useStore, useUi } from "../state/react";

/** The page's fieldset in Settings: how opened panes are marked. */
export function PageSettings() {
  const store = useStore();
  const id = store.dom.id;
  const settings = useUi((s) => s.settings);
  const profile = store.env.profile!;
  const t = store.messages.settings;
  const set = (patch: Partial<S>) => store.actions.changeSettings(patch);
  return (
    <fieldset>
      <legend>{t.openedPanes(profile.name)}</legend>
      <label className="jali-setting">
        <input
          type="radio"
          name={`${id}-boundary`}
          checked={settings.boundary === "tint"}
          onChange={() => set({ boundary: "tint" })}
        />
        <span>{t.boundaryTint}</span>
      </label>
      <label className="jali-setting">
        <input
          type="radio"
          name={`${id}-boundary`}
          checked={settings.boundary === "none"}
          onChange={() => set({ boundary: "none" })}
        />
        <span>{t.boundaryNone}</span>
      </label>
    </fieldset>
  );
}
