import type { Settings as S } from "@jali/core";
import { viewerLabel } from "@jali/core/adapter";
import { useStore, useUi } from "../state/react";

/** The page's fieldsets in Settings: how opened panes are marked, and the viewer the page is seen as. */
export function PageSettings() {
  const store = useStore();
  const id = store.dom.id;
  const settings = useUi((s) => s.settings);
  const page = useUi((s) => s.page);
  const linkMode = useUi((s) => s.linkMode);
  const profile = store.env.profile!;
  const t = store.messages.settings;
  const full = viewerLabel(profile, true, store.messages.page);
  const limited = viewerLabel(profile, false, store.messages.page);
  const set = (patch: Partial<S>) => store.actions.changeSettings(patch);
  return (
    <>
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
      {page ? (
        <fieldset>
          <legend>{t.viewingAs(profile.name)}</legend>
          <label className="jali-setting">
            <input
              type="radio"
              name={`${id}-viewer`}
              checked={linkMode === "open"}
              onChange={() => store.run("page.setLinkMode", "open")}
            />
            <span>{t.viewerFull(full)}</span>
          </label>
          <label className="jali-setting">
            <input
              type="radio"
              name={`${id}-viewer`}
              checked={linkMode === "peek"}
              onChange={() => store.run("page.setLinkMode", "peek")}
            />
            <span>{t.viewerLimited(limited)}</span>
          </label>
        </fieldset>
      ) : null}
    </>
  );
}
