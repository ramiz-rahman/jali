import { createRoot } from "react-dom/client";
import { boot, startUi } from "@jali/core";
import { Jali, JaliView } from "@jali/react";
import "@jali/react/styles.css";
import { store } from "./store";

boot(store);                    // the address's layout, fitted, before the first render
const stop = startUi(store);    // keyboard, Back and Forward, theme, saving

createRoot(document.getElementById("root")!).render(
  <Jali store={store} className="app">
    <JaliView />
  </Jali>,
);

// Tests and hot reload: remove the listeners again.
if (import.meta.hot) import.meta.hot.dispose(stop);
