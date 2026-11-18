/** DOM ids for a pane, prefixed with the workspace's id so two workspaces on one page never share an id. */
export const paneDomId = (scope: string, id: string) => `${scope}-pane-${id}`;
export const paneTitleId = (scope: string, id: string) => `${scope}-pane-${id}-title`;
