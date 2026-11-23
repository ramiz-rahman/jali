"use client"

import * as React from "react"
import { Timeline, TimelineConnector, TimelineDescription, TimelineItem, TimelineMarker, TimelineTime, TimelineTitle } from "@ui-sdk/react/timeline"
import "#src/vendor/cyberspec/components/ui/cyber/feed.css"

type Tone = "default" | "signal" | "flag"

type FeedItem = {
  id: string
  // The time as it's printed ("21:04"), and optionally in a form a machine
  // can read ("2077-03-14T21:04").
  time: string
  dateTime?: string
  actor: string
  text: React.ReactNode
  tone?: Tone
}

// What a tone says to a screen reader, since a marker's shape and color
// say it only to the eye.
const toneWords: Record<Tone, string | undefined> = { default: undefined, signal: "Agent", flag: "Alert" }

// An activity log: events in the order they happened, each with its time in
// the margin, a marker on a rule running down the page, who did it and what
// they did. It's one tab stop; the arrow keys, Home and End move between
// entries.
//
// - `label` names the log ("Job activity").
// - `items`: `{ id, time, actor, text, tone? }`, oldest first. A tone changes
//   the marker's shape as well as its color: "default" is a hollow square,
//   "signal" a solid cyan diamond for something an agent did, "flag" a
//   yellow warning triangle for an alert.
// - `live`: the log is still being written. The rule runs on past the last
//   entry as a dashed line, and that entry's marker breathes.
function Feed({
  label,
  items,
  live,
  ...props
}: Omit<React.ComponentProps<typeof Timeline>, "children" | "aria-label"> & {
  label: string
  items: FeedItem[]
  live?: boolean
}) {
  return (
    <Timeline data-kit="feed" data-live={live ? "" : undefined} aria-label={label} {...props}>
      {items.map((item) => {
        const tone = item.tone ?? "default"
        const word = toneWords[tone]
        return (
          <TimelineItem key={item.id} value={item.id} data-kit="feed-item" data-tone={tone}>
            <TimelineTime data-kit="feed-time" dateTime={item.dateTime}>
              {item.time}
            </TimelineTime>
            <TimelineMarker data-kit="feed-marker" />
            <TimelineConnector data-kit="feed-connector" />
            <TimelineTitle data-kit="feed-actor">
              {item.actor}
              {word && <span data-sr-only>, {word}</span>}
            </TimelineTitle>
            <TimelineDescription data-kit="feed-text">{item.text}</TimelineDescription>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}

export { Feed }
export type { FeedItem, Tone as FeedTone }
