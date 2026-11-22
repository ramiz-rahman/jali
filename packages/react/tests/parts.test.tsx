/**
 * The styling contract (packages/react/src/parts.ts): every public part and attribute is something Jali really
 * renders. The parts a plain workspace shows are rendered and found (jsdom has no layout, so the workspace is told
 * its size); the rest (drag, peek, page, dialogs) are checked against the source, so a rename that forgets the contract fails here.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePane } from "@jali/react";
import { parts, type Part, type PartName } from "../src/parts";
import { defaultFeatures, urlSync } from "./features";

const src = join(__dirname, "../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx?$/.test(f) && !/test|parts\.ts/.test(f)
        ? [p]
        : [];
  });
const code = files(src)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** The source without its comments, so an attribute named in prose doesn't count as set. */
const live = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The attributes Jali's source puts on elements: in JSX (`<button aria-disabled={…}>`, a bare `data-renaming`), where
 * a plain name counts only on an element (`<ListDialog disabled={…}>` is a prop) but a `data-` or `aria-` name on a
 * component too (`<Landmark data-one-pane>`, which passes it on); through `setAttribute` and its kin; as a quoted key of
 * an object spread onto an element; or through `dataset`.
 */
function attributesSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/<([a-zA-Z][\w.-]*)(?=[\s>/])/g)) {
    const element = /^[a-z]/.test(m[1]!);
    // The tag's own text up to its closing `>`, without strings and `{…}` expressions.
    let depth = 0,
      own = "";
    for (let i = m.index + m[0].length; i < text.length; i++) {
      const c = text[i]!;
      if (c === '"' || c === "'" || (c === "`" && depth)) {
        const end = text.indexOf(c, i + 1);
        if (end < 0) break;
        i = end;
        own += " ";
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (!depth && c === ">") break;
      else if (!depth) own += c;
    }
    for (const [, name] of own.matchAll(/(?:^|\s)([a-zA-Z][\w:-]*)(?=\s*=|\s|\/|$)/g))
      if (element || /^(data|aria)-/.test(name!)) out.add(name!);
  }
  for (const [, name] of text.matchAll(/(?:set|toggle)Attribute\(\s*["']([\w-]+)["']/g))
    out.add(name!);
  for (const [, name] of text.matchAll(/["']([a-z]+-[\w-]+)["']\s*:/g)) out.add(name!);
  for (const [, name] of text.matchAll(/\.dataset\.(\w+)/g))
    out.add("data-" + name!.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
  return out;
}
const set = attributesSet(live);

/** The class or attribute a selector names. */
const token = (selector: string) =>
  selector
    .match(/^\.([\w-]+)$|^\[([\w-]+)\]$/)!
    .slice(1)
    .find(Boolean)!;

/** Split at top-level commas. */
const splitList = (list: string) => {
  const out: string[] = [];
  let depth = 0,
    from = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && !depth) {
      out.push(list.slice(from, i));
      from = i + 1;
    }
  }
  return [...out, list.slice(from)].map((s) => s.trim()).filter(Boolean);
};

/** The element a selector styles: its last compound, after the last top-level combinator. */
const subjectOf = (sel: string) => {
  let depth = 0;
  for (let i = sel.length - 1; i >= 0; i--) {
    if (sel[i] === ")") depth++;
    else if (sel[i] === "(") depth--;
    else if (!depth && /[\s>+~]/.test(sel[i]!)) return sel.slice(i + 1);
  }
  return sel;
};

/** Every rule's subject that draws a ::before or ::after, with nested rules (`&`) resolved against their parents. */
function pseudoSubjects(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[][] = [[]];
  const out: string[] = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === ";") from = i + 1;
    else if (c === "}") {
      stack.pop();
      from = i + 1;
    } else if (c === "{") {
      const prelude = text.slice(from, i).trim();
      const parents = stack.at(-1)!;
      let mine: string[];
      if (prelude.startsWith("@")) mine = parents;
      else {
        const own = splitList(prelude);
        mine = parents.length
          ? parents.flatMap((p) =>
              own.map((s) => (s.includes("&") ? s.replaceAll("&", `:is(${p})`) : `${p} ${s}`)),
            )
          : own;
        for (const sel of mine) {
          const subject = subjectOf(sel);
          // A subject that is :is(parent) plus a pseudo-element draws on the parent's subject.
          const expanded = subject.replace(/:is\((.*)\)/, (_, p: string) => subjectOf(p));
          if (/::?(before|after)\b/.test(subject)) out.push(expanded);
        }
      }
      stack.push(mine);
      from = i + 1;
    }
  }
  return out;
}

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const size = { clientWidth: 1600, clientHeight: 800 };

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(cleanup);

describe("styling contract", () => {
  it("every selector is a single class or attribute, and Jali's source sets it", () => {
    for (const [name, part] of Object.entries(parts)) {
      expect(token(part.selector), name).toBeTruthy();
      if (name !== "hostChrome") expect(code, part.selector).toContain(token(part.selector));
    }
  });

  it("a part whose ::before and ::after are the app's: no rule in Jali's styles draws either on it", () => {
    const stylesDir = join(src, "styles");
    const css = readdirSync(stylesDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(stylesDir, f), "utf8"))
      .join("\n");
    // The check finds a pseudo-element however the rule is written: plain, in a list, or nested.
    const sample =
      ".a, .jali-tab:hover::after {} .b { & .jali-tab::before {} } .jali-tab { &[x]::after {} }";
    expect(pseudoSubjects(sample).filter((c) => /\.jali-tab(?![\w-])/.test(c))).toHaveLength(3);

    const drawn = pseudoSubjects(css);
    expect(drawn.length, "the check sees Jali's own pseudo-elements").toBeGreaterThan(0);
    const adorned = Object.entries(parts).filter(([, p]) => (p as Part).adornments);
    expect(adorned.map(([n]) => n)).toEqual(
      expect.arrayContaining(["tab", "switcherItem", "activity", "activityShape"]),
    );
    for (const [name, part] of adorned) {
      const own = new RegExp(`${part.selector.replace(/[.[\]]/g, "\\$&")}(?![\\w-])`);
      expect(
        drawn.filter((c) => own.test(c)),
        name,
      ).toEqual([]);
    }
  });

  it("every attribute is set by Jali's source, as an attribute of its own", () => {
    // The check reads attributes, not text: `aria-disabled` doesn't stand for `disabled`, nor a component's prop.
    const sample = attributesSet(
      '<button aria-disabled={!home || undefined} title="a > b" data-x={{ a: 1 }} data-flag>' +
        '<ListDialog disabled={(c) => c.disabled} data-y /> el.setAttribute("data-held", ""); el.dataset.dropTarget = "";',
    );
    expect([...sample].sort()).toEqual(
      [
        "aria-disabled",
        "data-drop-target",
        "data-flag",
        "data-held",
        "data-x",
        "data-y",
        "title",
      ].sort(),
    );
    for (const part of Object.values(parts))
      for (const a of part.attributes)
        expect(set.has(a.name), `${part.selector} ${a.name}`).toBe(true);
  });

  it("a tuck with nothing to tuck behind is aria-disabled, as the contract says, and not disabled", () => {
    const jali = createJali({
      panes: [note],
      layout: row(...[1, 2, 3].map((id) => pane(note({ id }), { id: `n${id}` }))),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    // A pane that holds a tucked tab can't tuck itself.
    act(() => void jali.actions.tuck("n1"));
    const names = (n: PartName) => (parts[n] as Part).attributes.map((a) => a.name);
    expect(names("paneAction")).toContain("aria-disabled");
    expect(names("iconButton")).toContain("aria-disabled");
    expect(names("paneAction")).not.toContain("disabled");
    const off = [
      ...document.querySelectorAll(`${parts.paneAction.selector}[data-action="tuck"]`),
    ].filter((el) => el.getAttribute("aria-disabled") === "true");
    expect(off.length).toBeGreaterThan(0);
    for (const el of off) {
      expect(el.matches(parts.iconButton.selector)).toBe(true);
      expect(el.hasAttribute("disabled")).toBe(false);
    }
  });

  it("a layout with a pane, a tab group with a pinned tab, then a tucked pane, renders its parts", () => {
    const jali = createJali({
      panes: [note],
      layout: row(note({ id: 1 }), tabs(pane(note({ id: 2 }), { pinned: true }), note({ id: 3 }))),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
    });
    const { container } = render(
      <JaliRoot jali={jali} overlays={<div />}>
        <JaliView />
        <Shelf />
      </JaliRoot>,
    );
    const rendered: PartName[] = [
      "root",
      "layer",
      "overlays",
      "layout",
      "pane",
      "paneHeader",
      "paneTitle",
      "paneActions",
      "paneContent",
      "tabBar",
      "pinnedTabs",
      "tabItem",
      "tab",
      "tabClose",
      "tabIndicator",
      "icon",
      "divider",
      "dividerLine",
      "paneAction",
      "tabTitle",
    ];
    const find = (n: PartName) => document.querySelector(parts[n].selector);
    for (const n of rendered) expect(find(n), n).not.toBeNull();
    expect(container.querySelector(".jali-pane[data-pane][data-kind]")).not.toBeNull();
    expect(container.querySelector(".jali-tab[data-pinned][aria-selected]")).not.toBeNull();

    // A tab's menu opens in the layer beside the root, with the dialogs, so tokens set around <JaliRoot> reach it.
    act(() => void fireEvent.contextMenu(container.querySelector(".jali-tab")!));
    expect(document.querySelector("[data-jali-layer] .jali-tab-menu")).not.toBeNull();
    act(() => void fireEvent.keyDown(document.querySelector(".jali-tab-menu")!, { key: "Escape" }));

    // The header's buttons, each with its action, while two panes are on screen.
    for (const action of ["tuck", "zoom", "close"])
      expect(
        container.querySelector(`.jali-pane-action[data-action="${action}"]`),
        action,
      ).not.toBeNull();

    const other = container.querySelector<HTMLElement>(".jali-pane:not(:has(.jali-tabbar))")!
      .dataset.pane!;
    act(() => void jali.actions.tuck(other));
    expect(find("shelf")).not.toBeNull();
    expect(
      container.querySelector('.jali-shelf-chip[data-chip][data-reason="tucked"][data-activity]'),
    ).not.toBeNull();
    for (const n of ["shelfChipMain", "shelfChipTitle", "shelfChipPut"] as const)
      expect(find(n), n).not.toBeNull();

    // ⌘K: the dialog, its field and its rows' parts.
    act(() => void jali.dialogs.openPalette());
    expect(
      document.querySelector('.jali-dialog.jali-palette[data-dialog="palette"]'),
    ).not.toBeNull();
    for (const n of [
      "dialog",
      "palette",
      "paletteInput",
      "paletteItem",
      "paletteName",
      "paletteGroup",
      "paletteKeys",
    ] as const)
      expect(find(n), n).not.toBeNull();
  });
});
