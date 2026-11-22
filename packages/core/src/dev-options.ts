/**
 * Development only: options Jali doesn't know. An option built at run time (a script, a config read from JSON) gets
 * past the types, and an unknown key is otherwise ignored, so a renamed option silently falls back to its default.
 * `createJali`, `definePane` and `definePage` call `warnUnknown` inside their `process.env.NODE_ENV` test, so a
 * production build drops the call, these lists and their words (`tooling/size.mjs` checks this file never ships).
 */

/** Options removed or renamed since 3a, and where each went. */
const MOVED: Record<string, Record<string, string>> = {
  createJali: {
    keys: 'keys moved to keyboard.scope ("page", or "local" for "scoped")',
    keymap: "keymap moved to keyboard.keymap",
    keyPrefix: "keyPrefix moved to keyboard.prefix",
    reservedKeys: "reservedKeys moved to keyboard.reserved",
    keymapOptions:
      "keymapOptions moved to keyboard (keyboard.platform, keyboard.onInvalid, keyboard.words)",
    palette:
      'palette is a feature: features: [palette()] from "jali/palette" (leave it out for palette: false)',
    rename: 'rename is a feature: features: [rename({ can, run })] from "jali/rename"',
    url: 'url is a feature: features: [urlSync({ location, prefix, sizes })] from "jali/url" (url takes only a writer of your own)',
  },
  definePane: {
    minWidth: "minWidth moved to width: { min }",
    maxWidth: "maxWidth moved to width: { max }",
    comfortableWidth: "comfortableWidth moved to width: { comfortable }",
    minHeight: "minHeight moved to height: { min }",
    maxHeight: "maxHeight moved to height: { max }",
    comfortableHeight: "comfortableHeight moved to height: { comfortable }",
  },
  definePage: {},
};

/** Message areas and keys renamed in 3c (`createJali({ messages })`), and their new names. */
const MOVED_MESSAGES: Record<string, string> = {
  workspace: "panes",
  "announcements.singleOn": "announcements.onePaneOn",
  "announcements.singleOff": "announcements.onePaneOff",
  "announcements.notInvestigating": "announcements.nothingOpened",
  "page.investigation": "page.openedLabel",
  "page.investigating": "page.openedCount",
};

/** Every option each one takes. */
const KNOWN: Record<string, readonly string[]> = {
  createJali: [
    "panes",
    "layout",
    "presets",
    "preset",
    "launcher",
    "page",
    "linkMode",
    "name",
    "url",
    "storage",
    "id",
    "pageTheme",
    "commands",
    "keyboard",
    "features",
    "dir",
    "landmark",
    "label",
    "gap",
    "inset",
    "size",
    "moveFocus",
    "onUnstable",
    "beforeClose",
    "confirmDiscard",
    "tabMenu",
    "phone",
    "allow",
    "buttons",
    "settings",
    "messages",
    "onPaneError",
  ],
  definePane: [
    "kind",
    "params",
    "title",
    "width",
    "height",
    "shows",
    "identity",
    "scratch",
    "inRecent",
    "holdWhileResizing",
    "follow",
    "selects",
    "allow",
    "buttons",
    "phone",
    "transient",
    "icon",
    "Component",
    "Loading",
    "Missing",
  ],
  definePage: [
    "id",
    "name",
    "itemNoun",
    "viewers",
    "roles",
    "home",
    "build",
    "bind",
    "firstItem",
    "Rail",
    "Header",
  ],
};

const said = new Set<string>();

/** Warns once (per call site and option) about each option `what` doesn't take, naming its replacement if it moved. */
export function warnUnknown(
  what: "createJali" | "definePane" | "definePage",
  options: object | null | undefined,
  allowed: (key: string, value: unknown) => boolean = () => false,
): void {
  if (!options) return;
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (allowed(key, value)) continue;
    if (what === "createJali" && key === "messages" && value && typeof value === "object") {
      warnMessages(value as Record<string, unknown>);
      continue;
    }
    const moved = MOVED[what]![key];
    if (!moved && KNOWN[what]!.includes(key)) continue;
    const id = `${what}.${key}`;
    if (said.has(id)) continue;
    said.add(id);
    console.warn(
      `Jali: ${what} has no option "${key}"${moved ? `: ${moved}` : ", and ignores it"}`,
    );
  }
}

/** `createJali({ messages })`: warns once about each area or key that was renamed, naming the new one. */
function warnMessages(messages: Record<string, unknown>): void {
  const names = Object.entries(messages).flatMap(([area, words]) => [
    area,
    ...(words && typeof words === "object" ? Object.keys(words).map((k) => `${area}.${k}`) : []),
  ]);
  for (const name of names) {
    const to = MOVED_MESSAGES[name];
    const id = `createJali.messages.${name}`;
    if (!to || said.has(id)) continue;
    said.add(id);
    console.warn(`Jali: createJali has no option "messages.${name}": moved to messages.${to}`);
  }
}
