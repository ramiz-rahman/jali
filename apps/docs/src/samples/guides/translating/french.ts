import { en, type Messages } from "jali";

// A full translation is a `Messages`: leave out a key and the typecheck says which.
export const fr: Messages = {
  ...en,
  announcements: {
    ...en.announcements,
    closed: (pane) => `${pane} fermé · annulation possible`,
    // Plurals are the translation's own: a count comes in as a number.
    discarded: (count) =>
      count === 1 ? "Modifications abandonnées" : `Modifications abandonnées dans ${count} volets`,
    // Directions come in as values ("top", "left"), so the words and their order are yours.
    moved: (pane, edge) =>
      `${pane} déplacé ${{ top: "vers le haut", bottom: "vers le bas", left: "à gauche", right: "à droite" }[edge]}`,
  },
  commands: { ...en.commands, close: "Fermer le volet", focusDirection: (d) => `Volet ${d}` },
  palette: {
    label: "Commandes",
    placeholder: "Tapez une commande…",
    listLabel: "Commandes",
    empty: (query) => `Aucune commande ne correspond à « ${query} ».`,
  },
  // A message with a bold part returns its parts in order: put the bold part where French needs it.
  confirmDiscard: {
    ...en.confirmDiscard,
    title: "Abandonner les modifications ?",
    item: (pane, what, bold) => [bold(pane), " : ", what],
  },
  keys: { ...en.keys, ctrl: "Ctrl", escape: "Échap", space: "Espace" },
};
