import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { storeOf } from "@jali/core/adapter";
import { createLabJali } from "./lab";
import { App } from "./shell/App";
import "./shell/styles/index.css";
import "@jali/react/styles.css";

// Right-to-left mode (`?dir=rtl`): the page reads right to left, as an Arabic or Hebrew app does. Jali follows the page.
if (new URLSearchParams(location.search).get("dir") === "rtl") document.documentElement.dir = "rtl";

const data = createDataLayer();
void data.api.ready();

const jali = createLabJali();
// Dev-only handle so e2e can drive activity states (the sample panes rarely report them): the engine's steps.
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  (window as unknown as { __lab?: unknown }).__lab = { actions: storeOf(jali).actions };

createRoot(document.getElementById("root")!).render(<App jali={jali} data={data} />);
