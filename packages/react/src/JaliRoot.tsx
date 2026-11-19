/**
 * The component an app starts with. `<JaliRoot jali>` renders the workspace, the dialogs every workspace has (⌘K,
 * settings, "Add to tabs of…", "Discard unsaved changes?") and the live region, and starts the workspace's keys,
 * Back and Forward, theme and saving while it is mounted.
 *
 *   <JaliRoot jali={jali} />
 *
 * To put your own chrome around the panes, pass children and place `<JaliView />` among them:
 *
 *   <JaliRoot jali={jali} className="app">
 *     <MyTopBar />
 *     <JaliView />
 *   </JaliRoot>
 *
 * Two things are the host's to render: the shelf (`<Shelf />`, tucked and folded panes as chips, usually in a status
 * line) and toasts (`jali.onToast`; closes and tucks offer Undo). Put a toaster in `overlays`.
 */
import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import { storeOf, type Jali } from "@jali/core/adapter";
import { Announcer } from "./chrome/Announcer";
import { CuratedPage } from "./chrome/PageBar";
import { Chooser } from "./dialogs/Chooser";
import { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
import { Palette } from "./dialogs/Palette";
import { SettingsPanel } from "./dialogs/Settings";
import { StoreProvider, useUi } from "./state/react";
import { Panes } from "./workspace/Workspace";

export interface JaliRootProps extends HTMLAttributes<HTMLDivElement> {
  jali: Jali;
  /** What goes inside the workspace's root. Default: `<JaliView />`. */
  children?: ReactNode;
  /** Rendered after the root, inside the provider: things that must sit outside the workspace, such as a toaster
   *  (focus is never pulled back from outside the root). */
  overlays?: ReactNode;
  /** Include the settings panel (opened from ⌘K). Default true. */
  settings?: boolean;
  /** Your own fieldsets, shown at the end of the settings panel (`<fieldset><legend>…</legend>…</fieldset>`). */
  settingsExtra?: ReactNode;
}

export function JaliRoot({
  jali,
  children = <JaliView />,
  overlays,
  settings = true,
  settingsExtra,
  ...rest
}: JaliRootProps) {
  const store = storeOf(jali);
  useEffect(() => store.start(), [store]);
  return (
    <StoreProvider store={store}>
      <div {...rest} data-jali="" ref={store.dom.attach}>
        {children}
      </div>
      {/* The dialogs render outside the root but are this workspace's: keys pressed in them count as its own. */}
      <div data-jali-layer="" ref={store.dom.attachLayer} style={{ display: "contents" }}>
        <Announcer />
        {store.env.palette === false ? null : <Palette />}
        {settings ? <SettingsPanel>{settingsExtra}</SettingsPanel> : null}
        <Chooser />
        <ConfirmDiscard />
      </div>
      {overlays}
    </StoreProvider>
  );
}

/** The panes, or the curated page (its rail, header and tabs around them) while one is open. */
export function JaliView() {
  return useUi((s) => !!s.page) ? <CuratedPage /> : <Panes />;
}
