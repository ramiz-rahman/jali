import { JaliRoot, JaliView, PageBar } from "jali/react";
import { store } from "./store";

// <JaliRoot> draws the workspace and its dialogs. Your chrome goes inside it, with <JaliView /> where the panes go.
export function App() {
  return (
    <JaliRoot jali={store} className="app" overlays={<div id="toasts" />}>
      <header className="topbar" data-jali-chrome="">
        <strong>Sales desk</strong>
        <PageBar />
      </header>
      <JaliView />
    </JaliRoot>
  );
}
