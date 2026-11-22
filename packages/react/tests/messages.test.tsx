/**
 * Jali's words (packages/core/src/state/messages.ts): every string it shows or says comes from `messages`, English by
 * default, and `createJali({ messages })` replaces any of it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { storeOf } from "@jali/core/adapter";
import { join, relative } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { parseSync } from "vite-plus";
import {
  createJali,
  en,
  listCommands,
  memoryLocation,
  memoryStorage,
  row,
  type JaliOptions,
  type MessageOverrides,
  type Messages,
} from "@jali/core";
import { JaliRoot, definePane, useUnsaved } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => {
    useUnsaved(params.id === 1 && "a draft");
    return <p>Note {params.id}</p>;
  },
});
const launcher = definePane("launcher", { title: "New pane", Component: () => <p>Choose</p> });

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    launcher,
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...options,
    keyboard: { platform: "mac", onInvalid: () => {}, ...options.keyboard },
  });

const french: MessageOverrides = {
  announcements: { closed: (pane) => `${pane} fermé · annulation possible` },
  commands: { close: "Fermer le volet", focusDirection: (d) => `Aller au volet (${d})` },
  commandGroups: { pane: "Volet" },
  palette: { placeholder: "Tapez une commande…", empty: (q) => `Aucune commande pour « ${q} ».` },
  confirmDiscard: {
    title: "Abandonner les modifications ?",
    item: (pane, what, bold) => [what, " dans ", bold(pane)],
  },
  keys: { escape: "Échap" },
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("messages", () => {
  it("are English by default: `en` without a curated page's words, which come with a page", () => {
    const jali = make();
    const { page, ...rest } = jali.messages as Partial<Messages>;
    expect(page).toBeUndefined();
    for (const [area, words] of Object.entries(rest))
      for (const [key, word] of Object.entries(words))
        expect(word, `${area}.${key}`).toBe(
          (en as Record<string, Record<string, unknown>>)[area]![key],
        );
    expect(jali.messages.announcements.pageOpened).toBeUndefined();
    expect(jali.messages.commands.pageBack).toBeUndefined();
    const close = listCommands(jali).find((c) => c.id === "pane.close")!;
    expect(close.title).toBe("Close pane");
    expect(close.group).toBe("Pane");
    jali.actions.close("note-2");
    expect(storeOf(jali).get().announcement.text).toBe("Note 2 closed · Undo available");
  });

  it("replace an announcement, and keep the rest English", () => {
    const jali = make({ messages: french });
    jali.actions.close("note-2");
    expect(storeOf(jali).get().announcement.text).toBe("Note 2 fermé · annulation possible");
    jali.actions.undo();
    expect(storeOf(jali).get().announcement.text).toBe("Pane restored");
  });

  it("replace command titles and groups, in ⌘K and listCommands", () => {
    const jali = make({ messages: french });
    const byId = new Map(listCommands(jali).map((c) => [c.id, c]));
    expect(byId.get("pane.close")!.title).toBe("Fermer le volet");
    expect(byId.get("pane.close")!.group).toBe("Volet");
    expect(byId.get("pane.focus.left")!.title).toBe("Aller au volet (left)");
    expect(byId.get("pane.zoom")!.title).toBe("Maximise or restore pane");
    expect(byId.get("peek.close")!.keys).toBe("Échap");
  });

  it("replace the palette's words", () => {
    const jali = make({ messages: french });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.dialogs.openPalette());
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("placeholder")).toBe("Tapez une commande…");
    expect(screen.getByText("Fermer le volet")).toBeTruthy();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Aucune commande pour « zzz ».")).toBeTruthy();
  });

  it("replace a dialog's words, with emphasis in the translation's own order", () => {
    const jali = make({ messages: french });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.close("note"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.querySelector("h2")!.textContent).toBe("Abandonner les modifications ?");
    const item = dialog.querySelector("li")!;
    expect(item.innerHTML).toBe("a draft dans <b>Note 1</b>");
    expect(screen.getByText("Keep editing")).toBeTruthy();
  });

  it("render English dialogs exactly as before", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.close("note"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.querySelector("h2")!.textContent).toBe("Discard unsaved changes?");
    expect(dialog.querySelector("p")!.textContent).toBe(
      "This pane has work that is not saved. It will be lost.",
    );
    expect(dialog.querySelector("li")!.innerHTML).toBe("<b>Note 1</b>: a draft");
  });

  it("replace a failed pane's words, and its Retry command", () => {
    const broken = definePane("broken", {
      title: "Broken",
      Component: () => {
        throw new Error("boom");
      },
    });
    const jali = make({
      panes: [note, broken],
      layout: row(note({ id: 1 }), broken()),
      onPaneError: () => {},
      messages: {
        pane: { failed: (pane) => `${pane} n’a pas pu s’afficher.`, retry: "Réessayer" },
      },
    });
    const error = console.error;
    console.error = () => {};
    try {
      render(<JaliRoot jali={jali} />);
    } finally {
      console.error = error;
    }
    expect(screen.getByText("Broken n’a pas pu s’afficher.")).toBeTruthy();
    const buttons = [...document.querySelectorAll(".jali-pane-failed button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Réessayer", "Close"]);
  });

  it("type a full translation: a missing or misspelt key is an error", () => {
    // @ts-expect-error: a Messages needs every area
    const partial: Messages = { palette: en.palette };
    // @ts-expect-error: "placeholdr" is not a key
    const misspelt: MessageOverrides = { palette: { placeholdr: "…" } };
    // @ts-expect-error: a message that takes values is a function
    const wrongType: MessageOverrides = { announcements: { closed: "closed" } };
    const spread: Messages = { ...en, palette: { ...en.palette, placeholder: "Rechercher…" } };
    expect([partial, misspelt, wrongType, spread.palette.placeholder]).toHaveLength(4);
  });
});

/**
 * No user-facing English outside messages.ts: JSX text, and text in the attributes people read (labels, tooltips,
 * placeholders), in @jali/react; and sentences in the core's actions, commands and start-up, which announce.
 */
