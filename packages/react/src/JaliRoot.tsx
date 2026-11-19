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
 * Two things are the host's to render: the shelf (`<Shelf />`, tucked panes as chips, usually in a status
 * line) and toasts (`jali.onToast`; closes and tucks offer Undo). Put a toaster in `overlays`.
 *
 * Icons: Jali's own (`defaultIcons`), with the host's `icons` over them by name.
 */
import type { Jali } from "@jali/core";
import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { storeOf } from "@jali/core/adapter";
import { Announcer } from "./chrome/Announcer";
import { CuratedPage } from "./chrome/PageBar";
import { Chooser } from "./dialogs/Chooser";
import { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
import { Palette } from "./dialogs/Palette";
import { SettingsPanel } from "./dialogs/Settings";
import { IconsProvider } from "./icons/context";
import { defaultIcons } from "./icons/default";
import type { JaliIcons } from "./icons/types";
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
  /** Your own icons for any of Jali's, by name (`{ close: MyClose }`); the rest stay Jali's own. */
  icons?: Partial<JaliIcons>;
}

const useIcons = (icons: Partial<JaliIcons> | undefined): JaliIcons =>
  useMemo(() => (icons ? { ...defaultIcons, ...icons } : defaultIcons), [icons]);

export function JaliRoot({
  jali,
  icons,
  children = <JaliView />,
  overlays,
  settings = true,
  settingsExtra,
  ...rest
}: JaliRootProps) {
  const store = storeOf(jali);
  useEffect(() => store.start(), [store]);
  const host = useFullScreenPane(store);
  const inside = (layer: ReactNode) => (host ? createPortal(layer, host) : layer);
  return (
    <JaliProvider jali={jali} icons={icons}>
      <div {...rest} dir={store.env.dir ?? rest.dir} data-jali="" ref={store.dom.attach}>
        {children}
      </div>
      {/* The dialogs render outside the root but are this workspace's: keys pressed in them count as its own. While a
          pane is the browser's full-screen element, they render inside it, the only part of the page on screen. */}
      {inside(
        <div
          data-jali-layer=""
          dir={store.env.dir}
          ref={store.dom.attachLayer}
          style={{ display: "contents" }}
        >
          <Announcer />
          {store.env.palette === false ? null : <Palette />}
          {settings ? <SettingsPanel>{settingsExtra}</SettingsPanel> : null}
          <Chooser />
          <ConfirmDiscard />
        </div>,
      )}
      {overlays}
    </JaliProvider>
  );
}

/** Provides a workspace and its icons to the hooks and parts below it. `<JaliRoot>` does this; use it to render Jali's parts on their own. */
export function JaliProvider({
  jali,
  icons,
  children,
}: {
  jali: Jali;
  icons?: Partial<JaliIcons>;
  children?: ReactNode;
}) {
  return (
    <StoreProvider store={storeOf(jali)}>
      <IconsProvider icons={useIcons(icons)}>{children}</IconsProvider>
    </StoreProvider>
  );
}

const onFullScreen = (l: () => void) => {
  document.addEventListener("fullscreenchange", l);
  return () => document.removeEventListener("fullscreenchange", l);
};

/** This workspace's pane that is the browser's full-screen element, if one is. */
function useFullScreenPane(store: ReturnType<typeof storeOf>): HTMLElement | null {
  return useSyncExternalStore(
    onFullScreen,
    () => {
      const el = document.fullscreenElement;
      return el instanceof HTMLElement && el.id.startsWith(`${store.dom.id}-pane-`) ? el : null;
    },
    () => null,
  );
}

/** The panes, or the curated page (its rail, header and tabs around them) while one is open. */
export function JaliView() {
  return useUi((s) => !!s.page) ? <CuratedPage /> : <Panes />;
}
