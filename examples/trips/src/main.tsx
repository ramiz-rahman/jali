/**
 * Trips: a Jali example. A map-first planner for a week in Thailand, Bangkok then Phuket: the days, the map, the place, the hotels and
 * the budget in panes that fit the screen. The plan is kept on this device, and the layout lives in the address.
 */
// Styles first: the layer order is declared in index.html. Then the faces (Figtree for text and Bricolage Grotesque
// for display, both from Fontsource under the SIL Open Font License), and the app's foundation, which imports
// Jali's. Each module below brings its own stylesheet after these.
import "@fontsource-variable/figtree/index.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "./styles/app.css";
import { createRoot } from "react-dom/client";
import { App } from "./shell/app";
import { notify } from "./shell/toasts";
import { createServices } from "./state/services";
import { createTripsJali } from "./workspace/workspace";

const services = createServices({ notify });
const jali = createTripsJali(services);

const root = document.getElementById("root");
if (!root) throw new Error("Trips needs an element with the id “root” (index.html).");
createRoot(root).render(<App jali={jali} services={services} />);