describe("no hard-coded words", () => {
  const root = join(__dirname, "../..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return files(p);
      return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
  const WORDS = /[A-Za-z]{2,}/;
  const READ = new Set([
    "aria-label",
    "aria-description",
    "aria-valuetext",
    "title",
    "placeholder",
    "alt",
    "label",
    "inputLabel",
    "listLabel",
  ]);

  type Node = { type: string; [k: string]: unknown };
  const walk = (n: unknown, visit: (n: Node, parent: Node | null) => void, parent: Node | null) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach((c) => walk(c, visit, parent));
    const node = n as Node;
    if (typeof node.type === "string") visit(node, parent);
    for (const [k, v] of Object.entries(node)) if (k !== "type") walk(v, visit, node);
  };
  const literalText = (v: Node | null | undefined): string => {
    if (!v) return "";
    if (v.type === "Literal" && typeof v.value === "string") return v.value;
    if (v.type === "TemplateLiteral")
      return (v.quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked).join(" ");
    if (v.type === "JSXExpressionContainer") return literalText(v.expression as Node);
    if (v.type === "ConditionalExpression")
      return `${literalText(v.consequent as Node)} ${literalText(v.alternate as Node)}`;
    return "";
  };

  it("@jali/react reads every word from messages", () => {
    const found: string[] = [];
    for (const file of files(join(root, "react/src"))) {
      const src = readFileSync(file, "utf8");
      const { program } = parseSync(file, src);
      walk(
        program,
        (n) => {
          if (n.type === "JSXText" && WORDS.test(String(n.value)))
            found.push(`${relative(root, file)}: text "${String(n.value).trim()}"`);
          if (n.type === "JSXAttribute") {
            const name = (n.name as { name: string }).name;
            const text = literalText(n.value as Node);
            if (READ.has(name) && WORDS.test(text))
              found.push(`${relative(root, file)}: ${name}="${text}"`);
          }
          // A title given in an object (a pane command's, for one).
          const key = n.type === "Property" ? (n.key as { name?: string }).name : undefined;
          if (key === "title" && WORDS.test(literalText(n.value as Node)))
            found.push(`${relative(root, file)}: ${key}: "${literalText(n.value as Node)}"`);
        },
        null,
      );
    }
    expect(found).toEqual([]);
  });

  it("the core announces and titles only through messages", () => {
    const core = join(root, "core/src");
    const checked = [
      ...files(join(core, "actions")),
      ...files(join(core, "commands")),
      join(core, "boot.ts"),
      join(core, "state/apply.ts"),
      join(core, "state/model.ts"),
      join(core, "state/store.ts"),
      join(core, "dividers/resize.ts"),
    ];
    const SENTENCE = /[A-Za-z]{2,} [A-Za-z]{2,}/;
    const found: string[] = [];
    for (const file of checked) {
      const { program } = parseSync(file, readFileSync(file, "utf8"));
      // Developer-facing text (errors, console warnings) stays English.
      const skip = new Set<Node>();
      walk(
        program,
        (n) => {
          const callee = n.callee as Node | undefined;
          const dev =
            (n.type === "NewExpression" && String(callee?.name).endsWith("Error")) ||
            (n.type === "CallExpression" &&
              callee?.type === "MemberExpression" &&
              (callee.object as Node).name === "console") ||
            (n.type === "CallExpression" && callee?.name === "warn");
          if (dev) walk(n.arguments, (c) => void skip.add(c), n);
        },
        null,
      );
      walk(
        program,
        (n, parent) => {
          if (
            skip.has(n) ||
            parent?.type === "TSLiteralType" ||
            parent?.type === "ImportDeclaration"
          )
            return;
          const text =
            n.type === "Literal" && typeof n.value === "string"
              ? n.value
              : n.type === "TemplateElement"
                ? (n.value as { cooked: string }).cooked
                : "";
          if (SENTENCE.test(text)) found.push(`${relative(root, file)}: "${text}"`);
        },
        null,
      );
    }
    expect(found).toEqual([]);
  });
});
