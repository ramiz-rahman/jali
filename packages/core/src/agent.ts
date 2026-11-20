/**
 * @jali/core/agent: lets an AI agent read a workspace and use it, through the same actions a person's clicks and keys
 * run (learned from ui-sdk.dev's agent bridge). An entry of its own, so an app that has no agent ships none of it.
 *
 *   const agent = createAgent(jali, { allow: (step) => step.action !== "close" || "Ask before closing" });
 *   agent.snapshot();                                        // panes, kinds, presets, what it may do
 *   agent.act({ steps: [{ action: "openBeside", args: ["orders", { kind: "order", params: { id: 7 } }] }] });
 *   agent.tools();                                           // the same, as tools for a model
 *   agent.registerTools();                                   // offered to the browser's agent (WebMCP)
 *
 * Every change an agent makes carries `input: "agent"` in Jali's events. The app decides what the agent may do:
 * which actions (`actions`), each step (`allow`), and whether the workspace rearranges itself after the agent opens
 * or closes panes (`arrange`). A close that would lose unsaved work still asks the person.
 */
import { withInput } from "./dom/input";
import { PANE_CONTROLS, allows } from "./actions/allow";
import { storeOf } from "./state/instance";
import type { Layout, ObjectRef } from "./layout/types";
import type { ActionResult } from "./state/apply";
import type { Jali } from "./state/instance";
import { checkRef, type OptionalParam, type ParamType } from "./pane-kinds";
import { own } from "./own";

/** What each action an agent may use does, and its arguments, for the agent to read. */
export const AGENT_ACTIONS = {
  focus: "focus(pane): focus a pane and show it, choosing its tab if it is behind one",
  toggleZoom: "toggleZoom(pane?): maximise a pane (default: the focused one), or restore it",
  openBeside:
    'openBeside(pane, ref, { edge? }?): open the object `ref` beside `pane`, on its "left" | "right" | "top" | "bottom" edge if given; an open object is shown instead',
  openHere: "openHere(pane, ref): show `ref` in `pane`, in place",
  peek: "peek(pane, ref): show `ref` in the peek sheet, for `pane`",
  closePeek: "closePeek(): close the peek sheet",
  select:
    "select(pane, ref | null): the item selected in the list `pane`; its following detail follows",
  setKept:
    "setKept(pane, kept): keep a linked detail on what it shows (true), or let it follow its list (false)",
  addTab: "addTab(pane, ref): open `ref` as a new tab of `pane`'s tabs",
  close:
    "close(pane?): close a pane (default: the focused one); the person is asked if it has unsaved work",
  closeTabs:
    'closeTabs(pane, "others" | "after"): close the other tabs of its group, or the ones after it',
  undo: "undo(): bring back the last closed or tucked pane",
  tuck: "tuck(pane?): tuck a pane into its neighbour as a tab, out of the way",
  putBack: "putBack(pane?): put a tucked pane back where it was",
  move: 'move(pane, "left" | "right" | "top" | "bottom"): move a pane one step towards an edge',
  swapWithNext: "swapWithNext(pane?): swap a pane with the next one on screen",
  mergeInto: "mergeInto(pane, target): make `pane` a tab of `target`",
  unmerge: "unmerge(pane?): move a tab out of its tabs, to their right",
  moveTab: "moveTab(pane, index): move a tab to position `index` (from 0) in its group",
  setPinned: "setPinned(pane, pinned): pin or unpin a pane's tab",
  preset: "preset(id): switch to one of the workspace's preset layouts",
  resetLayout: "resetLayout(): rebuild the preset last chosen",
  autoLayout:
    "autoLayout(): arrange every pane from the room there is and each kind's size hints (side by side, a second row when there is height, the rest as tabs beside the pane they came from)",
  openPage: "openPage({ item?, tab? }?): open the curated page",
  leavePage: "leavePage(): leave the curated page for the free workspace",
  setMode: 'setMode("single" | "split"): the curated page in Single view or Split view',
  openTab: "openTab(tab): show one of the curated page's views",
  activate: "activate(item): show another item on the curated page",
} as const;

export type AgentAction = keyof typeof AGENT_ACTIONS;

/** One thing for the agent to do: an action and its arguments, in order. A pane is its id, or a ref it shows. */
export interface AgentStep {
  action: AgentAction;
  args?: unknown[];
}

