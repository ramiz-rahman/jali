/**
 * What an instance is made of, beyond its state: its pane kinds, presets, features and options, resolved once by
 * `createJali` (create-jali.ts) and read by every step through its snapshot (`x.env`). A curated page's own types are
 * in profile.ts.
 */
import type { Direction, Layout, NodeId, PaneNode } from "./layout/types";
import type { LayoutInput } from "./layout/build";
import type { PaneErrorInfo, PaneKinds } from "./pane-kinds";
import type { Command } from "./commands/registry";
import type { Messages } from "./state/messages";
import { roleOf, type PageEngine, type ProfileBase } from "./profile";
import { own } from "./own";

/** A pane's name: its role in a curated page ("Borrower"), else what it shows: the title its content set from its
 *  data (`titles`, useTitle), else its kind's title ("member 12"). */
export function titleOf(env: Env, node: PaneNode, titles?: Record<NodeId, string>): string {
  const role = node.role && env.profile ? roleOf(env.profile, node.role) : undefined;
  return role?.label ?? shownTitle(env, node, titles);
}

/** What a pane shows, by name: the title its content set (useTitle), else its kind's title. Ignores roles. */
export const shownTitle = (env: Env, node: PaneNode, titles?: Record<NodeId, string>): string =>
  own(titles, node.id) ?? env.kinds.title(node.ref);

/** A layout the person can switch to from the bar or ⌘K ("Layout: One table"). `build` returns a fresh layout. */
export interface Preset {
  id: string;
  label: string;
  build: () => Layout;
  /** The layout the person left it in, if the app kept one (`PresetOptions.saved`). */
  saved?: () => LayoutInput | undefined;
}

/** What an instance is made of, beyond its state: its pane kinds, presets and (a curated page) its profile. One per store. */
export interface Env {
  kinds: PaneKinds;
  /** The curated page this instance can show (`?page=<id>`); null for an instance with none. */
  profile: ProfileBase | null;
  /** Layouts to start from, in menu order. May be empty. */
  presets: readonly Preset[];
  /** The host's own commands, after Jali's in the palette; the keymap can bind them (`createJaliStore({ commands })`). */
  commands?: readonly Command[];
  /** The app's name for the free layout, where the person builds it ("Data Studio"), in commands such as "Open Data
   *  Studio". Default: none. */
  name?: string;
  /** The kind a split or a new tab opens until the person chooses what to show. Without one, there is no Split. */
  launcher?: string;
  /** Whether Jali renders its palette (the `palette()` feature); false when the host shows Jali's commands in its own
   *  command menu. */
  palette?: boolean;
  /** The instance's features (`createJali({ features })`), one of each id. */
  features?: readonly import("./features/feature").Feature[];
  /** Every word the instance shows or says (state/messages.ts). Default: English (`en`). */
  messages?: Messages;
  /** The curated page's engine, when `profile` is set (from `definePage`). */
  page?: PageEngine;
  /** Told when a pane's content throws while rendering (`createJali({ onPaneError })`). */
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void;
  /** The reading direction it was given (`createJali({ dir })`); unset, the instance follows its page. */
  dir?: Direction;
  /** `"main"` when the panes are the page's main content (`createJali({ landmark })`); unset, a labelled region. */
  landmark?: "region" | "main";
  /** The instance's name for assistive technology (`createJali({ label })`): its landmarks are named with it. */
  label?: string;
  /** `false` when the page keeps its own theme (`createJali({ pageTheme })`): Jali writes no `data-theme`. */
  pageTheme?: false;
  /** `false` when the app asks about unsaved work itself (`createJali({ confirmDiscard })`). */
  confirmDiscard?: false;
  /** The app's items for a tab's menu (`createJali({ tabMenu })`). */
  tabMenu?: import("./commands/tab-menu").TabMenu;
  /** Renaming a pane in place (`createJali({ rename })`). */
  rename?: import("./actions/rename").Rename;
  /** How the instance behaves on a phone (`createJali({ phone })`). */
  phone?: PhoneOptions;
  /** What may happen to panes (`createJali({ allow })`). */
  allow?: import("./actions/allow").Allow;
  /** The buttons in a pane's header (`createJali({ buttons })`). */
  buttons?: import("./pane/buttons").PaneButtons;
  /** The gap between panes and the inset from the root's edges, in px (`createJali({ gap, inset })`). */
  spacing: import("./tokens").Spacing;
}

/** How the instance behaves on a phone. */
export interface PhoneOptions {
  /**
   * Below this width, in CSS pixels, Jali shows one pane at a time, with a switcher.
   * Default 600, Android's compact width, which covers portrait phones. `0` leaves it to the panes' minimum widths
   * alone (one pane at a time only when even one pane can't fit), as before 19 Nov 2026.
   */
  below?: number;
  /**
   * On a portrait phone, show two linked panes one above the other instead of one: the focused pane and the pane it
   * was opened from (a list above its detail), when both have room (each at least `stackFloor` tall, default 200,
   * and the instance at least 480). Default false. A kind can stay out (`phone: { stack: false }`) or ask for its
   * half (`phone: { place: "top" }`).
   */
  stack?: boolean;
  /** The shortest a stacked pane may be, in CSS pixels. Default 200. */
  stackFloor?: number;
  /**
   * On a device whose screen folds into two (a half-open Fold, a Flip in flex mode, a dual-screen phone), put a pane
   * each side of the fold, so none straddles the hinge. Read from the browser's viewport segments (Chrome and Edge
   * 138 and later); elsewhere nothing changes. Default true.
   */
  fold?: boolean;
}

/** The phone width when none is given: Android's compact window width. */
export const PHONE_BELOW = 600;

export const presetById = (env: Pick<Env, "presets">, id: string | undefined): Preset | undefined =>
  env.presets.find((p) => p.id === id) ?? env.presets[0];
