/**
 * The app: Jali's root with the app's chrome around the panes (a top bar with the layouts and the transport, and a
 * status line with Jali's shelf), the app's own keys, and the toasts outside the workspace.
 */
import type { Jali } from "jali";
import { JaliRoot, JaliView } from "jali/react";
import { ServicesProvider, type Services } from "../services";
import { useAppKeys } from "./keys";
import { StatusLine } from "./StatusLine";
import { Toasts } from "./Toasts";
import { TopBar } from "./TopBar";

export function App({ jali, services }: { jali: Jali; services: Services }) {
  useAppKeys(jali, services.engine);
  return (
    <ServicesProvider services={services}>
      <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
        <TopBar />
        <JaliView />
        <StatusLine />
      </JaliRoot>
    </ServicesProvider>
  );
}
