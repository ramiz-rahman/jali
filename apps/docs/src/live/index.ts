/**
 * The live parts: real Jali workspaces inside docs pages (docs/DOCS-PLAN.md, "The live parts"). Pages import from
 * here. The live agent owns src/live; these signatures are the contract with the pages, change them only together.
 *
 * Each is an island (src/shell/island.tsx): the page around it is static HTML, and the part hydrates on its own when
 * it comes near the screen. Its props must be JSON (strings, numbers, booleans).
 */
import { island } from "../shell/island";
import { TreeView as TreeViewPart } from "./TreeView";
import { Frame as FramePart } from "./Frame";
import { Spotlight as SpotlightPart } from "./Spotlight";
import { QuickstartApp as QuickstartAppPart } from "./Quickstart";

export type { TreeViewProps } from "./TreeView";
export type { FrameProps } from "./Frame";
export type { SpotlightProps } from "./Spotlight";
export type { QuickstartAppProps } from "./Quickstart";
export { demoLayouts, type DemoLayoutId } from "./demo";

export const TreeView = island("TreeView", TreeViewPart);
export const Frame = island("Frame", FramePart);
export const Spotlight = island("Spotlight", SpotlightPart);
export const QuickstartApp = island("QuickstartApp", QuickstartAppPart);
