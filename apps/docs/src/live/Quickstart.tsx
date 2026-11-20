/**
 * The quickstart's own app, running: the `note` kind with its "Open the next note beside" button and two notes in a
 * row, as the Quickstart page builds it (samples/concepts/quickstart). On the Quickstart page, as what the reader is
 * building, and on the landing, beside its code.
 */
import { LandingWorkspace, useLandingApp } from "../shell/landing/NotesWorkspace";

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
  const app = useLandingApp({ app: "quickstart" });
  const workspace = <LandingWorkspace app={app} height={height} label={label} />;
  if (!caption) return workspace;
  return (
    <figure className="live-figure" data-live="quickstart">
      {workspace}
      <figcaption className="live-caption">{caption}</figcaption>
    </figure>
  );
}
