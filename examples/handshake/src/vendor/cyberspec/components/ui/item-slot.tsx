import * as React from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"
import { Plus } from "lucide-react"
import { playCipherEdge } from "#src/vendor/cyberspec/lib/cipher.ts"
import "#src/vendor/cyberspec/components/ui/cyber/item-slot.css"

type Rarity = "common" | "rare" | "epic" | "legend"

const rarityWord: Record<Rarity, string> = { common: "common", rare: "rare", epic: "epic", legend: "legendary" }

// A gear slot: a square cut tile holding one item's artwork, with what's
// known about it printed around the edges.
//
// - `label` names the item, or the slot when it's empty ("Sidearm"). The
//   tile shows only artwork, so everything on it is spoken from the label:
//   "Kestrel KR-9 carbine, rare, 2 of 3 mods fitted, equipped".
// - `rarity` colors the spine down the leading edge.
// - `mods`: up to four sockets, true for a fitted one. Solid pips are
//   fitted, hollow ones are free.
// - `count` prints a quantity; `isNew` flags it; `equipped` draws the
//   stripe across the cut corner.
// - `selected` presses it: the fill lights and brackets close on three
//   corners.
// - `cipher` briefly splits the frame and rarity spine when the slot becomes selected.
// - `children` are the artwork, drawn in `currentColor`. With none, the
//   slot is empty and shows a "+".
function ItemSlot({
  label,
  rarity = "common",
  count,
  mods,
  isNew,
  equipped,
  selected = false,
  cipher = false,
  size = "md",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkButton>, "children"> & {
  label: string
  rarity?: Rarity
  count?: number
  mods?: boolean[]
  isNew?: boolean
  equipped?: boolean
  selected?: boolean
  cipher?: boolean
  size?: "md" | "lg"
  children?: React.ReactNode
}) {
  const brackets = React.useRef<HTMLSpanElement>(null)
  const wasSelected = React.useRef(selected)
  React.useLayoutEffect(() => {
    const justSelected = selected && !wasSelected.current
    wasSelected.current = selected
    if (!cipher || !justSelected) return
    const tile = brackets.current?.closest<HTMLElement>('[data-kit="item-slot"]')
    if (tile) return playCipherEdge(tile)
  }, [cipher, selected])

  const empty = children == null || children === false
  const sockets = mods?.slice(0, 4)
  const spoken = empty
    ? `${label}, empty`
    : [
        label,
        rarityWord[rarity],
        count != null && `quantity ${count}`,
        sockets?.length && `${sockets.filter(Boolean).length} of ${sockets.length} mods fitted`,
        equipped && "equipped",
        isNew && "new",
      ]
        .filter(Boolean)
        .join(", ")

  return (
    <SdkButton
      data-kit="item-slot"
      data-frame="br"
      data-press-flash=""
      data-cipher={cipher ? "" : undefined}
      data-rarity={empty ? undefined : rarity}
      data-empty={empty ? "" : undefined}
      data-size={size}
      aria-pressed={selected}
      aria-label={spoken}
      {...props}
    >
      {empty ? (
        <Plus data-kit="item-slot-plus" aria-hidden />
      ) : (
        <>
          <span data-kit="item-slot-spine" aria-hidden />
          <span data-kit="item-slot-art" aria-hidden>
            {children}
          </span>
          {sockets && sockets.length > 0 && (
            <span data-kit="item-slot-mods" aria-hidden>
              {sockets.map((fitted, index) => (
                <span key={index} data-fitted={fitted ? "" : undefined} />
              ))}
            </span>
          )}
          {count != null && (
            <span data-kit="item-slot-count" aria-hidden>
              {count > 99 ? "99+" : count}
            </span>
          )}
          {isNew && (
            <span data-kit="item-slot-new" aria-hidden>
              New
            </span>
          )}
          {equipped && <span data-kit="item-slot-equipped" aria-hidden />}
        </>
      )}
      <span data-kit="item-slot-brackets" ref={brackets} aria-hidden />
    </SdkButton>
  )
}

export { ItemSlot }
export type { Rarity as ItemRarity }
