import {
  Announcer,
  Chooser,
  ConfirmDiscard,
  Palette,
  Panes,
  SettingsPanel,
  Shelf,
  JaliProvider,
  useJali,
} from "@jali/react";
import { useEffect } from "react";
import { store } from "./store";

// <JaliRoot> without <JaliRoot>: the same parts, placed by you.
function Root({ children }: { children: React.ReactNode }) {
  const { dom, start } = useJali();
  useEffect(start, [start]); // keys, Back and Forward, theme and saving, while mounted
  return (
    <div data-jali="" ref={dom.attach} className="app">
      {children}
    </div>
  );
}

export function App() {
  return (
    <JaliProvider jali={store}>
      <Root>
        <Panes />
        <footer className="status">
          <Shelf />
        </footer>
      </Root>
      <Announcer />
      <Palette />
      <SettingsPanel />
      <Chooser />
      <ConfirmDiscard />
    </JaliProvider>
  );
}
