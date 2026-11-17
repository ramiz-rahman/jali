import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { registerAllPaneKinds } from "./panes";
import { registerLoanReview } from "./review";
import { App } from "./ui/App";
import { boot, startUi } from "./ui/boot";
import { focusPane } from "./ui/dom/focus";
import { createUiStore } from "./ui/state/store";
import { createUrlSync } from "./ui/url";
import "./ui/styles/index.css";

registerAllPaneKinds();
registerLoanReview();

const data = createDataLayer();
void data.api.ready();

const url = createUrlSync();
const store = createUiStore({ url, focusPane });
boot(store, url);
startUi(store, url);

createRoot(document.getElementById("root")!).render(<App store={store} data={data} />);
