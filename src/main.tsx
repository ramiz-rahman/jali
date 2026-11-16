import { createRoot } from "react-dom/client";
import { createDataLayer } from "./data";
import { registerAllPaneKinds } from "./panes";
import { App } from "./ui/App";
import "./ui/styles.css";

registerAllPaneKinds();

const data = createDataLayer();
void data.api.ready();

createRoot(document.getElementById("root")!).render(<App data={data} />);
