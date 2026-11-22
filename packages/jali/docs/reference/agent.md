# jali/agent

Every function and type jali/agent exports, the bridge that lets an AI agent read your panes and act on them through Jali's own actions.

The agent bridge: an AI agent inside your app reads the layout as data and changes it through the same actions a person's clicks and keys run. It has an entry of its own, so an app without an agent ships none of it. The task guide is [Let an agent arrange panes](../guides/agents.md).

```ts
import { createAgent } from "jali/agent";
```

## The bridge

### createAgent

*function*, from `jali/agent`

```ts
createAgent(jali: AnyJali, options?: AgentOptions): JaliAgent
```

Example, `agent.ts`:

```ts
import type { Jali } from "jali";
import { createAgent } from "jali/agent";

// Your model client: anything that takes tools and runs a conversation with them.
declare function runModel(options: {
  prompt: string;
  tools: {
    name: string;
    description: string;
    inputSchema: object;
    execute(input: unknown): unknown;
  }[];
}): Promise<string>;

export function connectAgent(jali: Jali) {
  const agent = createAgent(jali, {
    // Everything but closing panes: the agent opens, arranges and pins; the person closes.
    actions: [
      "focus",
      "openBeside",
      "addTab",
      "peek",
      "select",
      "moveTab",
      "setPinned",
      "autoLayout",
      "preset",
    ],
    // Asked before every step. A string refuses it, and the agent hears why.
    allow: (step) => step.action !== "preset" || jali.get().page === null || "Leave the page first",
    // The agent adds and removes panes; Jali arranges them after each turn.
    arrange: "after-changes",
  });

  // Offer the tools to the browser's own agent, where it has one (WebMCP).
  const withdraw = agent.registerTools();

  // Or give them to your own model.
  const ask = (prompt: string) => runModel({ prompt, tools: agent.tools() });

  return { agent, ask, withdraw };
}
```

Makes an agent bridge for one instance. The agent sees a snapshot and runs steps; your app decides which actions it may use (`actions`), asks about each step (`allow`), and chooses whether Jali arranges the panes after the agent's changes (`arrange`). Every change it makes carries `input: "agent"` in Jali's events. A close that would lose unsaved work still asks the person.

**Parameters**

- **`jali`** (`AnyJali`, required): The instance, from `createJali`.

- **`options`** (`AgentOptions`): What the agent may do. See `AgentOptions`.

**Returns** `JaliAgent`: See `JaliAgent`.

### JaliAgent

*type*, from `jali/agent`

```ts
interface JaliAgent
```

What `createAgent` returns.

**Fields**

- **`snapshot`** (`() => AgentSnapshot`, required): The layout as data, now. See `AgentSnapshot`.

- **`act`** (`(request: { steps: AgentStep[] }) => AgentResult`, required): Run steps in order, stopping at the first refusal. Each step's refs are checked against their kinds before anything runs.

- **`tools`** (`() => AgentTool[]`, required): `jali_snapshot` and `jali_act`, as tools for a model: each with a description, a JSON Schema of its input and `execute`. The descriptions list the actions you allowed.

- **`registerTools`** (`(context?: ModelContextLike) => () => void`, required): Offers the same tools to the browser's own agent through WebMCP (`navigator.modelContext`, an experimental API), or to `context`. Returns the function that withdraws them. Does nothing where the browser has no such agent.

### AgentOptions

*type*, from `jali/agent`

```ts
interface AgentOptions
```

The options of `createAgent`.

**Fields**

- **`actions`** (`readonly AgentAction[]`): The actions the agent may use, by name.

- **`allow`** (`(step: AgentStep) => boolean | string | void`): Asked before each step. `false`, or a reason, refuses it, and the agent hears the reason; anything else allows it.

- **`arrange`** (`"when-asked" | "after-changes"`): Whether Jali arranges the panes after the agent's changes. `"when-asked"`: only when the agent runs `autoLayout`. `"after-changes"`: also after every `act` that opened or closed panes, unless the agent chose the layout itself in that turn. `allow` is still asked, as `autoLayout` with no arguments.

## Actions and steps

### AGENT_ACTIONS

*constant*, from `jali/agent`

```ts
const AGENT_ACTIONS: Record<AgentAction, string>
```

Every action an agent can be given, each with a line that says what it does and what its arguments are, for the agent to read: `focus`, `toggleZoom`, `openBeside`, `openHere`, `peek`, `closePeek`, `select`, `setKept`, `addTab`, `close`, `closeTabs`, `undo`, `tuck`, `putBack`, `move`, `swapWithNext`, `mergeInto`, `unmerge`, `moveTab`, `setPinned`, `preset`, `resetLayout`, `autoLayout`, and a curated page's `page.open`, `page.leave`, `page.setMode`, `page.showView` and `page.showItem`. Removing a pane with no undo (`remove`), renaming, the dialogs and the person's settings are never offered.

### AgentAction

*type*, from `jali/agent`

```ts
type AgentAction = keyof typeof AGENT_ACTIONS
```

The name of an action an agent can use.

### AgentStep

*type*, from `jali/agent`

```ts
interface AgentStep { action: AgentAction; args?: unknown[] }
```

One thing for the agent to do: an action and its arguments, in order. A pane argument is a pane's id, or the ref of the object it shows (`{ kind, params }`).

**Fields**

- **`action`** (`AgentAction`, required): Which action.

