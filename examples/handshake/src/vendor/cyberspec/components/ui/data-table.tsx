import * as React from "react"
import { CheckboxGroup } from "@ui-sdk/react/checkbox"
import { ArrowDown, ArrowUp, ChevronsUpDown, Ellipsis } from "lucide-react"
import { Checkbox } from "#src/vendor/cyberspec/components/ui/checkbox.tsx"
import { Menu, type MenuEntry } from "#src/vendor/cyberspec/components/ui/menu.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/data-table.css"

type DataTableColumn<Row> = {
  id: string
  header: string
  /** What the cell shows: text, a Badge, a number written out. */
  cell: (row: Row) => React.ReactNode
  /** What the column orders by. Giving one makes its heading a sort key. */
  sort?: (row: Row) => string | number
  /** Figures: set in the mono, in the signal color, against the trailing edge. */
  numeric?: boolean
  /** The column that names the row. Its cells are row headers. */
  rowHeader?: boolean
}

type DataTableSort = { column: string; direction: "ascending" | "descending" }

const order = (a: string | number, b: string | number) =>
  typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      })

// A ledger: a real table in a cut frame, with rows that can be picked,
// ordered and acted on.
//
// - `caption` names the table. `code` is micro-print beside it.
// - `columns` say what each cell shows (see DataTableColumn). `rows` are
//   your records; each needs a unique `id`. `rowLabel` says what a row is
//   called, which names its checkbox and its menu.
// - Selection is a list of row ids: `selected` / `defaultSelected` /
//   `onSelectedChange`. The box in the heading takes or clears every row,
//   and shows a bar while only some are taken.
// - `defaultSort` orders the rows at first; pressing a sortable heading
//   orders by it, and again reverses it. `onSortChange` reports it.
// - `actions` is a menu for each row, as data (see MenuEntry), or a
//   function of the row; `onAction` runs with the action's value and the
//   row.
// - `maxHeight` caps the table; the rows scroll under the headings.
//
// A picked row is lit, its ink brightens, and its box is ticked. Too wide
// for its column, the table scrolls sideways inside the frame, and the
// scrolling part becomes a named tab stop so the arrow keys can move it.
// The rest goes to ui-sdk's CheckboxGroup: `disabled`, `name`, `controller`.
function DataTable<Row extends { id: string }>({
  caption,
  code,
  columns,
  rows,
  rowLabel,
  selected,
  defaultSelected,
  onSelectedChange,
  defaultSort,
  onSortChange,
  actions,
  onAction,
  maxHeight,
  style,
  ...props
}: Omit<
  React.ComponentProps<typeof CheckboxGroup<string>>,
  "children" | "value" | "defaultValue" | "onValueChange" | "allValues" | "style"
> & {
  caption: string
  code?: string
  columns: DataTableColumn<Row>[]
  rows: Row[]
  rowLabel: (row: Row) => string
  selected?: string[]
  defaultSelected?: string[]
  onSelectedChange?: (selected: string[]) => void
  defaultSort?: DataTableSort
  onSortChange?: (sort: DataTableSort) => void
  actions?: MenuEntry[] | ((row: Row) => MenuEntry[])
  onAction?: (action: string, row: Row) => void
  maxHeight?: number | string
  style?: React.CSSProperties
}) {
  const titleId = React.useId()
  const [picked, setPicked] = React.useState(defaultSelected ?? [])
  const [sort, setSort] = React.useState<DataTableSort | undefined>(defaultSort)
  const value = selected ?? picked
  const lit = new Set(value)
  const count = rows.reduce((n, row) => n + (lit.has(row.id) ? 1 : 0), 0)

  const by = columns.find((column) => column.id === sort?.column)?.sort
  const ordered = React.useMemo(() => {
    if (!by || !sort) return rows
    const turn = sort.direction === "ascending" ? 1 : -1
    return [...rows].sort((a, b) => turn * order(by(a), by(b)))
  }, [rows, by, sort])

  // The scrolling part is a tab stop, and a region, only while there's
  // something to scroll: otherwise it would be a stop that does nothing.
  // `more` names the sides ("start", "end") with columns still out of view,
  // which the frame marks.
  const scroller = React.useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = React.useState(false)
  const [more, setMore] = React.useState("")
  React.useEffect(() => {
    const element = scroller.current
    if (!element) return
    const measure = () => {
      const over = element.scrollWidth - element.clientWidth
      // Negative in a right-to-left page; the distance is what matters.
      const gone = Math.abs(element.scrollLeft)
      setScrolls(over > 0 || element.scrollHeight > element.clientHeight)
      setMore([gone > 1 && "start", gone < over - 1 && "end"].filter(Boolean).join(" "))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    element.addEventListener("scroll", measure, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener("scroll", measure)
    }
  }, [])

  const size = {
    "--data-table-max": typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
    ...style,
  } as React.CSSProperties

  return (
    <CheckboxGroup<string>
      data-kit="data-table"
      data-frame="tr bl"
      aria-labelledby={titleId}
      style={size}
      {...props}
      value={value}
      allValues={rows.map((row) => row.id)}
      onValueChange={(next) => {
        setPicked(next)
        onSelectedChange?.(next)
      }}
    >
      <div data-kit="data-table-view" data-more={more || undefined}>
        {/* The frame would cut an outer ring off, so the view draws the
          scroller's focus inside itself and the scroller keeps quiet. */}
        <div
          data-kit="data-table-scroller"
          data-focus-quiet=""
          ref={scroller}
          role={scrolls ? "region" : undefined}
          aria-labelledby={scrolls ? titleId : undefined}
          tabIndex={scrolls ? 0 : undefined}
        >
          <table data-kit="data-table-grid">
            <caption data-kit="data-table-caption">
              <span data-kit="data-table-caption-bar">
                <span data-kit="data-table-title" id={titleId}>
                  {caption}
                </span>
                {code && (
                  <span data-micro aria-hidden>
                    {code}
                  </span>
                )}
              </span>
            </caption>
            <thead>
              <tr>
                <th scope="col" data-kit="data-table-head" data-col="select" onClick={pressBox}>
                  <Box>
                    <Checkbox parent label={`Select all in ${caption}`} />
                  </Box>
                </th>
                {columns.map((column) => {
                  const direction = sort?.column === column.id ? sort.direction : undefined
                  const Glyph = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ChevronsUpDown
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      data-kit="data-table-head"
                      data-numeric={column.numeric ? "" : undefined}
                      aria-sort={direction}
                    >
                      {column.sort ? (
                        <button
                          type="button"
                          data-kit="data-table-sort"
                          data-sorted={direction}
                          onClick={() => {
                            const next: DataTableSort = {
                              column: column.id,
                              direction: direction === "ascending" ? "descending" : "ascending",
                            }
                            setSort(next)
                            onSortChange?.(next)
                          }}
                        >
                          {column.header}
                          <Glyph data-kit="data-table-sort-glyph" aria-hidden />
                        </button>
                      ) : (
                        <span data-kit="data-table-heading">{column.header}</span>
                      )}
                    </th>
                  )
                })}
                {actions && (
                  <th scope="col" data-kit="data-table-head" data-col="actions">
                    <span data-sr-only>Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const name = rowLabel(row)
                return (
                  <tr key={row.id} data-kit="data-table-row" data-selected={lit.has(row.id) ? "" : undefined}>
                    <td data-kit="data-table-cell" data-col="select" onClick={pressBox}>
                      <Box>
                        <Checkbox value={row.id} label={`Select ${name}`} />
                      </Box>
                    </td>
                    {columns.map((column) => {
                      const Cell = column.rowHeader ? "th" : "td"
                      return (
                        <Cell
                          key={column.id}
                          scope={column.rowHeader ? "row" : undefined}
                          data-kit="data-table-cell"
                          data-numeric={column.numeric ? "" : undefined}
                          data-name={column.rowHeader ? "" : undefined}
                        >
                          {column.cell(row)}
                        </Cell>
                      )
                    })}
                    {actions && (
                      <td data-kit="data-table-cell" data-col="actions">
                        <Menu
                          label={`Actions for ${name}`}
                          items={typeof actions === "function" ? actions(row) : actions}
                          icon={<Ellipsis aria-hidden />}
                          compact
                          tone="ghost"
                          size="sm"
                          align="end"
                          onAction={(action) => onAction?.(action, row)}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <span data-kit="data-table-edge" data-edge="start" aria-hidden />
        <span data-kit="data-table-edge" data-edge="end" aria-hidden />
      </div>
      <p data-kit="data-table-foot" role="status">
        <span data-kit="data-table-count" data-none={count === 0 ? "" : undefined}>
          {count}
        </span>{" "}
        of {rows.length} selected
      </p>
    </CheckboxGroup>
  )
}

// The kit's Checkbox prints its label beside the box. In a table the label
// is still the box's name, but there's no room to print it: this is a
// window the size of the box, and the label sits outside it.
function Box({ children }: { children: React.ReactNode }) {
  return (
    <span data-kit="data-table-box">
      <span data-kit="data-table-box-row">{children}</span>
    </span>
  )
}

// A pointer anywhere in the selection cell presses its box, so the target
// is the cell rather than the 18px box. The keyboard and assistive
// technology already have the box itself.
function pressBox(event: React.MouseEvent<HTMLTableCellElement>) {
  if (event.target !== event.currentTarget) return
  event.currentTarget.querySelector<HTMLElement>('[role="checkbox"]')?.click()
}

export { DataTable }
export type { DataTableColumn, DataTableSort }
