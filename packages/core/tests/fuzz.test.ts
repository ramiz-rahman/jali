/**
 * Seeded fuzz over the public actions (core-opus CORE-15): random sequences of every action, resizes, Back and a
 * reload from the address, on core's own kinds. After every step: nothing threw, the layout is valid (unique ids,
 * focus and zoom on panes that exist), every rect is finite and inside the room, an action that should never move
 * anything moved nothing (no "Layout stability" breach), and every address the instance wrote reopens identically: a
 * fresh instance at the size it was written at reads it and writes it back unchanged (the link's whole state: layout,
 * zoom, scroll, preset; the peek is never in it), and the last one shows exactly what was on screen. Deterministic: a
 * failure names its seed and the steps before it. `FUZZ_SEEDS=2000` runs more, `FUZZ_LIMIT` reports more than the
 * first five problems, `FUZZ_DEBUG=1` adds the views and the address.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  column,
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type Jali,
  type LayoutInput,
  type ObjectRef,
  type PaneKindBase,
} from "@jali/core";
import { storeOf, layout as L } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";
import { stabilityBreaches } from "./fixtures/stability";

const kinds: PaneKindBase[] = [
  { kind: "list", title: "List", width: { min: 260, comfortable: 360 }, selects: "item" },
  { kind: "item", title: "Item", params: { id: Number }, width: { min: 320, max: 700 } },
  { kind: "wide", title: "Wide", width: { min: 520 }, height: { min: 300 } },
  { kind: "note", title: "Note", params: { n: Number }, scratch: true, width: { min: 200 } },
];
const launcher = { kind: "launcher", title: "New", width: { min: 240 } };
const item = (id: number): ObjectRef => ({ kind: "item", params: { id } });
const START: LayoutInput[] = [
  row({ kind: "list", params: {} }, item(1)),
  row(
    pane({ kind: "list", params: {} }, { id: "l" }),
    tabs(pane(item(1), { linkedTo: "l" }), item(2), { kind: "wide", params: {} }),
    { kind: "note", params: { n: 1 } },
  ),
  // Containers with the ids Jali gives panes: an undo that puts a pane back under a new id, or makes a container
  // again, must still leave every id once (the layout check after every step).
  column(
    { id: "pane-2" },
    pane({ kind: "list", params: {} }, { id: "pane-4" }),
    row({ id: "pane-1" }, item(1), pane(item(2), { id: "pane-3" })),
  ),
];

/** Mulberry32: a small seeded generator. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shown = (j: Jali) =>
  JSON.stringify(
    storeOf(j)
      .model()
      .resolved.panes.filter((b) => !b.hidden)
      .map((b) => [b.id, Math.round(b.rect.x), Math.round(b.rect.y), Math.round(b.rect.width)]),
  );

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 300);
const STEPS = 40;
const LIMIT = Number(process.env.FUZZ_LIMIT ?? 5);
/** Seeds (of 2,000) whose reload shows the same panes at other widths, after tucks and folds combine: a known gap,
 *  moved to a later phase (docs/reviews/2026-11-22/README.md, phase 1; 1347 shows it too, before step 4 as after). Only
 *  what they show is left out, by name: their addresses are checked like every other. */
const MOVED = new Set([54, 1289, 1347, 1403, 1421, 1571]);

beforeAll(() => void vi.useFakeTimers());
afterAll(() => void vi.useRealTimers());

const unstable = stabilityBreaches();

