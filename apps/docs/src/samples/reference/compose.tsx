import {
  Announcer, Chooser, ConfirmDiscard, Palette, SettingsPanel, Shelf, StoreProvider, Workspace, useStore,
} from "@jali/react";
import { store } from "./store";

// <Jali> without <Jali>: the same parts, placed by you.
function Root({ children }: { children: React.ReactNode }) {
  const { dom } = useStore();
  return <div data-jali="" ref={dom.attach} className="app">{children}</div>;
}

export function App() {
  return (
    <StoreProvider store={store}>
      <Root>
        <Workspace />
        <footer className="status"><Shelf /></footer>
      </Root>
      <Announcer />
      <Palette />
      <SettingsPanel />
      <Chooser />
      <ConfirmDiscard />
    </StoreProvider>
  );
}
