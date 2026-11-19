/**
 * TEMPORARY comparison switch: four treatments of the pane header's buttons (tuck, maximise, close), to choose one.
 * ⌘K "Header buttons…" switches between them at runtime; the choice is remembered on this device and set as
 * `data-header-buttons` on <html>, which chrome.css reads. Remove this file, its command and the losing variants'
 * CSS once one is chosen.
 */
import { saved } from "../store";

export const HEADER_BUTTONS = [
  { id: "printed", label: "Printed glyphs", hint: "A: no cap at rest; a shallow key on hover and press" },
  { id: "wells", label: "Recessed wells", hint: "B: small flush buttons sunk into the plate" },
  { id: "strip", label: "One low strip", hint: "C: the three joined in a thin segmented strip" },
  { id: "round", label: "Round push-buttons", hint: "D: small round caps, the icon printed on them" },
] as const;
export type HeaderButtons = (typeof HEADER_BUTTONS)[number]["id"];

const KEY = "studio:header-buttons";

export function headerButtons(): HeaderButtons {
  const v = saved.read<string>(KEY, "printed");
  return HEADER_BUTTONS.some((b) => b.id === v) ? (v as HeaderButtons) : "printed";
}

export function setHeaderButtons(v: HeaderButtons) {
  saved.write(KEY, v);
  if (typeof document !== "undefined") document.documentElement.dataset.headerButtons = v;
}

/** At start-up: the remembered treatment onto the page. */
export function applyHeaderButtons() {
  if (typeof document !== "undefined") document.documentElement.dataset.headerButtons = headerButtons();
}
