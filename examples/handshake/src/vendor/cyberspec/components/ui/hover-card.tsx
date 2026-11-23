"use client"

import * as React from "react"
import { HoverCard as SdkHoverCard, HoverCardContent, HoverCardTrigger } from "@ui-sdk/react/hover-card"
import "#src/vendor/cyberspec/components/ui/cyber/hover-card.css"

type ContentProps = React.ComponentProps<typeof HoverCardContent>
type Tone = "signal" | "rare" | "epic" | "ok"
type Fact = { label: string; value: string }

const tones: Tone[] = ["signal", "rare", "epic", "ok"]

// The same name always gets the same portrait: its letters add up to one of
// the kit's cool colors.
const toneFor = (name: string) => tones[[...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % tones.length]

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

// A name that previews a small dossier when the pointer rests on it or
// keyboard focus stays on it: a portrait, the name, a role and two facts.
// It stays a plain link, and pressing it follows the link.
//
// The portrait is generated, never a photo: the person's initials on a
// scanline field, tinted by their name, scanned once as the card opens.
//
// - `name`, `role` and `facts` fill the dossier. Everything in it should
//   also be on the page the link goes to: touch screens never open the card.
// - `href` is where the link goes. `children` is the link's text; without
//   it, the name.
// - `tone` picks the portrait's color instead of deriving it from the name.
// - `side` and `align` place the card; `code` is the micro-print at its foot.
function HoverCard({
  name,
  role,
  facts = [],
  href,
  tone,
  side = "bottom",
  align = "start",
  code = "DOSSIER // PROTOCOL 7741-C",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkHoverCard>, "children"> & {
  name: string
  role: string
  facts?: Fact[]
  href: string
  tone?: Tone
  side?: ContentProps["side"]
  align?: ContentProps["align"]
  code?: string
  children?: React.ReactNode
}) {
  return (
    <SdkHoverCard {...props}>
      <HoverCardTrigger data-kit="hover-card-trigger" href={href}>
        {children ?? name}
      </HoverCardTrigger>
      {/* The card renders where the link is, which is usually inside a
          paragraph, so it's built from spans: nothing in it may be a block
          element. */}
      <HoverCardContent data-kit="hover-card" data-frame="br" render={<span />} side={side} align={align} sideOffset={8} collisionPadding={8}>
        <span data-kit="hover-card-portrait" data-tone={tone ?? toneFor(name)} aria-hidden>
          {initialsOf(name)}
        </span>
        <span data-kit="hover-card-id">
          <span data-kit="hover-card-name">{name}</span>
          <span data-kit="hover-card-role">{role}</span>
        </span>
        {facts.length > 0 && (
          <span data-kit="hover-card-facts">
            {facts.map((fact) => (
              <span key={fact.label} data-kit="hover-card-fact">
                <span data-kit="hover-card-fact-label">{fact.label}</span>
                <span data-kit="hover-card-fact-value">{fact.value}</span>
              </span>
            ))}
          </span>
        )}
        <span data-kit="hover-card-foot" data-micro aria-hidden>
          {code}
        </span>
      </HoverCardContent>
    </SdkHoverCard>
  )
}

export { HoverCard }
export type { Fact as HoverCardFact, Tone as HoverCardTone }
