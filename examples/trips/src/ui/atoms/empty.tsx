/** What a pane says when it has nothing to show: a title, and a line on what to do. */
import type { ReactNode } from "react";
import "./empty.css";

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
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  );
}
