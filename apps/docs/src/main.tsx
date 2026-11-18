import { createRoot } from "react-dom/client";
import { App } from "./shell/App";
import "@jali/react/styles.css";
import "./styles/site.css";

createRoot(document.getElementById("root")!).render(<App />);
