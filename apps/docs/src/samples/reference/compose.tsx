import { JaliRoot, JaliView, Shelf } from "jali/react";
import { store } from "./store";

// Chrome of your own: children of <JaliRoot>, with <JaliView /> where the panes go. The root still renders the
// dialogs, the live region and the full-screen layer, and starts and stops the workspace.
export function App() {
  return (
    <JaliRoot jali={store} className="app">
      <JaliView />
      <footer className="status">
        <Shelf />
      </footer>
    </JaliRoot>
  );
}
