/**
 * Markets: a Jali example. A simulated market (no feed, keys or licences), eight kinds of pane, four desks, and a
 * layout that lives in the address, so a desk is a link.
 */
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { createSimulator } from "./market/simulator";
import { createServices } from "./services";
import { App } from "./shell/App";
import { createMarketsJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then Jali's styles, its faces (Atkinson Hyperlegible Next
// and Mono), and the app's own.
import "@jali/react/styles.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-500.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-400.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-500.css";
import "./styles/app.css";

// The same market all day for everyone: the seed is today's date.
const today = new Date();
const market = createSimulator({
  seed: today.getFullYear() * 1e4 + (today.getMonth() + 1) * 100 + today.getDate(),
});
const services = createServices(market);
const jali = createMarketsJali(services, { notify: (text) => toast(text) });

market.run();
services.trading.connect();

createRoot(document.getElementById("root")!).render(<App jali={jali} services={services} />);
