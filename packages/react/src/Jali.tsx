/**
 * The two components an app starts with. `<Jali store>` provides the store, renders the workspace's root element
 * (DOM lookups, focus and drag stay inside it) and the dialogs every workspace has: the ⌘K palette, settings, the
 * "Add to tabs of…" chooser, "Discard unsaved changes?" and the live region. `<JaliView>` is the workspace itself:
 * the panes, or the curated page while one is open. Put your own chrome around it, inside `<Jali>`:
 *
 *   <Jali store={store} className="app">
 *     <MyTopBar />
 *     <JaliView />
 *   </Jali>
 *
 * Two things are the host's to render: the shelf (`<Shelf />`, tucked and folded panes as chips, usually in a status
 * line) and toasts (`store.onToast`; closes and tucks offer Undo). Put a toaster in `overlays`.
 */
import type { HTMLAttributes, ReactNode } from "react";
import type { UiStore } from "@jali/core/adapter";
import { Announcer } from "./chrome/Announcer";
import { CuratedPage } from "./chrome/PageBar";
import { Chooser } from "./dialogs/Chooser";
import { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
import { Palette } from "./dialogs/Palette";
import { SettingsPanel } from "./dialogs/Settings";
import { StoreProvider, useUi } from "./state/react";
import { Workspace } from "./workspace/Workspace";

export interface JaliProps extends HTMLAttributes<HTMLDivElement> {
  store: UiStore;
  children?: ReactNode;
  /** Rendered after the root, inside the provider: things that must sit outside the workspace, such as a toaster
   *  (focus is never pulled back from outside the root). */
  overlays?: ReactNode;
  /** Leave out the settings panel (open it with `store.set({ settingsOpen: true })` otherwise). Default true. */
  settings?: boolean;
  /** Your own fieldsets, shown at the end of the settings panel (`<fieldset><legend>…</legend>…</fieldset>`). */
  settingsExtra?: ReactNode;
}

export function Jali({ store, children, overlays, settings = true, settingsExtra, ...rest }: JaliProps) {
  return (
    <StoreProvider store={store}>
      <div {...rest} data-jali="" ref={store.dom.attach}>{children}</div>
      <Announcer />
      <Palette />
      {settings ? <SettingsPanel>{settingsExtra}</SettingsPanel> : null}
      <Chooser />
      <ConfirmDiscard />
      {overlays}
    </StoreProvider>
  );
}

/** The panes, or the curated page (its rail, header and tabs around them) while one is open. */
export function JaliView() {
  return useUi((s) => !!s.page) ? <CuratedPage /> : <Workspace />;
}
