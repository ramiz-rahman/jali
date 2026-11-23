/** What a pane says when it has nothing to show: why, and what to do. Announced, so a screen reader hears it too. */
import type { ReactNode } from "react";

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      {icon}
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
    </div>
  );
}
