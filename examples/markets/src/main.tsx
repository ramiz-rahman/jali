/**
 * Markets: a Jali example. A simulated market of shares, bonds and currencies with real crypto prices from Kraken
 * (no keys or licences), eight kinds of pane, five desks, and a layout that lives in the address, so a desk is a link.
 */
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { createKrakenMarket } from "./market/kraken";
import { createSimulator } from "./market/simulator";
import { createServices } from "./services";
import { App } from "./shell/App";
import { createMarketsJali } from "./workspace";
// Styles: the layer order is declared in index.html. Then Jali's faces (Atkinson Hyperlegible Next and Mono), and
// the app's own, which import Jali's styles first.
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-500.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-400.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-500.css";
import "./styles/app.css";

// The same market all day for everyone: the seed is today's date.
const today = new Date();
const simulator = createSimulator({
  seed: today.getFullYear() * 1e4 + (today.getMonth() + 1) * 100 + today.getDate(),
});
simulator.run();

async function start() {
  // Real crypto prices from Kraken, over the simulated market.
  const market = createKrakenMarket(simulator);
  // The first quote of every pair, so nothing opens at zero; past a few seconds, open anyway and fill in.
  if (!(await market.ready()))
    setTimeout(() => toast("Kraken is slow to answer: crypto prices fill in as they arrive."), 500);
  const services = createServices(market, { feed: market.feed });
  const jali = createMarketsJali(services, { notify: (text) => toast(text) });
  services.trading.connect();
  createRoot(document.getElementById("root")!).render(<App jali={jali} services={services} />);
}

void start();
