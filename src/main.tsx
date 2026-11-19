import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { createLabJali } from "./lab";
import { App } from "./shell/App";
import "./shell/styles/index.css";
import "@jali/react/styles.css";

const data = createDataLayer();
void data.api.ready();

const jali = createLabJali();
// Dev-only handle so e2e can drive activity states (the sample panes rarely report them).
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  (window as unknown as { __lab?: unknown }).__lab = { actions: jali.actions };

createRoot(document.getElementById("root")!).render(<App jali={jali} data={data} />);
