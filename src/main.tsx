import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { createLabStore } from "./lab";
import { App } from "./ui/App";
import { boot, startUi } from "./ui/boot";
import { focusPane } from "./ui/dom/focus";
import { browserStorage } from "./ui/ports";
import { createUrlSync } from "./ui/url";
import "./ui/styles/index.css";

const data = createDataLayer();
void data.api.ready();

const url = createUrlSync({ storage: browserStorage("pane-lab") });
const store = createLabStore({ url, focusPane });
boot(store, url);
startUi(store, url);
// Dev-only handle so e2e can drive activity states (the sample panes rarely report them).
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __lab?: unknown }).__lab = { actions: store.actions };

createRoot(document.getElementById("root")!).render(<App store={store} data={data} />);
