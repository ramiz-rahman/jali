/**
 * Handshake: a Jali example. A network lab for your own network: measure your connection, read packets layer by
 * layer, map your Wi-Fi and the devices on it, probe any domain, and learn how it all works, with the lesson in
 * one pane and the tool it drives beside it. Built with CyberSpec's components, not the examples' usual kit.
 */
import { createRoot } from "react-dom/client";
import { App } from "./shell/app";
import { createHandshakeJali } from "./workspace";
// Faces: Rajdhani for the interface (CyberSpec's own first choice), JetBrains Mono for bytes, addresses and figures.
// Self-hosted, so the app makes no request to a font service. Then the app's styles, which import Jali's first.
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/app.css";

const jali = createHandshakeJali();
createRoot(document.getElementById("root")!).render(<App jali={jali} />);
