import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { createLabStore } from "./lab";
import { App } from "./shell/App";
import { boot, startUi, browserStorage, createUrlSync } from "@jali/core";
import "./shell/styles/index.css";
import "@jali/react/styles.css";

const data = createDataLayer();
void data.api.ready();

// Data Studio links reopen exactly, sizes included (the founder's round-trip rule, 17 Nov).
const url = createUrlSync({ storage: browserStorage("pane-lab"), sizes: "link" });
const store = createLabStore({ url });
boot(store);
startUi(store);
// Dev-only handle so e2e can drive activity states (the sample panes rarely report them).
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __lab?: unknown }).__lab = { actions: store.actions };

createRoot(document.getElementById("root")!).render(<App store={store} data={data} />);
