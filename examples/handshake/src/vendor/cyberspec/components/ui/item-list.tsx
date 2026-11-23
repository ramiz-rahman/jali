import * as React from "react"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Listbox, ListboxItem, ListboxItemIndicator, type ListboxProps } from "@ui-sdk/react/listbox"
import { ChevronRight } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/item-list.css"

type ItemListItem = {
  value: string
  label: string
  meta?: string
  flag?: boolean | string
  count?: number
  disabled?: boolean
}

// A list that stays on screen, in columns: a row number, a name, a meta
// column and an alert column. The chosen row is a solid signal bar with a
// cut corner and a pointer where its number was; the row the keyboard is on
// carries the kit's highlight.
//
// - `items`: `flag` puts a yellow alert badge on a row (pass a string to say
//   why to a screen reader, "Flagged" otherwise), and `count` prints a
//   number beside it. `countLabel` says what the numbers count.
// - `compact` tightens the rows, for a side column.
// - `maxRows` caps the height at that many rows; the rest scroll.
// - Everything else goes to the SDK's Listbox: `value`, `defaultValue`,
//   `onValueChange`, `activation`, `name`, `disabled`, `controller`.
function ItemList({
  label,
  items,
  compact,
  countLabel,
  maxRows,
  ...props
}: Omit<Extract<ListboxProps<string>, { multiple?: false }>, "children" | "items" | "multiple" | "orientation"> & {
  label: string
  items: ItemListItem[]
  compact?: boolean
  countLabel?: string
  maxRows?: number
}) {
  return (
    <Field data-kit="item-list" data-compact={compact ? "" : undefined}>
      <div data-kit="item-list-head">
        <FieldLabel data-kit="label">{label}</FieldLabel>
        <span data-kit="value" aria-hidden>
          {String(items.length).padStart(2, "0")}
        </span>
      </div>
      <Listbox
        data-kit="item-list-rows"
        style={maxRows ? ({ "--item-list-max": maxRows } as React.CSSProperties) : undefined}
        {...props}
      >
        {items.map((item, index) => (
          // A row takes real focus, and shows it itself (the highlight, or a
          // dark ring inside the solid bar), so it asks for no outer ring,
          // which its cut corner would clip.
          <ListboxItem
            key={item.value}
            value={item.value}
            label={item.label}
            disabled={item.disabled}
            data-kit="item-list-row"
            data-focus-quiet=""
            data-flag={item.flag ? "" : undefined}
          >
            <span data-kit="item-list-lead" aria-hidden>
              <span data-kit="item-list-index">{String(index + 1).padStart(2, "0")}</span>
              <ListboxItemIndicator data-kit="item-list-pointer">
                <ChevronRight />
              </ListboxItemIndicator>
            </span>
            <span data-kit="item-list-name">{item.label}</span>
            <span data-kit="item-list-meta">{item.meta}</span>
            <span data-kit="item-list-alert">
              {item.flag && (
                <>
                  <span data-kit="item-list-flag" aria-hidden>
                    !
                  </span>
                  <span data-sr-only>{typeof item.flag === "string" ? item.flag : "Flagged"}</span>
                </>
              )}
              {item.count != null && (
                <span data-kit="item-list-count">
                  {item.count}
                  {countLabel && <span data-sr-only> {countLabel}</span>}
                </span>
              )}
            </span>
          </ListboxItem>
        ))}
      </Listbox>
    </Field>
  )
}

export { ItemList }
export type { ItemListItem }