- **`args`** (`unknown[]`): Its arguments, as `AGENT_ACTIONS` describes them.

### AgentResult

*type*, from `jali/agent`

```ts
interface AgentResult
```

What `act` returns.

**Fields**

- **`ok`** (`boolean`, required): Every step ran. Steps stop at the first refusal.

- **`steps`** (`AgentStepResult[]`, required): Each step that was tried, and how it went.

- **`snapshot`** (`AgentSnapshot`, required): The layout after.

### AgentStepResult

*type*, from `jali/agent`

```ts
interface AgentStepResult
```

How one step went.

**Fields**

- **`action`** (`string`, required): The step's action.

- **`ok`** (`boolean`, required): It ran.

- **`reason`** (`string`): Why it was refused: Jali's own reason (`not-found`, `nothing-to-do` and the others of [`RefusalReason`](core/types.md#refusalreason)), `not-allowed` (by `actions` or `allow`), or `invalid` (a ref its kind can't read).

- **`message`** (`string`): The refusal in words, for the agent.

- **`auto`** (`true`): Jali ran it on its own after the agent's changes (`arrange: "after-changes"`).

## What the agent sees

### AgentSnapshot

*type*, from `jali/agent`

```ts
interface AgentSnapshot
```

The layout as data, as `snapshot()` and the `jali_snapshot` tool return it.

**Fields**

- **`layout`** (`{ width: number; height: number; view: "one-at-a-time" | "side-by-side"; focused?: string; page?: { mode: string; tab?: string } | null }`, required): The size of Jali's root, how the panes are shown (`"one-at-a-time"` while a phone shows one pane at a time, else `"side-by-side"`), the focused pane, and the curated page's mode and view when one is open.

- **`panes`** (`AgentPane[]`, required): Every pane. See `AgentPane`.

- **`kinds`** (`AgentKind[]`, required): The kinds of pane the app can open. See `AgentKind`.

- **`presets`** (`{ id: string; label: string }[]`, required): The presets, in menu order.

- **`actions`** (`Record<string, string>`, required): The actions this agent may use, with what each does.

- **`arrange`** (`"when-asked" | "after-changes"`, required): The `arrange` option in use.

### AgentPane

*type*, from `jali/agent`

```ts
interface AgentPane
```

One pane, as the agent sees it.

**Fields**

- **`id`** (`string`, required): Its id in the layout.

- **`kind`** (`string`, required): Its kind.

- **`title`** (`string`, required): Its title, as the person sees it.

- **`params`** (`ObjectRef['params']`, required): What it shows.

- **`state`** (`AgentPaneState`, required): Where it is. See `AgentPaneState`.

- **`focused`** (`true`): It has focus.

- **`zoomed`** (`true`): It is maximised.

- **`tabs`** (`string[]`): The ids of the panes in its tab group, in order, when it has one.

- **`pinned`** (`true`): Its tab is pinned.

- **`kept`** (`true`): It is kept on its object.

- **`linkedTo`** (`string`): The pane it was opened from.

- **`follows`** (`true`): It follows the selection of `linkedTo`.

- **`unsaved`** (`string`): Its unsaved work, in the pane's words: closing it asks the person.

- **`notAllowed`** (`string[]`): The controls your app doesn't allow for it (`allow`); asking for them is refused.

- **`activity`** (`string`): Its activity (`"loading"`, `"working"`, `"live"` and the others), when it reports one.

### AgentPaneState

*type*, from `jali/agent`

```ts
type AgentPaneState = "shown" | "tab" | "folded" | "tucked" | "hidden"
```

Where a pane is: on screen, behind another tab, folded for lack of room, tucked by the person, or hidden by a curated page.

### AgentKind

*type*, from `jali/agent`

```ts
interface AgentKind
```

A kind of pane, as the agent sees it.

**Fields**

- **`kind`** (`string`, required): Its name.

- **`params`** (`Record<string, string>`, required): Each param: `number`, `string`, `boolean` or `one of: a, b`, with `?` when a ref may leave it out. A kind whose params are a Standard Schema is one entry, `params`, "an object (vendor schema)".

- **`width`** (`{ min: number; comfortable?: number }`, required): Its widths in CSS pixels, as the kind gives them in `definePane({ width })`: `min`, and `comfortable` when it has one.

## Tools

### AgentTool

*type*, from `jali/agent`

```ts
interface AgentTool
```

A tool for a model, in the shape MCP and WebMCP use.

**Fields**

- **`name`** (`string`, required): `jali_snapshot` or `jali_act`.

- **`description`** (`string`, required): What it does, with the allowed actions and their arguments.

- **`inputSchema`** (`Record<string, unknown>`, required): The JSON Schema of its input.

- **`execute`** (`(input: unknown) => Promise<{ content: { type: 'text'; text: string }[] }>`, required): Runs it, and returns its result as text content.

### ModelContextLike

*type*, from `jali/agent`

```ts
interface ModelContextLike
```

The part of WebMCP's `navigator.modelContext` that `registerTools` uses. Pass your own for a test, or for another agent host with the same shape.

**Fields**

- **`registerTool`** (`(tool: AgentTool) => unknown`): Offer one tool.

- **`unregisterTool`** (`(name: string) => unknown`): Withdraw one tool.

- **`provideContext`** (`(context: { tools: AgentTool[] }) => unknown`): Offer every tool at once.
