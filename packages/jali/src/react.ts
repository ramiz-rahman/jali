/**
 * jali/react: `<JaliRoot>`, `definePane`, the hooks and the chrome parts an app places itself. Styles:
 * "jali/styles.css" (Jali's default theme and the panes, in the `jali` cascade layer), "jali/tailwind.css" to take
 * the app's Tailwind theme. A curated page is `jali/page`.
 */
export { JaliRoot, JaliView, type JaliRootProps } from "@jali/react/internal";
export {
  definePane,
  type Pane,
  type PaneProps,
  type PaneOptionsReact,
  type PaneKindDef,
  type MissingProps,
} from "@jali/react/internal";

// ---------- inside a pane ----------
export {
  usePane,
  useActivity,
  useUnsaved,
  useCommands,
  useTitle,
  usePaneAttributes,
  useHeaderActions,
  useLauncher,
  type LauncherSources,
} from "@jali/react/internal";
export { usePaneState, type PaneStateOptions } from "@jali/react/internal";

// ---------- the instance in React ----------
export {
  useJali,
  useJaliState,
  useJaliModel,
  useJaliEvent,
  useJaliTheme,
} from "@jali/react/internal";
export { useJaliShortcut } from "@jali/react/internal";

// ---------- chrome of your own, inside <JaliRoot> around <JaliView /> ----------
export { PageBar } from "@jali/react/internal";
export { Shelf } from "@jali/react/internal";
export { KindIcon } from "@jali/react/internal";
export { Activity } from "@jali/react/internal";
export { IconButton, type IconButtonProps } from "@jali/react/internal";

// ---------- icons ----------
export type { JaliIcon, JaliIconName, JaliIconProps, JaliIcons } from "@jali/react/internal";
