/** The button that collapses the queue or the header, and expands it again: one for both, so they read the same. */
import { CaretDownIcon, CaretUpIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import { IconButton, useJaliShortcut } from "jali/react";
import { QUEUE_COMMAND, toggleHeader, toggleQueue } from "./chrome";

const PARTS = {
  header: {
    noun: "the header",
    toggle: toggleHeader,
    command: undefined,
    open: <CaretUpIcon size={14} weight="bold" aria-hidden />,
    collapsed: <CaretDownIcon size={14} weight="bold" aria-hidden />,
  },
  queue: {
    noun: "the queue",
    toggle: toggleQueue,
    command: QUEUE_COMMAND,
    open: <SidebarSimpleIcon size={16} aria-hidden />,
    collapsed: <SidebarSimpleIcon size={16} aria-hidden />,
  },
};

export function CollapseToggle({
  part,
  collapsed,
  className,
}: {
  part: keyof typeof PARTS;
  collapsed: boolean;
  className: string;
}) {
  const { noun, toggle, command, open, collapsed: icon } = PARTS[part];
  const keys = useJaliShortcut(command ?? "");
  const hint = keys && ` · ${keys}`;
  const verb = collapsed ? "Expand" : "Collapse";
  return (
    <IconButton
      className={className}
      label={`${verb} ${noun}`}
      title={hint ? `${verb} ${noun}${hint}` : undefined}
      aria-expanded={!collapsed}
      onClick={toggle}
    >
      {collapsed ? icon : open}
    </IconButton>
  );
}
