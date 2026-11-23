async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // A denied clipboard permission can still allow a user-initiated copy.
  }

  const active = document.activeElement
  const selection = document.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : []
  const field = document.createElement("textarea")
  field.value = text
  field.readOnly = true
  field.tabIndex = -1
  field.style.cssText = "position:fixed;inset:0 auto auto 0;width:1px;height:1px;opacity:0;font-size:16px;"
  document.body.append(field)
  try {
    field.select()
    field.setSelectionRange(0, text.length)
    if (!document.execCommand("copy")) throw new Error("Clipboard access is unavailable")
  } finally {
    field.remove()
    if (active instanceof HTMLElement && active.isConnected) active.focus({ preventScroll: true })
    selection?.removeAllRanges()
    for (const range of ranges) {
      if (range.commonAncestorContainer.isConnected) selection?.addRange(range)
    }
  }
}

export { copyText }
