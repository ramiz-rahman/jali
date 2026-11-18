import { Jali, JaliView, PageBar } from "@jali/react";
import { store } from "./store";

// <Jali> draws the workspace and its dialogs. Your chrome goes inside it, with <JaliView /> where the panes go.
export function App() {
  return (
    <Jali workspace={store} className="app" overlays={<div id="toasts" />}>
      <header className="topbar" data-jali-chrome="">
        <strong>Sales desk</strong>
        <PageBar />
      </header>
      <JaliView />
    </Jali>
  );
}
