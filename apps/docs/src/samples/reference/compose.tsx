import {
  Announcer,
  Chooser,
  ConfirmDiscard,
  Palette,
  Panes,
  SettingsPanel,
  Shelf,
  WorkspaceProvider,
  useWorkspace,
} from "@jali/react";
import { useEffect } from "react";
import { store } from "./store";

// <Jali> without <Jali>: the same parts, placed by you.
function Root({ children }: { children: React.ReactNode }) {
  const { dom, start } = useWorkspace();
  useEffect(start, [start]); // keys, Back and Forward, theme and saving, while mounted
  return (
    <div data-jali="" ref={dom.attach} className="app">
      {children}
    </div>
  );
}

export function App() {
  return (
    <WorkspaceProvider workspace={store}>
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
    </WorkspaceProvider>
  );
}
