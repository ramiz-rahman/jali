/**
 * The live parts: real Jali workspaces inside docs pages (docs/DOCS-PLAN.md, "The live parts"). Pages import from
 * here. The live agent owns src/live; these signatures are the contract with the pages, change them only together.
 */
export { TreeView, type TreeViewProps } from "./TreeView";
export { Frame, type FrameProps } from "./Frame";
export { Spotlight, type SpotlightProps } from "./Spotlight";
export { demoLayouts, type DemoLayoutId } from "./demo";
