/**
 * `rename({ can, run })`: renaming a pane in place. Double-click or F2 on a tab, or on a lone pane's title, opens a
 * field there; `run(pane, text)` saves the name in your app, which then shows it (`useTitle`). Return `false`, throw
 * or reject to keep the field open. `can(pane)` says which panes may be renamed (default: all).
 *
 *   createJali({ panes, layout, features: [...defaultFeatures(), rename({ run: (p, text) => save(p.ref, text) })] });
 */
import { renameFeature, type Feature, type Rename } from "@jali/core/adapter";
import { RenameField } from "../pane/RenameField";

export const rename = (options: Rename): Feature =>
  renameFeature(options, { renameField: RenameField });
