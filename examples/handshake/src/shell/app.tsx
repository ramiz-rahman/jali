/**
 * The app: CyberSpec's skin around Jali's root, with the app's chrome round the panes.
 */
import type { Jali } from "jali";
import { JaliRoot, JaliView } from "jali/react";
import { Cyber } from "#src/vendor/cyberspec/components/ui/cyber.tsx";
import { StatusLine } from "./status-line";
import { TopBar } from "./top-bar";

export function App({ jali }: { jali: Jali }) {
  return (
    <Cyber className="skin">
      <JaliRoot jali={jali} className="app">
        <TopBar />
        <JaliView />
        <StatusLine />
      </JaliRoot>
    </Cyber>
  );
}
