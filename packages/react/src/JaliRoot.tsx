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
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { spacingVars, storeOf } from "@jali/core/adapter";
import { Announcer } from "./chrome/Announcer";
import { Chooser } from "./dialogs/Chooser";
import { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
import { Palette } from "./dialogs/Palette";
import { SettingsPanel } from "./dialogs/Settings";
import { IconsProvider } from "./icons/context";
import { defaultIcons } from "./icons/default";
import type { JaliIcon, JaliIcons } from "./icons/types";
import { Guard } from "./chrome/Guard";
import { installPressed } from "./pressed";
import { StoreProvider, useDomScope, useStore, useTheme, useUi } from "./state/react";
import { Panes } from "./workspace/Workspace";
import { PAGE_PARTS } from "./define";
import { overlaysDomId } from "./a11y/ModalDialog";
import { isDev } from "./dev";
import { LabelContext } from "./a11y/landmark";

export interface JaliRootProps extends HTMLAttributes<HTMLDivElement> {
  jali: Jali;
  /** What goes inside the workspace's root. Default: `<JaliView />`. */
  children?: ReactNode;
  /** Rendered after the root, inside the provider: things that must sit outside the workspace, such as a toaster
   *  (focus is never pulled back from outside the root). Inert, like the workspace, while one of Jali's dialogs is
   *  open; they sit in an element of their own (`data-jali-overlays`, `display: contents`) for that. */
  overlays?: ReactNode;
  /** Include the settings panel (opened from ⌘K). Default true. */
  settings?: boolean;
  /** Your own fieldsets, shown at the end of the settings panel (`<fieldset><legend>…</legend>…</fieldset>`). */
  settingsExtra?: ReactNode;
  /** Your own icons for any of Jali's, by name (`{ close: MyClose }`); the rest stay Jali's own. One that throws
   *  draws Jali's own instead. */
  icons?: Partial<JaliIcons>;
  /** A throw in your code inside the root (its children, `settingsExtra`) or in Jali's own parts: the workspace shows
   *  "… could not be shown" with Retry in place of what failed, your app around it stays, and this hears the error.
   *  A pane's own failures go to `createJali({ onPaneError })`. */
  onError?: (error: unknown) => void;
  /** The workspace's name, over `createJali({ label })`, read at every render (so it can follow a locale). It names
   *  the workspace's landmark, and each landmark inside it carries it ("Order 7, Orders"). Not set on the root. */
  "aria-label"?: string;
  /** The id of a visible heading that names the workspace, as APG prefers; the landmarks inside carry its text. */
  "aria-labelledby"?: string;
}

/** The same icons, name by name: an inline `icons={{ close: MyClose }}` is a new object on every render. */
const sameIcons = (a: Partial<JaliIcons> | undefined, b: Partial<JaliIcons> | undefined) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const names = Object.keys(a) as (keyof JaliIcons)[];
  return names.length === Object.keys(b).length && names.every((n) => a[n] === b[n]);
};

/** Jali's icons with the host's over them, a new object only when one of the host's changes. */
function useIcons(icons: Partial<JaliIcons> | undefined): JaliIcons {
  const kept = useRef(icons);
  if (!sameIcons(kept.current, icons)) kept.current = icons;
  const own = kept.current;
  return useMemo(() => {
    if (!own) return defaultIcons;
    const all = { ...defaultIcons };
    // Each of the host's inside a boundary: one that throws draws Jali's own.
    for (const [name, Own] of Object.entries(own) as [keyof JaliIcons, JaliIcon][]) {
      const Fallback = defaultIcons[name];
      all[name] = (props) => (
        <Guard fallback={() => <Fallback {...props} />}>
          <Own {...props} />
        </Guard>
      );
    }
    return all;
  }, [own]);
}

