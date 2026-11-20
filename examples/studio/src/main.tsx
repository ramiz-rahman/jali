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
import { applyControlsPlace } from "./ui/controlsPlace";
import { installFeel } from "./ui/feel";
import { FIRST_SESSION, loadSession } from "./sessions/sessions";
import { createStudioJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then the faces: Chakra Petch for everything, and IBM Plex Mono
// only for the numbers that tick (Chakra Petch has no tabular figures); then the app's own, which import Jali's first.
import "@fontsource/chakra-petch/latin-400.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/app.css";

applyControlsPlace();
installFeel();
// The sessions' data loads on demand (sessions/load.ts). The transport needs a session to stand on before the first
// paint: the first one, then the one the layout shows (a link, a reload) if that is another.
await loadSession(FIRST_SESSION);
const services = createServices({ session: FIRST_SESSION });
const jali = createStudioJali(services, { notify: (text) => toast(text) });
const shown = sessionInLayout(jali);
if (shown && shown !== FIRST_SESSION) await loadSession(shown).catch(() => undefined);
// The transport starts on that session, and loads its audio now.
services.engine.load(shown ?? FIRST_SESSION);

const root = document.getElementById("root");
if (!root) throw new Error("Studio needs an element with the id “root” (index.html).");
createRoot(root).render(<App jali={jali} services={services} />);
