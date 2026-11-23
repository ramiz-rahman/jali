import * as React from "react"
import { ariaKeyshortcuts, formatShortcut } from "@ui-sdk/core"
import {
  Menu as SdkMenu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { ButtonSize, ButtonTone } from "#src/vendor/cyberspec/components/ui/button.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/menu.css"

// A menu, as data. The shape follows ui-sdk's own MenuData, with an icon on
// actions and submenus, and `confirm` on anything a person should approve:
//
// - an action:       { value, label, icon?, shortcut?, disabled?, destructive?, confirm? }
// - a rule:          { type: "separator" }
// - a headed group:  { type: "group", label?, items }
// - a checkbox:      { type: "checkbox", value, label, defaultChecked? }
// - one of several:  { type: "radio-group", name, label?, defaultValue?, items }
// - another level:   { type: "submenu", label, icon?, items }
type MenuEntry =
  | {
      type?: "item"
      value: string
      label: string
      icon?: React.ReactNode
      /** A hint like "mod+c": shown as ⌘C or Ctrl+C. The app owns the key handler. */
      shortcut?: string
      disabled?: boolean
      /** Something that can't be taken back. Flagged in yellow, with a mark. */
      destructive?: boolean
      /** A sentence saying what it does. An agent has to ask a person before running it. */
      confirm?: string
      closeOnSelect?: boolean
    }
  | { type: "separator" }
  | { type: "group"; label?: string; items: MenuEntry[] }
  | { type: "checkbox"; value: string; label: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean }
  | {
      type: "radio-group"
      name: string
      label?: string
      value?: string | null
      defaultValue?: string | null
      items: { value: string; label: string; disabled?: boolean }[]
    }
  | { type: "submenu"; label: string; icon?: React.ReactNode; disabled?: boolean; items: MenuEntry[] }

// Whether any row at this level carries an icon or a check. If one does,
// every row gets the same leading column, so their labels line up.
const hasGutter = (items: MenuEntry[]): boolean =>
  items.some((entry) => {
    if (entry.type === "checkbox" || entry.type === "radio-group") return true
    if (entry.type === "group") return hasGutter(entry.items)
    return entry.type !== "separator" && entry.icon != null
  })

function Lead({ icon, gutter }: { icon?: React.ReactNode; gutter: boolean }) {
  if (icon != null) return <MenuItemIcon data-kit="menu-icon">{icon}</MenuItemIcon>
  return gutter ? <span data-kit="menu-icon" aria-hidden /> : null
}

// The mark in a checkable row: a block that's hollow while off and solid
// while on, like the switch's. A box for a checkbox, a diamond for a radio.
function Mark({ shape }: { shape: "box" | "diamond" }) {
  return (
    <MenuItemIndicator data-kit="popup-indicator" keepMounted>
      <span data-kit="menu-mark" data-shape={shape} aria-hidden />
    </MenuItemIndicator>
  )
}

// The rows of one level of a menu. Submenus render themselves the same way.
function MenuEntries({ items, gutter = hasGutter(items) }: { items: MenuEntry[]; gutter?: boolean }) {
  return items.map((entry, index) => {
    switch (entry.type) {
      case "separator":
        return <MenuSeparator key={index} data-kit="popup-separator" />
      case "group":
        return (
          <MenuGroup key={index} data-kit="menu-group">
            {entry.label && <MenuGroupLabel data-kit="popup-label">{entry.label}</MenuGroupLabel>}
            <MenuEntries items={entry.items} gutter={gutter} />
          </MenuGroup>
        )
      case "checkbox":
        return (
          <MenuCheckboxItem
            key={index}
            data-kit="popup-item"
            value={entry.value}
            checked={entry.checked}
            defaultChecked={entry.defaultChecked}
            disabled={entry.disabled}
          >
            <Mark shape="box" />
            {entry.label}
          </MenuCheckboxItem>
        )
      case "radio-group":
        return (
          <MenuRadioGroup key={index} data-kit="menu-group" name={entry.name} value={entry.value} defaultValue={entry.defaultValue}>
            {entry.label && <MenuGroupLabel data-kit="popup-label">{entry.label}</MenuGroupLabel>}
            {entry.items.map((option) => (
              <MenuRadioItem key={option.value} data-kit="popup-item" value={option.value} disabled={option.disabled}>
                <Mark shape="diamond" />
                {option.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        )
      case "submenu":
        return (
          <MenuSub key={index}>
            <MenuSubTrigger data-kit="popup-item" data-menu-row="sub" disabled={entry.disabled}>
              <Lead icon={entry.icon} gutter={gutter} />
              {entry.label}
              <ChevronRight data-kit="menu-more" aria-hidden />
            </MenuSubTrigger>
            <MenuSubContent data-kit="popup" data-frame="tr bl" sideOffset={10}>
              <MenuEntries items={entry.items} />
            </MenuSubContent>
          </MenuSub>
        )
      default:
        // The SDK would print the shortcut itself; it's printed here so it
        // can carry the shared popup-shortcut look. The hint is still
        // announced, through aria-keyshortcuts.
        return (
          <MenuItem
            key={index}
            data-kit="popup-item"
            data-menu-row={entry.destructive ? "destructive" : undefined}
            data-agent-confirm={entry.confirm}
            value={entry.value}
            disabled={entry.disabled}
            destructive={entry.destructive}
            closeOnSelect={entry.closeOnSelect}
            aria-keyshortcuts={entry.shortcut ? ariaKeyshortcuts(entry.shortcut) : undefined}
          >
            <Lead icon={entry.icon} gutter={gutter} />
            {entry.label}
            {entry.shortcut && <MenuShortcut data-kit="popup-shortcut">{formatShortcut(entry.shortcut)}</MenuShortcut>}
          </MenuItem>
        )
    }
  })
}

// The floating frame and its rows: what a Menu, a ContextMenu and each menu
// of a Menubar open. It goes inside an SDK Menu, beside its trigger.
function MenuPopup({
  items,
  ...props
}: Omit<React.ComponentProps<typeof MenuContent>, "children"> & { items: MenuEntry[] }) {
  return (
    <MenuContent data-kit="popup" data-frame="tr bl" align="start" sideOffset={6} {...props}>
      <MenuEntries items={items} />
    </MenuContent>
  )
}

// A key that opens a list of actions and settings.
//
// - `label` is the key's text and its name. With `compact` the key shows
//   only `icon`, and the label becomes its aria-label.
// - `items` is the menu, as data (see MenuEntry).
// - `onAction` runs for every action, with its value; `onCheckedChange` and
//   `onValueChange` report checkboxes and radio groups, as on the SDK's Menu.
//
// Checkboxes and radios keep the menu open, so several can be set in one
// visit. Shortcuts are hints: the app owns the keys.
function Menu({
  label,
  items,
  icon,
  compact,
  tone = "secondary",
  size = "md",
  disabled,
  side,
  align,
  ...props
}: Omit<React.ComponentProps<typeof SdkMenu>, "children" | "items"> & {
  label: string
  items: MenuEntry[]
  icon?: React.ReactNode
  compact?: boolean
  tone?: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  side?: React.ComponentProps<typeof MenuContent>["side"]
  align?: React.ComponentProps<typeof MenuContent>["align"]
}) {
  return (
    <SdkMenu {...props}>
      <MenuTrigger
        data-kit="button"
        data-frame={tone === "ghost" ? "br" : "notch br"}
        data-press-flash=""
        data-tone={tone}
        data-size={size}
        data-icon={compact ? "" : undefined}
        aria-label={compact ? label : undefined}
        disabled={disabled}
      >
        {icon}
        {!compact && label}
        {!compact && <ChevronDown data-kit="menu-caret" aria-hidden />}
      </MenuTrigger>
      <MenuPopup items={items} side={side} align={align} />
    </SdkMenu>
  )
}

export { Menu, MenuEntries, MenuPopup }
export type { MenuEntry }