export function JaliRoot({
  jali,
  icons,
  children = <JaliView />,
  overlays,
  settings = true,
  settingsExtra,
  onError,
  "aria-label": label,
  "aria-labelledby": by,
  ...rest
}: JaliRootProps) {
  const store = storeOf(jali);
  // Before anything here reads its ids (the overlays' wrapper).
  useDomScope(store);
  useEffect(() => store.start(), [store]);
  // data-pressed on Jali's controls while held, by pointer or key (pressed.ts).
  useEffect(installPressed, []);
  const host = useFullScreenPane(store);
  const inside = (layer: ReactNode) => (host ? createPortal(layer, host) : layer);
  // The spacing the layout measures with, as --jali-gap and --jali-inset, so styles that read them agree with it.
  // After the host's style: geometry was measured with them, so a style can't make the CSS disagree.
  const spacing = spacingVars(store.env.spacing) as CSSProperties;
  // What the root's scope gives its panes, the dialog layer and the overlays get too (they render outside it): its
  // direction, the host's data-theme and its --jali-* tokens.
  const dir = store.env.dir ?? rest.dir;
  const theme = (rest as Record<string, unknown>)["data-theme"] as string | undefined;
  const tokens = Object.fromEntries(
    Object.entries(rest.style ?? {}).filter(([k]) => k.startsWith("--jali-")),
  ) as CSSProperties;
  // A heading's text, for the landmarks inside, read once the heading is in the page (and when it changes).
  const [heading, setHeading] = useState<string>();
  useEffect(() => {
    if (!by) return setHeading(undefined);
    const read = () => setHeading(document.getElementById(by)?.textContent?.trim() || undefined);
    read();
    const el = document.getElementById(by);
    if (!el || typeof MutationObserver === "undefined") return;
    const watch = new MutationObserver(read);
    watch.observe(el, { characterData: true, childList: true, subtree: true });
    return () => watch.disconnect();
  }, [by]);
  const named = useMemo(
    () => ({ label: label?.trim() || heading, by: label?.trim() ? undefined : by }),
    [label, heading, by],
  );
  return (
    <JaliProvider jali={jali} icons={icons}>
      <LabelContext.Provider value={named}>
        <div
          {...rest}
          style={{ ...rest.style, ...spacing }}
          dir={dir}
          data-jali=""
          ref={store.dom.attach}
        >
          <Guard onError={onError} fallback={(retry) => <Failed retry={retry} />}>
            {children}
          </Guard>
        </div>
        {/* The dialogs render outside the root but are this workspace's: keys pressed in them count as its own. While a
          pane is the browser's full-screen element, they render inside it, the only part of the page on screen. */}
        {inside(
          <div
            data-jali-layer=""
            dir={dir}
            data-theme={theme}
            ref={store.dom.attachLayer}
            style={{ ...tokens, ...spacing, display: "contents" }}
          >
            <Guard onError={onError}>
              <Announcer />
              <Dialogs
                palette={store.env.palette !== false}
                settings={settings ? <Guard onError={onError}>{settingsExtra}</Guard> : null}
              />
            </Guard>
          </div>,
        )}
        {store.env.pageTheme === false ||
        (rest as Record<string, unknown>)["data-theme"] !== undefined ? null : (
          <ThemeOnRoot layer={host} />
        )}
        {overlays == null ? null : (
          <div
            data-jali-overlays=""
            id={overlaysDomId(store.dom.id)}
            dir={dir}
            style={{ display: "contents" }}
          >
            {overlays}
          </div>
        )}
      </LabelContext.Provider>
    </JaliProvider>
  );
}

/**
 * Jali's dialogs, one at a time: the discard question over the chooser, over ⌘K, over Settings. The one beneath comes
 * back when the one above closes. Settings asked for where the root renders none closes again at once, so nothing
 * holds the workspace's keys for a dialog that isn't there.
 */
function Dialogs({ palette, settings }: { palette: boolean; settings: ReactNode }) {
  const store = useStore();
  const top = useUi((s) =>
    s.confirm
      ? "confirm"
      : s.chooser
        ? "chooser"
        : s.paletteOpen && palette
          ? "palette"
          : s.settingsOpen
            ? "settings"
            : null,
  );
  const orphan = top === "settings" && settings === null;
  useEffect(() => {
    if (orphan) store.actions.closeSettings();
  }, [orphan, store]);
  return top === "confirm" ? (
    <ConfirmDiscard />
  ) : top === "chooser" ? (
    <Chooser />
  ) : top === "palette" ? (
    <Palette />
  ) : top === "settings" && !orphan ? (
    <SettingsPanel>{settings}</SettingsPanel>
  ) : null;
}

/** In place of the root's children when something in them threw: the workspace's name, could not be shown, Retry. */
function Failed({ retry }: { retry: () => void }) {
  const store = useStore();
  const t = store.messages.pane;
  return (
    <div className="jali-pane-failed" role="alert">
      <strong>{t.failed(store.env.label ?? store.env.name)}</strong>
      <div className="jali-pane-failed-actions">
        <button type="button" className="jali-text-btn is-primary" onClick={retry}>
          {t.retry}
        </button>
      </div>
    </div>
  );
}

/**
 * The resolved theme on the root and the layer too, as on <html>, for styles scoped to the workspace. Not with
 * pageTheme: false, where the page's own scopes decide (a data-theme here would become one of them), nor over a
 * data-theme the app gave the root. Written after mount, as on <html>, so a server render never disagrees with it.
 */
function ThemeOnRoot({ layer }: { layer: unknown }) {
  const store = useStore();
  const theme = useTheme();
  useEffect(() => {
    const els = [store.dom.root(), store.dom.layer()].filter((el) => el instanceof Element);
    for (const el of els) el.setAttribute("data-theme", theme);
    return () => {
      for (const el of els) el.removeAttribute("data-theme");
    };
  }, [store, theme, layer]);
  return null;
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
  const open = useUi((s) => !!s.page);
  const profile = useStore().env.profile;
  const Page = profile?.[PAGE_PARTS]?.View;
  useEffect(() => {
    if (profile && !Page && isDev())
      console.error(
        "Jali: this page has no parts to render it, so <JaliView> shows bare panes. Make it with definePage from " +
          "@jali/react, not from @jali/core.",
      );
  }, [profile, Page]);
  return open && Page ? <Page /> : <Panes />;
}
