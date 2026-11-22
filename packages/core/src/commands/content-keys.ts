const TYPING =
  'input:not([type="range"]), textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]';
const PRESSABLE =
  'button, a[href], summary, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="radio"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';
const DIALOG = 'dialog, [role="dialog"], [role="alertdialog"]';

/**
 * Whether a key event belongs to the focused content rather than to an app-wide shortcut. True when the target is a
 * text field, a contenteditable region, a combobox or search box, inside one of Jali's dialogs (or any dialog), or a
 * control that Space or Enter presses for a keyboard user (a button, link, tab, checkbox, switch, radio or menu item).
 * Use it in a window-level `keydown` handler that wants a single key such as Space, after the content has had its turn:
 *
 *   window.addEventListener("keydown", (e) => {
 *     if (e.key === " " && !e.defaultPrevented && !keyBelongsToContent(e)) togglePlayback();
 *   });
 */
export function keyBelongsToContent(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  return !!target?.closest(`${TYPING}, ${PRESSABLE}, ${DIALOG}`);
}
