/**
 * The quickstart's own app, running: the `note` kind with its "Open the next note beside" button, starting from
 * note 1, as the Quickstart page builds it (samples/concepts/quickstart). On the Quickstart page, as what the reader is
 * building, and on the landing, beside its code.
 */
import { useState } from "react";
import { createJali, memoryLocation } from "jali-layout";
import { chooser } from "jali-layout/chooser";
import { palette } from "jali-layout/palette";
import { urlSync } from "jali-layout/url";
import { note } from "../../samples/concepts/quickstart/note-open-beside";
import { embedded, useEmbeddedId } from "../workspace/embedded";
import { NamedWorkspace } from "../workspace/LiveWorkspace";

export interface QuickstartAppProps {
  /** The workspace's height: pixels, or any CSS length. */
  height?: number | string;
  caption?: string;
  /** What a screen reader hears the workspace called. */
  label?: string;
}

export function QuickstartApp({
  height = 280,
  caption,
  label = "The quickstart app, running",
}: QuickstartAppProps) {
  const id = useEmbeddedId("quickstart");
  const [jali] = useState(() =>
    createJali({
      ...embedded(id),
      // As the reader's app has them; the address is kept in memory, so this page's own stays as it is.
      features: [urlSync({ location: memoryLocation() }), palette(), chooser()],
      panes: [note],
      layout: note({ id: 1 }),
      name: "Notes",
      // Its landmarks are named for it, so another workspace on the page never repeats one.
      label: "Notes app",
    }),
  );
  const workspace = <NamedWorkspace jali={jali} height={height} label={label} />;
  if (!caption) return workspace;
  return (
    <figure className="live-figure" data-live="quickstart">
      {workspace}
      <figcaption className="live-caption">{caption}</figcaption>
    </figure>
  );
}
