/** DOM ids for a pane, prefixed with the workspace's id so two workspaces on one page never share an id. */
export const paneDomId = (scope: string, id: string) => `${scope}-pane-${id}`;
export const paneTitleId = (scope: string, id: string) => `${scope}-pane-${id}-title`;

/**
 * `value` as a quoted CSS string, for an attribute selector: `[data-tab=${cssString(id)}]`. Any text is safe in it (a
 * quote, a bracket, a backslash, a line break), so an id never breaks or widens a selector. It needs no `CSS.escape`,
 * so it works the same in a browser, jsdom and a server render.
 */
export const cssString = (value: string): string =>
  `"${String(value)
    .replace(/[\\"]/g, "\\$&")
    .replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`;
