import { createRoot } from "react-dom/client";
import { Jali, JaliView } from "@jali/react";
import "@jali/react/styles.css";
import "./app.css";
import { store } from "./store";

createRoot(document.getElementById("root")!).render(
  <Jali store={store} className="app">
    <JaliView />
  </Jali>,
);
