import { Jali, JaliView, PageBar } from "@jali/react";
import { store } from "./store";

// <Jali> provides the store and the dialogs; <JaliView> is the panes. Your chrome goes around it, inside <Jali>.
export function App() {
  return (
    <Jali store={store} className="app" overlays={<div id="toasts" />}>
      <header className="topbar" data-jali-chrome="">
        <strong>Sales desk</strong>
        <PageBar />
      </header>
      <JaliView />
    </Jali>
  );
}
