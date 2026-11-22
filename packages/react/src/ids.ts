/**
 * The DOM ids @jali/react gives a pane's parts, each kind with a prefix of its own after the workspace's scope, so no
 * pane id can make one kind's id equal another's (panes "x" and "x-title"). The pane itself is core's `paneDomId`
 * (`<scope>-pane-<id>`), which core's DOM lookups use.
 */
export const titleId = (scope: string, id: string) => `${scope}-title-${id}`;
export const tabId = (scope: string, id: string) => `${scope}-tab-${id}`;
export const panelId = (scope: string, id: string) => `${scope}-panel-${id}`;
