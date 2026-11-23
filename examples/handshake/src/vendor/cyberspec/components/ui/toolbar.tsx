import * as React from "react"
import { ToggleGroup as SdkToggleGroup } from "@ui-sdk/react/toggle"
import { Toolbar as SdkToolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { Toggle } from "#src/vendor/cyberspec/components/ui/toggle.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/toolbar.css"

// What a toolbar holds, as data:
//
// - a key:        { label, icon?, onPress?, disabled?, confirm? }
// - a latch:      { type: "toggle", label, icon?, pressed? | defaultPressed?, onPressedChange?, disabled? }
// - one of a set: { type: "choice", label, options, value? | defaultValue?, onValueChange? }
// - a rule:       { type: "separator" }
//
// A cell with an `icon` shows only that, and its `label` is its name;
// without one it shows the label.
type ToolbarEntry =
  | {
      type?: "button"
      label: string
      icon?: React.ReactNode
      /** Return a Promise to keep the key pending until it settles. */
      onPress?: () => void | Promise<unknown>
      disabled?: boolean
      /** A sentence saying what it does. An agent has to ask a person before pressing it. */
      confirm?: string
    }
  | {
      type: "toggle"
      label: string
      icon?: React.ReactNode
      pressed?: boolean
      defaultPressed?: boolean
      onPressedChange?: (pressed: boolean) => void
      disabled?: boolean
    }
  | {
      type: "choice"
      /** Names the set, like "Tool". */
      label: string
      options: { value: string; label: string; icon?: React.ReactNode; disabled?: boolean }[]
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
    }
  | { type: "separator" }

type Cell = Exclude<ToolbarEntry, { type: "separator" } | { type: "choice" }>
type Choice = Extract<ToolbarEntry, { type: "choice" }>
type Section = { kind: "run"; cells: Cell[] } | { kind: "choice"; choice: Choice } | { kind: "separator" }

// Neighbouring keys and latches join into one strip. A choice is a strip of
// its own, and a separator ends one.
function sections(items: ToolbarEntry[]): Section[] {
  const out: Section[] = []
  for (const item of items) {
    if (item.type === "separator") out.push({ kind: "separator" })
    else if (item.type === "choice") out.push({ kind: "choice", choice: item })
    else {
      const last = out[out.length - 1]
      if (last?.kind === "run") last.cells.push(item)
      else out.push({ kind: "run", cells: [item] })
    }
  }
  return out
}

// The cuts of a strip sit on its far side: under a row, and at the two ends
// of a column.
function frameAt(index: number, count: number, vertical: boolean) {
  if (count === 1) return "br"
  if (index === 0) return vertical ? "tl" : "bl"
  return index === count - 1 ? "br" : "mid"
}

// The name of the control an event came from, as a person would say it.
function nameOf(target: EventTarget | null) {
  const control = target instanceof Element ? target.closest<HTMLElement>("button, a") : null
  return control ? (control.getAttribute("aria-label") ?? control.textContent ?? "").trim() || null : null
}

// The tools of an editor in one bar: keys, latches and sets of either, with
// rules between them. Tab stops on it once; the arrow keys move along it,
// Home and End jump to its ends, and Space or Enter presses.
//
// Its cells are mostly icons, so the bar ends in a readout that prints the
// name of whichever one the pointer or the keyboard is on, and the bar's own
// `label` the rest of the time. (It's decoration: every cell carries its
// name for assistive technology.) A vertical bar has no room for one.
//
// The rest goes to ui-sdk's Toolbar: `orientation`, `loop`, `disabled`,
// `controller`.
function Toolbar({
  label,
  items,
  orientation,
  ...props
}: Omit<React.ComponentProps<typeof SdkToolbar>, "children"> & {
  label: string
  items: ToolbarEntry[]
}) {
  const vertical = orientation === "vertical"
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [focused, setFocused] = React.useState<string | null>(null)
  const name = hovered ?? focused

  return (
    <SdkToolbar
      data-kit="toolbar"
      data-frame="br"
      aria-label={label}
      orientation={orientation}
      onPointerOver={(event) => setHovered(nameOf(event.target))}
      onPointerLeave={() => setHovered(null)}
      onFocus={(event) => setFocused(nameOf(event.target))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null)
      }}
      {...props}
    >
      {sections(items).map((section, at) => {
        if (section.kind === "separator") return <ToolbarSeparator key={at} data-kit="toolbar-separator" />
        if (section.kind === "choice") {
          const { choice } = section
          return (
            <SdkToggleGroup
              key={at}
              data-kit="toolbar-run"
              aria-label={choice.label}
              orientation={orientation}
              // A tool is always chosen: pressing the current one keeps it.
              deselectable={false}
              value={choice.value === undefined ? undefined : [choice.value]}
              defaultValue={choice.defaultValue === undefined ? undefined : [choice.defaultValue]}
              onValueChange={([value]) => {
                if (value !== undefined) choice.onValueChange?.(value)
              }}
            >
              {choice.options.map((option, index) => (
                <Toggle
                  key={option.value}
                  value={option.value}
                  icon={option.icon}
                  disabled={option.disabled}
                  aria-label={option.icon != null ? option.label : undefined}
                  data-frame={frameAt(index, choice.options.length, vertical)}
                  data-joined=""
                >
                  {option.icon != null ? undefined : option.label}
                </Toggle>
              ))}
            </SdkToggleGroup>
          )
        }
        return (
          <div key={at} data-kit="toolbar-run">
            {section.cells.map((cell, index) => {
              const frame = frameAt(index, section.cells.length, vertical)
              const named = cell.icon != null ? cell.label : undefined
              return cell.type === "toggle" ? (
                <Toggle
                  key={index}
                  icon={cell.icon}
                  pressed={cell.pressed}
                  defaultPressed={cell.defaultPressed}
                  onPressedChange={cell.onPressedChange}
                  disabled={cell.disabled}
                  aria-label={named}
                  data-frame={frame}
                  data-joined=""
                >
                  {cell.icon != null ? undefined : cell.label}
                </Toggle>
              ) : (
                <ToolbarButton
                  key={index}
                  data-kit="button"
                  data-frame={frame}
                  data-press-flash=""
                  data-tone="secondary"
                  data-icon={cell.icon != null ? "" : undefined}
                  data-agent-confirm={cell.confirm}
                  aria-label={named}
                  disabled={cell.disabled}
                  onClick={() => cell.onPress?.()}
                >
                  {cell.icon ?? cell.label}
                </ToolbarButton>
              )
            })}
          </div>
        )
      })}
      {!vertical && (
        <span data-kit="toolbar-readout" data-idle={name == null ? "" : undefined} aria-hidden>
          {name ?? label}
        </span>
      )}
    </SdkToolbar>
  )
}

export { Toolbar }
export type { ToolbarEntry }
