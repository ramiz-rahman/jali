/**
 * What React's features render for the instance, by name: the one map their parts are read through. Each feature puts
 * its part in `parts` under one of these names (`palette()` gives `{ palette: Palette }`), and the root, the pane chrome
 * and Pop out read it back with `partOf`, typed by this map. Type-only imports: a feature's code still reaches an app
 * only through its own entry.
 */
import type { ComponentType, ReactNode } from "react";
import type { NodeId } from "@jali/core";
import { partsReader } from "@jali/core/adapter";
import type { ReactPopOut } from "./pop-out";

export interface ReactParts {
  /** ⌘K's palette (`palette()`). */
  palette: ComponentType;
  /** The settings panel (`settings()`); `<JaliRoot settingsExtra>` is its children. */
  settings: ComponentType<{ children?: ReactNode }>;
  /** The chooser (`chooser()`). */
  chooser: ComponentType;
  /** The field that renames a pane in place (`rename()`). */
  renameField: ComponentType<{ pane: NodeId; title: string }>;
  /** Pop out's window as the chrome reads it (`popOut()`): the core's window, and where a popped-out pane renders. */
  popOut: ReactPopOut;
}

/** A part one of React's features gave the instance, if it has that feature. */
export const partOf = /* @__PURE__ */ partsReader<ReactParts>();
