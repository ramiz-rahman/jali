/**
 * The parts every pane shares, so loading, empty and failed states read the same everywhere, and made-up or live
 * data says so the same way. Built on CyberSpec's Loader, Alert, Badge and Button.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { Loader } from "#src/vendor/cyberspec/components/ui/loader.tsx";

/** A pane's scrolling body. `className` names the pane ("pane-body packets"); the rest goes on the element. */
export function PaneBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={className ? `pane-body ${className}` : "pane-body"}>
      {children}
    </div>
  );
}

/** Nothing to show yet: what is missing, and what to do about it. */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children ? <div className="state-text">{children}</div> : null}
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

/** Waiting on something: says what. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="state state-loading" role="status">
      <Loader label={label} />
    </div>
  );
}

/** Something failed: what happened, and what to do. `retry` puts a button under it. */
export function Failed({
  title,
  children,
  retry,
}: {
  title: string;
  children?: ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="state state-failed">
      <Alert tone="danger" title={title}>
        {children}
      </Alert>
      {retry ? (
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Marks data the app made up, with what it is ("Generated capture"). */
export function MadeUp({ children = "Made up" }: { children?: ReactNode }) {
  return (
    <Badge tone="mute" title="Made up for the example: not recorded from a real network">
      {children}
    </Badge>
  );
}

/** Marks data measured live, with where from ("Live · Cloudflare"). */
export function Live({ children }: { children: ReactNode }) {
  return <Badge tone="signal">{children}</Badge>;
}
