import type { ReactNode } from "react";
import "./panes.css";

export function Shell({ children, onKeyDown, focused, label, innerRef }: { children: ReactNode; onKeyDown?: (e: React.KeyboardEvent) => void; focused?: boolean; label?: string; innerRef?: React.Ref<HTMLDivElement> }) {
  void focused;
  return <div className="pk" ref={innerRef} tabIndex={-1} onKeyDown={onKeyDown} aria-label={label}>{children}</div>;
}
export function Loading() {
  return <div role="status" aria-label="Loading" style={{ paddingTop: 8 }}>{[80, 60, 70, 50, 65].map((w, i) => <div key={i} className="pk-skel" style={{ width: `${w}%` }} />)}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="pk-state err" role="alert"><b>Could not load this</b><span className="pk-meta">{message}</span>{onRetry && <div style={{ marginTop: 10 }}><button className="pk-btn" onClick={onRetry}>Try again</button></div>}</div>;
}
export function Gone({ what }: { what: string }) {
  return <div className="pk-state" role="status"><b>{what} no longer exists</b><span className="pk-meta">It may have been deleted or renamed. This pane keeps its place; close it or open something else.</span></div>;
}
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="pk-state"><b>{title}</b>{hint && <span className="pk-meta">{hint}</span>}</div>;
}
export function NullChip() { return <span className="pk-chip">NULL</span>; }
