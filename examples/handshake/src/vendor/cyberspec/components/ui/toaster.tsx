import * as React from "react"
import { Check, MessageSquare, OctagonX, TriangleAlert, X } from "lucide-react"
import { OverlayHost } from "@ui-sdk/react/overlays"
import { Toast, ToastAction, ToastClose, ToastDescription, ToastTitle, toast, type ToastData, type ToastType } from "@ui-sdk/react/toast"
import { haptic, type Haptic } from "#src/vendor/cyberspec/lib/haptics.ts"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/toast.css"
import "#src/vendor/cyberspec/components/ui/cyber/toaster.css"

type Tone = "info" | "success" | "warning" | "error"

type NotifyOptions = {
  /** A sentence of detail under the title. */
  description?: string
  /** What it's about: "info" by default. */
  tone?: Tone
  /** A key in the toast that does something, like Retry. Pressing it closes the toast. */
  action?: { label: string; onAction: () => unknown }
  /** How long it stays, in ms: five seconds by default, `Infinity` until dismissed. */
  duration?: number
  /** Reuses a toast: one with this id that's still showing is updated in place. */
  id?: string
}

// What each tone sounds and feels like as it arrives. Info is only
// something appearing.
const arrival: Record<Tone, { voice: Parameters<typeof sfx>[0]; touch: Haptic }> = {
  info: { voice: "open", touch: "light" },
  success: { voice: "success", touch: "success" },
  warning: { voice: "warning", touch: "warning" },
  error: { voice: "error", touch: "error" },
}

// Raises a toast from anywhere, in a component or out of one, and returns
// its id. It needs a <Toasts /> mounted somewhere to show it.
//
//   notify("Route cleared", { tone: "success", description: "Glasswater checkpoint is behind you." })
//
// `notify.dismiss(id)` closes one toast, and `notify.dismiss()` all of them.
function raise(title: string, { tone = "info", description, action, duration, id }: NotifyOptions = {}) {
  sfx(arrival[tone].voice)
  haptic(arrival[tone].touch)
  return toast[tone](title, {
    description,
    // Left out rather than passed as undefined, so the toaster's own
    // defaults stand.
    ...(duration !== undefined && { duration }),
    ...(id !== undefined && { id }),
    ...(action && { action: { label: action.label, onAction: () => action.onAction() } }),
  })
}

const notify = Object.assign(raise, { dismiss: (id?: string) => toast.dismiss(id) })

// The glyph and the word that say what a toast is about, so its color never
// has to.
const marks: Record<ToastType, { icon: React.ReactNode; tag: string }> = {
  default: { icon: <MessageSquare aria-hidden />, tag: "MSG" },
  info: { icon: <MessageSquare aria-hidden />, tag: "INFO" },
  success: { icon: <Check aria-hidden />, tag: "OK" },
  warning: { icon: <TriangleAlert aria-hidden />, tag: "WARN" },
  error: { icon: <OctagonX aria-hidden />, tag: "ERR" },
  loading: { icon: <span data-kit="toast-busy" data-motion="essential" />, tag: "BUSY" },
}

// One toast: a solid strip in its tone's color carrying the glyph, the
// title and the close key, over a dark body with the detail and the action.
// The bar along its foot drains as its time runs out.
function Notice({ data }: { data: ToastData<React.ReactNode> }) {
  const mark = marks[data.type]
  const timed = Number.isFinite(data.duration)
  return (
    <Toast data-kit="toast">
      <div data-kit="toast-surface" data-frame="br">
        <div data-kit="toast-strip">
          <span data-kit="toast-glyph" aria-hidden>
            {mark.icon}
          </span>
          <ToastTitle data-kit="toast-title" />
          <span data-kit="toast-tag" aria-hidden>
            {mark.tag}
          </span>
          {data.dismissible !== false && (
            <ToastClose data-kit="toast-close" data-frame="" data-press-flash="" aria-label="Dismiss">
              <X aria-hidden />
            </ToastClose>
          )}
        </div>
        {(data.description != null || data.action) && (
          <div data-kit="toast-body">
            <ToastDescription data-kit="toast-description" />
            <ToastAction data-kit="button" data-frame="notch br" data-press-flash="" data-tone="secondary" data-size="sm" />
          </div>
        )}
        {/* ui-sdk keeps the countdown to itself, so the bar is drawn from
            the toast's duration and paused by the stylesheet whenever the
            countdown is. A new key restarts it when the toast is updated,
            as the countdown restarts. It carries meaning, so it runs at
            every FX level. */}
        {timed && <span key={data.version} data-kit="toast-timer" data-motion="essential" style={{ "--toast-duration": `${data.duration}ms` } as React.CSSProperties} aria-hidden />}
      </div>
    </Toast>
  )
}

// Which <Toasts /> is showing the toasts. The first one mounted is; any
// other renders nothing until that one leaves, so mounting it twice (a page
// and an example on that page) never shows a toast twice.
const mounted: symbol[] = []
const watchers = new Set<() => void>()
const watch = (notice: () => void) => {
  watchers.add(notice)
  return () => {
    watchers.delete(notice)
  }
}
const announce = () => watchers.forEach((notice) => notice())

function useFirstMounted() {
  const [id] = React.useState(() => Symbol("toasts"))
  React.useEffect(() => {
    mounted.push(id)
    announce()
    return () => {
      mounted.splice(mounted.indexOf(id), 1)
      announce()
    }
  }, [id])
  return React.useSyncExternalStore(
    watch,
    () => mounted[0] === id,
    () => false,
  )
}

// ui-sdk stops its countdowns while the window or the page is away, and
// doesn't say so on the region. This does, so the drain bars stop too.
let blurred = false
const watchAway = (notice: () => void) => {
  const blur = () => {
    // Focus moving into a frame on the page isn't the window going away.
    blurred = document.activeElement?.tagName !== "IFRAME"
    notice()
  }
  const focus = () => {
    blurred = false
    notice()
  }
  window.addEventListener("blur", blur)
  window.addEventListener("focus", focus)
  document.addEventListener("visibilitychange", notice)
  return () => {
    window.removeEventListener("blur", blur)
    window.removeEventListener("focus", focus)
    document.removeEventListener("visibilitychange", notice)
  }
}
const isAway = () => blurred || document.visibilityState === "hidden"

// Where toasts appear: a column at the top trailing corner of the screen,
// newest on top, three at a time, the rest waiting their turn. Mount it
// once, inside <Cyber>, near the root; mounting it again is harmless.
//
// It renders ui-sdk's overlay host, so the SDK's own `toast()` shows here
// too, in the same dress. A toast is announced to screen readers as it
// arrives without taking focus; F6 moves focus to the newest one and back,
// Escape dismisses the focused one, and a swipe up or toward the edge
// throws one away.
//
// - `label` names the region for assistive technology.
// - `maxVisible` is how many show at once.
function Toasts({ label = "Notifications", maxVisible = 3 }: { label?: string; maxVisible?: number }) {
  const first = useFirstMounted()
  const away = React.useSyncExternalStore(watchAway, isAway, () => false)
  if (!first) return null
  // The kit's hooks for the region, which the host's typed props don't list.
  const hooks = { "data-kit": "toaster", "data-away": away ? "" : undefined }
  return (
    <OverlayHost
      toast={{
        side: "top",
        align: "end",
        // A column rather than a pile: nothing is hidden behind the newest.
        expanded: true,
        maxVisible,
        "aria-label": label,
        children: (data) => <Notice data={data} />,
        ...hooks,
      }}
    />
  )
}

export { Toasts, notify }
export type { NotifyOptions, Tone as ToastTone }
