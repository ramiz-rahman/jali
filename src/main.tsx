import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { createLabStore } from "./lab";
import { App } from "./ui/App";
import { boot, startUi } from "./ui/boot";
import { focusPane } from "./ui/dom/focus";
import { createUrlSync } from "./ui/url";
import "./ui/styles/index.css";

const data = createDataLayer();
void data.api.ready();

const url = createUrlSync();
const store = createLabStore({ url, focusPane });
boot(store, url);
startUi(store, url);

createRoot(document.getElementById("root")!).render(<App store={store} data={data} />);
