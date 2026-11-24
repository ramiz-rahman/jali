/** A note beside the text: `<Callout type="note|tip|warning" title>`. */
import type { ReactNode } from "react";
import { InfoIcon, LightbulbIcon, WarningIcon } from "@phosphor-icons/react";

export type CalloutType = "note" | "tip" | "warning";

/** Each type's icon, and the word it is named by when it has no title (the Markdown copies use the word too). */
export const CALLOUTS: Record<CalloutType, { Icon: typeof InfoIcon; label: string }> = {
  note: { Icon: InfoIcon, label: "Note" },
  tip: { Icon: LightbulbIcon, label: "Tip" },
  warning: { Icon: WarningIcon, label: "Warning" },
};

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children?: ReactNode;
}) {
  const { Icon, label } = CALLOUTS[type] ?? CALLOUTS.note;
  return (
    <aside className="callout" data-callout={type} aria-label={title ? undefined : label}>
      <Icon aria-hidden className="callout-icon" size={17} />
      <div className="callout-body">
        {title ? <p className="callout-title">{title}</p> : null}
        {children}
      </div>
    </aside>
  );
}
