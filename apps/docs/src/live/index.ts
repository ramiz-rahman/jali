/**
 * The live parts: real Jali workspaces inside docs pages (docs/DOCS-PLAN.md, "The live parts"). Pages import from
 * here. The live agent owns src/live; these signatures are the contract with the pages, change them only together.
 *
 * Each is an island (src/shell/island.tsx): the page around it is static HTML, and the part hydrates on its own when
 * it comes near the screen. Its props must be JSON (strings, numbers, booleans).
 *
 * Inside: shop/ is the example app (its data, panes and layouts), workspace/ hosts it in a figure, tree/ draws its
 * layout tree, figures/ are the parts pages use, and hero/ is the landing's hero with its tour.
 */
import { island } from "../shell/island";
import { TreeView as TreeViewPart } from "./figures/TreeView";
import { Frame as FramePart } from "./figures/Frame";
import { Spotlight as SpotlightPart } from "./figures/Spotlight";
import { QuickstartApp as QuickstartAppPart } from "./figures/Quickstart";
import { Hero as HeroPart } from "./hero/Hero";

export type { TreeViewProps } from "./figures/TreeView";
export type { FrameProps } from "./figures/Frame";
export type { SpotlightProps } from "./figures/Spotlight";
export type { QuickstartAppProps } from "./figures/Quickstart";
export type { HeroProps } from "./hero/Hero";
export { demoLayouts, type DemoLayoutId } from "./shop/layouts";

export const TreeView = island("TreeView", TreeViewPart);
export const Frame = island("Frame", FramePart);
export const Spotlight = island("Spotlight", SpotlightPart);
export const QuickstartApp = island("QuickstartApp", QuickstartAppPart);
export const Hero = island("Hero", HeroPart);
