/** Size scenario: every feature. `defaultFeatures()`, rename and pop out, a curated page, presets, a launcher,
 *  commands, hooks and the parts. */
import { createRoot } from "react-dom/client";
import { FileTextIcon, UserIcon } from "@phosphor-icons/react";
import { createJali, pane, row, column, tabs, keyHint } from "jali";
import {
  JaliRoot,
  definePane,
  useActivity,
  useCommands,
  useLauncher,
  usePaneState,
  useUnsaved,
  useJaliCommands,
  useJaliShortcut,
  useJaliTheme,
} from "jali/react";
import { definePage } from "jali/page";
import { defaultFeatures } from "jali/features";
import { rename } from "jali/rename";
import { popOut } from "jali/pop-out";
import "jali/styles.css";

const borrower = definePane("borrower", {
  params: { application: Number },
  title: ({ application }) => `Borrower ${application}`,
  Component: () => {
    const [notes, setNotes] = usePaneState("notes", "");
    useUnsaved(notes ? "a note" : null);
    useActivity(notes ? "working" : "idle");
    useCommands([{ id: "clear", title: "Clear the note", run: () => setNotes("") }]);
    return <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />;
  },
});
const documents = definePane("documents", {
  params: { application: Number },
  title: "Documents",
  Component: ({ params, openBeside }) => (
    <button onClick={() => openBeside(borrower({ application: params.application }))}>
      {params.application}
    </button>
  ),
});
const launcher = definePane("launcher", {
  title: "New pane",
  scratch: true,
  Component: ({ openHere }) => {
    const sources = useLauncher();
    return (
      <button onClick={() => openHere(documents({ application: 1 }))}>
        {Object.keys(sources).length}
      </button>
    );
  },
});

const loanReview = definePage({
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  viewers: { full: "credit reviewer", limited: "loan officer" },
  roles: [
    { id: "borrower", label: "Borrower", priority: "primary", icon: UserIcon },
    { id: "documents", label: "Documents", priority: "supporting", icon: FileTextIcon },
  ],
  home: "borrower",
  firstItem: 1,
  bind: (item) => ({
    borrower: borrower({ application: item }),
    documents: documents({ application: item }),
  }),
  build: (item) =>
    row(
      pane(borrower({ application: item }), {
        id: "borrower",
        role: "borrower",
        priority: "primary",
      }),
      pane(documents({ application: item }), {
        id: "documents",
        role: "documents",
        priority: "supporting",
      }),
    ),
  Rail: ({ item, showItem }) => (
    <nav>
      {[1, 2, 3].map((n) => (
        <button key={n} aria-current={n === item} onClick={() => showItem(n)}>
          {n}
        </button>
      ))}
    </nav>
  ),
  Header: ({ item }) => <h1>Application {item}</h1>,
});

const jali = createJali({
  panes: [borrower, documents, launcher],
  launcher,
  page: loanReview,
  presets: [
    {
      id: "triage",
      label: "Triage",
      layout: row(documents({ application: 1 }), borrower({ application: 1 })),
    },
    {
      id: "deep",
      label: "Deep",
      layout: () => column(tabs(documents({ application: 2 })), borrower({ application: 2 })),
    },
  ],
  features: [...defaultFeatures(), rename({ run: () => {} }), popOut()],
  commands: [{ id: "host.hello", title: "Hello", group: "Host", run: () => {} }],
  keyboard: { prefix: "Mod+J" },
});

function Status() {
  const commands = useJaliCommands();
  const [theme] = [useJaliTheme()];
  return (
    <footer>
      {commands.length} {String(theme)} {useJaliShortcut("palette.toggle")} {keyHint("Mod+K")}
    </footer>
  );
}

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} overlays={<Status />} />);
