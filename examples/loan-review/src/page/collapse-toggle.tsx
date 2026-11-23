/** The button that collapses the queue or the header, and expands it again: one for both, so they read the same. */
import { CaretDownIcon, CaretUpIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import { IconButton } from "jali/react";
import { KEYS, toggleHeader, toggleQueue } from "./chrome";

const PARTS = {
  header: {
    noun: "the header",
    toggle: toggleHeader,
    hint: "",
    open: <CaretUpIcon size={14} weight="bold" aria-hidden />,
    collapsed: <CaretDownIcon size={14} weight="bold" aria-hidden />,
  },
  queue: {
    noun: "the queue",
    toggle: toggleQueue,
    hint: ` · ${KEYS.queue}`,
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
  const { noun, toggle, hint, open, collapsed: icon } = PARTS[part];
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
