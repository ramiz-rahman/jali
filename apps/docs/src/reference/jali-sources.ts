/**
 * What the reference reads from Jali's own source rather than its public entries, in one place: the styling
 * contract (parts.ts) and the stylesheets, so the parts and tokens pages are drawn from the files themselves and can't
 * drift from them. The docs live in the same repository, so these are paths into packages/react/src. Build time only.
 */
export { ADORNMENTS, parts, type PartArea } from "../../../../packages/react/src/parts";
export { defaultIcons } from "../../../../packages/react/src/icons/default";

import theme from "../../../../packages/react/src/styles/jali-theme.css?raw";
import tailwind from "../../../../packages/react/src/styles/jali-tailwind.css?raw";
import workspace from "../../../../packages/react/src/styles/workspace.css?raw";
import pane from "../../../../packages/react/src/styles/pane.css?raw";
import dividers from "../../../../packages/react/src/styles/dividers.css?raw";
import shelf from "../../../../packages/react/src/styles/shelf.css?raw";
import chrome from "../../../../packages/react/src/styles/chrome.css?raw";
import page from "../../../../packages/react/src/styles/page.css?raw";
import dialogs from "../../../../packages/react/src/styles/dialogs.css?raw";
import follow from "../../../../packages/react/src/styles/follow.css?raw";
import icons from "../../../../packages/react/src/styles/icons.css?raw";

/** The theme (the tokens), the Tailwind bridge, and the parts' stylesheets (what reads each token). */
export const STYLES = {
  theme,
  tailwind,
  parts: { workspace, pane, dividers, shelf, chrome, page, dialogs, follow, icons },
};