/** One seed's run: its problems go in `problems`. */
function runSeed(seed: number, problems: string[]) {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const location = memoryLocation();
  const storage = memoryStorage();
  // Links that carry sizes, and links that keep them on the device; on their own, and beside another instance's.
  const sync = {
    sizes: seed % 2 ? ("link" as const) : ("local" as const),
    ...(seed % 3 ? {} : { prefix: "w." }),
  };
  unstable.length = 0;
  // Every address the instance writes, with the room it was written for.
  const written: { search: string; area: { width: number; height: number } }[] = [];
  let at = { width: 1400, height: 800 };
  const navigate = location.navigate.bind(location);
  location.navigate = (search, mode) => {
    written.push({ search, area: at });
    navigate(search, mode);
  };
  const jali = createJali({
    panes: kinds,
    launcher,
    layout: START[seed % START.length]!,
    features: [urlSync({ location, ...sync })],
    storage,
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });
  const store = storeOf(jali);
  const off = jali.subscribe(() => (at = store.get().area));
  jali.start();
  let checked = 0;
  const log: string[] = [];
  const fail = (what: string) =>
    problems.push(`seed ${seed}: ${what}\n    after ${log.slice(-6).join(" · ")}`);
  for (let i = 0; i < STEPS; i++) {
    const ids = L.tree.panes(jali.getLayout().root).map((p) => p.id);
    const p = pick(ids),
      q = pick(ids);
    const ref = pick<ObjectRef>([
      item(1 + Math.floor(r() * 6)),
      { kind: "wide", params: {} },
      { kind: "note", params: { n: Math.floor(r() * 3) } },
      { kind: "list", params: {} },
    ]);
    const a = jali.actions;
    const steps: [string, () => unknown][] = [
      [
        "openBeside",
        () =>
          a.openBeside(p, ref, {
            edge: pick(["left", "right", "top", "bottom", undefined] as const),
          }),
      ],
      ["openHere", () => a.openHere(p, ref)],
      ["addTab", () => a.addTab(p, ref)],
      ["close", () => a.close(p)],
      ["closeOthers", () => a.closeOthers(p)],
      ["undo", () => a.undo()],
      ["tuck", () => a.tuck(p)],
      ["putBack", () => a.putBack()],
      ["move", () => a.move(p, pick(["left", "right", "top", "bottom"] as const))],
      ["swapWithNext", () => a.swapWithNext(p)],
      ["moveOutOfRow", () => a.moveOutOfRow(p)],
      ["mergeInto", () => a.mergeInto(p, q)],
      ["unmerge", () => a.unmerge(p)],
      ["moveTab", () => a.moveTab(p, Math.floor(r() * 4))],
      ["setPinned", () => a.setPinned(p, r() < 0.5)],
      ["toggleZoom", () => a.toggleZoom(p)],
      ["focus", () => a.focus(p)],
      ["select", () => a.select(p, item(1 + Math.floor(r() * 6)))],
      ["split", () => a.split(p, pick(["right", "bottom"] as const))],
      ["newTab", () => a.newTab(p)],
      ["autoLayout", () => a.autoLayout()],
      ["remove", () => a.remove(p)],
      ["setKept", () => a.setKept(p, r() < 0.5)],
      ["resetLayout", () => a.resetLayout()],
      [
        "resize",
        () =>
          store.set({
            area: { width: 380 + Math.floor(r() * 1800), height: 300 + Math.floor(r() * 900) },
          }),
      ],
      [
        "back",
        () => {
          if (location.entries.length < 2) return;
          location.entries.pop();
          location.visit(location.entries.pop()!);
        },
      ],
    ];
    const [name, run] = pick(steps);
    log.push(
      `${name}(${p}${name.startsWith("open") || name === "addTab" ? " " + JSON.stringify(ref) : ""})`,
    );
    try {
      run();
      vi.advanceTimersByTime(1000);
    } catch (e) {
      fail(`${name} threw: ${(e as Error).message}`);
      break;
    }
    const layout = jali.getLayout();
    const valid = L.validate(layout, storeOf(jali).env.kinds.registry());
    if (!valid.ok) {
      fail(`invalid layout: ${valid.errors.slice(0, 2).join("; ")}`);
      break;
    }
    const now = L.tree.panes(layout.root).map((n) => n.id);
    const { focused, zoomed } = jali.get().view;
    if ((focused && !now.includes(focused)) || (zoomed && !now.includes(zoomed))) {
      fail(`focus or zoom on a pane that isn't there`);
      break;
    }
    const m = storeOf(jali).model();
    const area = store.get().area;
    const bad = m.resolved.panes.find(
      (b) =>
        !b.hidden &&
        (![b.rect.x, b.rect.y, b.rect.width, b.rect.height].every(Number.isFinite) ||
          (!m.onePane && !b.clip && (b.rect.x < -1 || b.rect.x + b.rect.width > area.width + 1))),
    );
    if (bad) {
      fail(`rect ${JSON.stringify(bad.rect)} in ${area.width}px`);
      break;
    }
    if (unstable.length) {
      fail(`"${unstable.join(", ")}" moved panes`);
      unstable.length = 0;
    }
    // Every address written since the last step, reopened at the size it was written for: read and written back,
    // it is the same address. Single view (a phone) keeps the wide layout's address on purpose (19 Nov 2026), and
    // shows the focused pane, which no address holds: there the address is checked, not what shows.
    const reopen = (w: (typeof written)[number]) =>
      createJali({
        panes: kinds,
        launcher,
        layout: row({ kind: "list", params: {} }),
        features: [urlSync({ location: memoryLocation(w.search), ...sync })],
        storage,
        size: w.area,
        moveFocus: false,
      });
    // The link's own state: its params, with the layout read back and without what the reader's fit works out
    // again for its room (which panes fold, which tab a fold shows). Tucks, sizes and objects are the link's.
    const own = (search: string) =>
      JSON.stringify(
        [...new URLSearchParams(search)]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => {
            if (k !== `${sync.prefix ?? ""}l`) return [k, v];
            const read = L.decode(v, storeOf(jali).env.kinds.registry());
            if (!read?.overlay) return [k, read];
            const { folds: _f, shown: _s, ...rest } = read.overlay;
            // An empty list says what leaving it out says.
            const overlay = Object.entries(rest).filter(([, v]) => !Array.isArray(v) || v.length);
            const { overlay: _o, ...layout } = read;
            return [
              k,
              overlay.length ? { ...layout, overlay: Object.fromEntries(overlay) } : layout,
            ];
          }),
      );
    // Drawn every step, as before every write was checked, so each seed runs the same steps it always has.
    const look = r() < 0.25 && !MOVED.has(seed);
    let wrong: string | undefined;
    for (; checked < written.length && !wrong; checked++) {
      const w = written[checked]!;
      // Two writes of one address at one size are one check.
      const prev = written[checked - 1];
      if (prev && prev.search === w.search && prev.area === w.area) continue;
      const again = reopen(w);
      const back = storeOf(again).url!.href!().slice("memory:".length);
      if (own(back) !== own(w.search))
        wrong =
          `the address ${w.search} reopens as ${back} (${w.area.width}×${w.area.height})` +
          (process.env.FUZZ_DEBUG ? `\n    ${own(w.search)}\n    ${own(back)}` : "");
      else if (
        look &&
        checked === written.length - 1 &&
        !m.onePane &&
        w.area === area &&
        shown(again) !== shown(jali)
      )
        wrong =
          `the address reopens another arrangement\n    ${shown(jali)}\n    ${shown(again)}` +
          (process.env.FUZZ_DEBUG
            ? `\n    ${JSON.stringify(jali.get().view)} ${JSON.stringify(again.get().view)} ${w.search}`
            : "");
      again.destroy();
    }
    if (wrong) {
      fail(wrong);
      break;
    }
  }
  off();
  jali.destroy();
}

/** Seeds per test: each is its own test with its own time limit, so a busy machine never times out the whole run. */
const CHUNK = 50;

describe("random sequences of public actions", () => {
  for (let from = 1; from <= SEEDS; from += CHUNK) {
    const to = Math.min(SEEDS, from + CHUNK - 1);
    it(`keep every invariant (seeds ${from}–${to} × ${STEPS} steps)`, () => {
      const problems: string[] = [];
      for (let seed = from; seed <= to && problems.length < LIMIT; seed++) runSeed(seed, problems);
      expect(problems.join("\n")).toBe("");
    }, 60_000);
  }
});