export interface AgentOptions {
  /** The actions the agent may use. Default: all of `AGENT_ACTIONS`. */
  actions?: readonly AgentAction[];
  /** Asked before each step: `false`, or a reason, refuses it (the agent hears the reason); anything else allows it. */
  allow?: (step: AgentStep) => boolean | string | void;
  /**
   * Whether the workspace rearranges itself after the agent's changes. `"when-asked"` (default): only when the agent
   * runs `autoLayout`. `"after-changes"`: also after every `act` that opened or closed panes, so the agent can add and
   * remove panes and leave the arranging to Jali.
   */
  arrange?: "when-asked" | "after-changes";
}

/** Where a pane is: on screen, behind a tab, folded for lack of room, tucked, or hidden by a curated page. */
export type AgentPaneState = "shown" | "tab" | "folded" | "tucked" | "hidden";

export interface AgentPane {
  id: string;
  kind: string;
  title: string;
  params: ObjectRef["params"];
  state: AgentPaneState;
  focused?: true;
  zoomed?: true;
  /** Its tab group, when it has one: the ids of the panes in it, in order. */
  tabs?: string[];
  pinned?: true;
  kept?: true;
  /** The pane it was opened from. */
  linkedTo?: string;
  /** It follows the selection of `linkedTo`. */
  follows?: true;
  /** It has unsaved work: closing it asks the person. */
  unsaved?: string;
  /** What the app doesn't allow for this pane (`allow`): asking for it is refused. */
  notAllowed?: string[];
  activity?: string;
}

export interface AgentKind {
  kind: string;
  /** Its params: `number`, `string`, `boolean` or `one of: a, b`, with `?` when a ref may leave it out. */
  params: Record<string, string>;
  minWidth: number;
  comfortableWidth?: number;
}

export interface AgentSnapshot {
  workspace: {
    width: number;
    height: number;
    /** `single`: one pane at a time (a phone); `split`: panes side by side. */
    view: "single" | "split";
    focused?: string;
    page?: { mode: string; tab?: string } | null;
  };
  panes: AgentPane[];
  kinds: AgentKind[];
  presets: { id: string; label: string }[];
  /** The actions this agent may use, with what each does. */
  actions: Record<string, string>;
  arrange: "when-asked" | "after-changes";
}

export interface AgentStepResult {
  action: string;
  ok: boolean;
  /** Why it was refused: Jali's reason (`not-found`, `nothing-to-do`…), `not-allowed`, or `invalid`. */
  reason?: string;
  message?: string;
  /** Jali ran it on its own after the agent's changes (`arrange: "after-changes"`). */
  auto?: true;
}

export interface AgentResult {
  /** Every step ran. Steps stop at the first refusal. */
  ok: boolean;
  steps: AgentStepResult[];
  /** The workspace after. */
  snapshot: AgentSnapshot;
}

/** A tool for a model: a name, what it does, the JSON Schema of its input, and the call. */
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown): Promise<{ content: { type: "text"; text: string }[] }>;
}

export interface JaliAgent {
  snapshot(): AgentSnapshot;
  act(request: { steps: AgentStep[] }): AgentResult;
  /** `jali_snapshot` and `jali_act`, for a model's tool list. */
  tools(): AgentTool[];
  /** Offer the tools to the browser's own agent (WebMCP, `navigator.modelContext`). Returns the withdrawal; does
   *  nothing where the browser has no such agent. */
  registerTools(context?: ModelContextLike): () => void;
}

/** The part of WebMCP's `navigator.modelContext` Jali uses (an experimental browser API). */
export interface ModelContextLike {
  registerTool?(tool: AgentTool): unknown;
  unregisterTool?(name: string): unknown;
  provideContext?(context: { tools: AgentTool[] }): unknown;
}

const describeParam = (t: ParamType | OptionalParam): string => {
  const opt = typeof t === "object" && "optional" in t;
  const type = (opt ? (t as OptionalParam).optional : t) as ParamType & { values?: unknown[] };
  const name =
    type === (Number as unknown)
      ? "number"
      : type === (String as unknown)
        ? "string"
        : type === (Boolean as unknown)
          ? "boolean"
          : type.values
            ? `one of: ${type.values.join(", ")}`
            : "value";
  return opt ? `${name}?` : name;
};

