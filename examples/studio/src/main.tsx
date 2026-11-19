/**
 * Studio: a Jali example. An audio session editor: a library, a transcript that lights up as it plays, a timeline,
 * a mixer on the real audio graph, segment details and markers, in panes that fit the screen. One transport, outside
 * the panes, drives them all. The layout lives in the address, so a layout is a link.
 */
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { sessionInLayout } from "./actions";
import { createServices } from "./services";
import { App } from "./shell/App";
import { createStudioJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then Spoke's faces (IBM Plex Sans and Mono), and the app's own,
// which import Jali's styles first.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/app.css";

const services = createServices();
const jali = createStudioJali(services, { notify: (text) => toast(text) });
// The transport starts on the session the layout shows (a link, a reload), and loads its audio now.
services.engine.load(sessionInLayout(jali) ?? services.engine.get().session);

createRoot(document.getElementById("root")!).render(<App jali={jali} services={services} />);
