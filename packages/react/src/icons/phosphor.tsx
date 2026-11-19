/**
 * Jali's default icons: Phosphor's (`@phosphor-icons/react`), regular weight, one module per icon so a bundle takes
 * only these. Only `@jali/react` and `@jali/react/icons` import this file; `@jali/react/bare` never does.
 */
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowDownIcon } from "@phosphor-icons/react/ArrowDown";
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { ArrowsInLineHorizontalIcon } from "@phosphor-icons/react/ArrowsInLineHorizontal";
import { ArrowsInSimpleIcon } from "@phosphor-icons/react/ArrowsInSimple";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/ArrowsLeftRight";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/ArrowsOutSimple";
import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/ArrowUUpLeft";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CornersOutIcon } from "@phosphor-icons/react/CornersOut";
import { DotsSixIcon } from "@phosphor-icons/react/DotsSix";
import { LinkSimpleHorizontalIcon } from "@phosphor-icons/react/LinkSimpleHorizontal";
import { MinusIcon } from "@phosphor-icons/react/Minus";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { PlusSquareIcon } from "@phosphor-icons/react/PlusSquare";
import { PushPinIcon } from "@phosphor-icons/react/PushPin";
import { SidebarSimpleIcon } from "@phosphor-icons/react/SidebarSimple";
import { SquareIcon } from "@phosphor-icons/react/Square";
import { SquareSplitHorizontalIcon } from "@phosphor-icons/react/SquareSplitHorizontal";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { XIcon } from "@phosphor-icons/react/X";
import type { JaliIconProps, JaliIcons } from "./types";

/** The peek pins beside, on the right: Phosphor's sidebar, mirrored. */
const PinBeside = (p: JaliIconProps) => <SidebarSimpleIcon mirrored {...p} />;
/** The cross in an activity dot is 8px: bold, since regular would be half a pixel. */
const ActivityError = (p: JaliIconProps) => <XIcon weight="bold" {...p} />;

/** Phosphor's icons for every name Jali draws. Spread it to start a set of your own: `{ ...phosphorIcons, close }`. */
export const phosphorIcons: JaliIcons = {
  close: XIcon,
  maximise: ArrowsOutSimpleIcon,
  restore: ArrowsInSimpleIcon,
  tuck: MinusIcon,
  putBack: ArrowUUpLeftIcon,
  newTab: PlusIcon,
  more: CaretDownIcon,
  current: CheckIcon,
  fold: ArrowsInLineHorizontalIcon,
  grip: DotsSixIcon,
  follow: LinkSimpleHorizontalIcon,
  pin: PushPinIcon,
  activityError: ActivityError,
  defaultKind: SquareIcon,
  pinBeside: PinBeside,
  openFull: CornersOutIcon,
  addToTabs: StackIcon,
  singleView: SquareIcon,
  splitView: SquareSplitHorizontalIcon,
  back: ArrowUUpLeftIcon,
  reset: ArrowCounterClockwiseIcon,
  dropLeft: ArrowLeftIcon,
  dropRight: ArrowRightIcon,
  dropTop: ArrowUpIcon,
  dropBottom: ArrowDownIcon,
  dropSwap: ArrowsLeftRightIcon,
  dropTab: PlusSquareIcon,
};