const isRef = (v: unknown): v is ObjectRef =>
  !!v && typeof v === "object" && typeof (v as ObjectRef).kind === "string";

/** An agent bridge for `jali`. */
export function createAgent(jali: Jali, options: AgentOptions = {}): JaliAgent {
  const allowed = new Set<AgentAction>(
    options.actions ?? (Object.keys(AGENT_ACTIONS) as AgentAction[]),
  );
  const arrange = options.arrange ?? "when-asked";

  function snapshot(): AgentSnapshot {
    const m = jali.model();
    const s = jali.get();
    const kinds = m.env.kinds;
    const visible = new Set(m.visible);
    const folded = new Set(m.folded);
    const off = new Set(m.off);
    const groupOf = new Map<string, string[]>();
    for (const g of m.groups.values())
      for (const t of g.tabs)
        groupOf.set(
          t.id,
          g.tabs.map((x) => x.id),
        );
    const panes = m.panes.map((p): AgentPane => {
      const state: AgentPaneState = off.has(p.id)
        ? "hidden"
        : visible.has(p.id)
          ? "shown"
          : m.tuckOf(p.id)
            ? "tucked"
            : folded.has(p.id)
              ? "folded"
              : "tab";
      const unsaved = own(s.unsaved, p.id);
      const x = storeOf(jali).snapshot();
      const denied = PANE_CONTROLS.filter((c) => c !== "popOut" && !allows(x, p.id, c));
      const activity = own(s.activity, p.id);
      return {
        id: p.id,
        kind: p.ref.kind,
        title: m.title(p.id),
        params: p.ref.params,
        state,
        ...(s.view.focused === p.id ? { focused: true as const } : {}),
        ...(s.view.zoomed === p.id ? { zoomed: true as const } : {}),
        ...(groupOf.has(p.id) ? { tabs: groupOf.get(p.id) } : {}),
        ...(p.pinned ? { pinned: true as const } : {}),
        ...(p.kept ? { kept: true as const } : {}),
        ...(p.linkedTo ? { linkedTo: p.linkedTo } : {}),
        ...(p.follows ? { follows: true as const } : {}),
        ...(unsaved ? { unsaved: typeof unsaved === "string" ? unsaved : "unsaved work" } : {}),
        ...(denied.length ? { notAllowed: denied } : {}),
        ...(activity && activity !== "idle" ? { activity } : {}),
      };
    });
    const registry = kinds.registry();
    return {
      workspace: {
        width: s.area.width,
        height: s.area.height,
        view: m.single ? "single" : "split",
        ...(s.view.focused ? { focused: s.view.focused } : {}),
        page: s.page ? { mode: s.page.mode, ...(s.page.tab ? { tab: s.page.tab } : {}) } : null,
      },
      panes,
      kinds: Object.values(registry).map((k) => ({
        kind: k.kind,
        params: Object.fromEntries(
          Object.entries(kinds.get(k.kind)?.params ?? {}).map(([n, t]) => [n, describeParam(t)]),
        ),
        minWidth: k.minWidth,
        ...(k.comfortableWidth !== undefined ? { comfortableWidth: k.comfortableWidth } : {}),
      })),
      presets: m.env.presets.map((p) => ({ id: p.id, label: p.label })),
      actions: Object.fromEntries([...allowed].map((a) => [a, AGENT_ACTIONS[a]])),
      arrange,
    };
  }

  /** A ref in the arguments that its kind can't read: the agent hears what is wrong. */
  function badRef(args: unknown[]): string | undefined {
    const kinds = jali.model().env.kinds;
    for (const a of args) {
      if (!isRef(a)) continue;
      const bad = checkRef(kinds, a);
      if (bad) return bad;
      const problems = kinds.problems(a);
      if (problems.length) return `${a.kind}: ${problems.map((p) => JSON.stringify(p)).join("; ")}`;
    }
    return undefined;
  }

  const paneIds = (l: Layout) => {
    const ids: string[] = [];
    const walk = (n: Layout["root"]) =>
      n.type === "pane" ? ids.push(n.id) : n.children.forEach(walk);
    walk(l.root);
    return ids.sort().join(" ");
  };

  function act(request: { steps: AgentStep[] }): AgentResult {
    const steps: AgentStepResult[] = [];
    const before = paneIds(jali.getLayout());
    let ok = true;
    for (const step of request.steps ?? []) {
      const action = step.action;
      const args = Array.isArray(step.args) ? step.args : [];
      const refuse = (reason: string, message?: string) => {
        steps.push({ action, ok: false, reason, ...(message ? { message } : {}) });
        ok = false;
      };
      if (!allowed.has(action)) {
        refuse("not-allowed", `This agent may not use ${String(action)}`);
        break;
      }
      const verdict = options.allow?.({ action, args });
      if (verdict === false || typeof verdict === "string") {
        refuse("not-allowed", typeof verdict === "string" ? verdict : undefined);
        break;
      }
      const bad = badRef(args);
      if (bad) {
        refuse("invalid", bad);
        break;
      }
      const run = jali.actions[action] as (...a: unknown[]) => ActionResult;
      let r: ActionResult;
      try {
        r = withInput("agent", () => run(...args));
      } catch (err) {
        refuse("invalid", err instanceof Error ? err.message : String(err));
        break;
      }
      if (!r.ok) {
        refuse(r.reason, r.message);
        break;
      }
      steps.push({ action, ok: true });
    }
    // After the turn, when it opened or closed panes: not when the agent chose the layout itself (a preset, a
    // layout or an arrange of its own), and only as far as the app's `allow` lets it, as for any step.
    const placed = (request.steps ?? []).some((s) =>
      ["preset", "setLayout", "resetLayout", "autoLayout"].includes(String(s.action)),
    );
    const verdict = options.allow?.({ action: "autoLayout", args: [] });
    const vetoed = verdict === false || typeof verdict === "string";
    if (arrange === "after-changes" && !placed && !vetoed && paneIds(jali.getLayout()) !== before) {
      const r = withInput("agent", () => jali.actions.autoLayout());
      // Nothing to arrange, or nothing arrangeable here (a phone shows one pane): not a failure, so not reported.
      if (r.ok || (r.reason !== "nothing-to-do" && r.reason !== "unavailable"))
        steps.push({
          action: "autoLayout",
          ok: r.ok,
          auto: true,
          ...(r.ok ? {} : { reason: r.reason, ...(r.message ? { message: r.message } : {}) }),
        });
    }
    return { ok, steps, snapshot: snapshot() };
  }

  const text = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  });

  function tools(): AgentTool[] {
    const list = [...allowed].map((a) => `- ${AGENT_ACTIONS[a]}`).join("\n");
    return [
      {
        name: "jali_snapshot",
        description:
          "Read the workspace: its panes (id, kind, title, params, where each is: shown, tab, folded, tucked or hidden; links, pins, unsaved work), the kinds of pane it can open and their params, its presets, and the actions you may use. Call it before acting.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => text(snapshot()),
      },
      {
        name: "jali_act",
        description: `Change the workspace with one or more steps, in order; they stop at the first refusal, and the result says why and gives the workspace after. A pane argument is a pane id from jali_snapshot, or the ref of the object it shows. A ref is { "kind": "...", "params": { ... } }, with the params its kind lists.${arrange === "after-changes" ? " After steps that open or close panes, the workspace arranges itself." : ""}\n\nActions:\n${list}`,
        inputSchema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", enum: [...allowed] },
                  args: { type: "array", description: "The action's arguments, in order" },
                },
                required: ["action"],
                additionalProperties: false,
              },
            },
          },
          required: ["steps"],
          additionalProperties: false,
        },
        execute: async (input) => text(act(input as { steps: AgentStep[] })),
      },
    ];
  }

  function registerTools(
    context: ModelContextLike | undefined = (
      globalThis.navigator as { modelContext?: ModelContextLike }
    )?.modelContext,
  ): () => void {
    if (!context) return () => {};
    const list = tools();
    if (context.registerTool) {
      for (const t of list) context.registerTool(t);
      return () => list.forEach((t) => context.unregisterTool?.(t.name));
    }
    if (context.provideContext) {
      context.provideContext({ tools: list });
      return () => context.provideContext?.({ tools: [] });
    }
    return () => {};
  }

  return { snapshot, act, tools, registerTools };
}
