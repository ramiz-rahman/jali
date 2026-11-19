/**
 * Trips: a Jali example. A map-first planner for five days in Lisbon: the days, the map, the place, the hotels and
 * the budget in panes that fit the screen. The plan is kept on this device, and the layout lives in the address.
 */
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { createServices } from "./services";
import { App } from "./shell/App";
import { createTripsJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then the faces (Bricolage Grotesque and Chivo Mono from
// Fontsource; Satoshi from public/fonts), and the app's own, which import Jali's styles first.
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/chivo-mono/index.css";
import "./styles/app.css";

const services = createServices({
  notify: (text, options) =>
    toast(text, options?.undo ? { action: { label: "Undo", onClick: options.undo } } : undefined),
});
const jali = createTripsJali(services);

createRoot(document.getElementById("root")!).render(<App jali={jali} services={services} />);
