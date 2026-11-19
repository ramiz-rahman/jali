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
import { installFeel } from "./ui/feel";
import { applyHeaderButtons } from "./ui/headerButtons";
import { createStudioJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then the faces: Chakra Petch for everything, and IBM Plex Mono
// only for the numbers that tick (Chakra Petch has no tabular figures); then the app's own, which import Jali's first.
import "@fontsource/chakra-petch/latin-400.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/app.css";

applyHeaderButtons();
installFeel();
const services = createServices();
const jali = createStudioJali(services, { notify: (text) => toast(text) });
// The transport starts on the session the layout shows (a link, a reload), and loads its audio now.
services.engine.load(sessionInLayout(jali) ?? services.engine.get().session);

createRoot(document.getElementById("root")!).render(<App jali={jali} services={services} />);
