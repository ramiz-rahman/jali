import * as React from "react"
import { Dialog as SdkDialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog"
import type { ButtonTone } from "#src/vendor/cyberspec/components/ui/button.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/dialog.css"

// A modal panel: a spined frame that tears in over a dimmed page, with its
// answers on keys below it.
//
// - `trigger` is the label of the key that opens it; leave it out and
//   control the dialog with `open` and `onOpenChange`.
// - `confirm` and `cancel` label the keys; `onConfirm` runs on confirm.
// - `children` go between the description and the keys.
// - `code` is the line of micro-print over the frame.
function Dialog({
  trigger,
  triggerTone = "secondary",
  title,
  description,
  confirm = "Confirm",
  cancel = "Cancel",
  onConfirm,
  code = "PROTOCOL 7741-C // CONFIRM",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkDialog>, "children"> & {
  trigger?: React.ReactNode
  triggerTone?: ButtonTone
  title: string
  description?: string
  confirm?: string
  cancel?: string | null
  onConfirm?: () => void
  code?: string
  children?: React.ReactNode
}) {
  return (
    <SdkDialog {...props}>
      {trigger != null && (
        <DialogTrigger data-kit="button" data-frame="notch br" data-press-flash="" data-tone={triggerTone}>
          {trigger}
        </DialogTrigger>
      )}
      <DialogBackdrop data-kit="backdrop" />
      <DialogContent data-kit="dialog">
        <span data-micro aria-hidden>
          {code}
        </span>
        <div data-kit="dialog-surface" data-frame="spine br">
          <DialogTitle data-kit="dialog-title">{title}</DialogTitle>
          {description && <DialogDescription data-kit="dialog-description">{description}</DialogDescription>}
          {children && <div data-kit="dialog-body">{children}</div>}
        </div>
        <div data-kit="actions">
          {cancel && (
            <DialogClose data-kit="button" data-frame="notch br" data-press-flash="" data-tone="secondary">
              {cancel}
            </DialogClose>
          )}
          <DialogClose data-kit="button" data-frame="notch br" data-press-flash="" data-tone="primary" onClick={onConfirm}>
            {confirm}
          </DialogClose>
        </div>
      </DialogContent>
    </SdkDialog>
  )
}

export { Dialog }
