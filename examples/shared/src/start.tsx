/** Starts an app on the shared sample database and shell: Data Studio and Loan review differ only in their workspace. */
import { createRoot } from "react-dom/client";
import type { Jali } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { createDataLayer } from "./data";
import type { DataLayer } from "./data/types";
import { App } from "./shell/App";
import "./shell/styles/index.css";
import "@jali/react/styles.css";

/**
 * Mounts the app. `data` is the sample database, when the app made it first to read from it before its workspace
 * (Loan review's bindings); otherwise one is made here.
 */
export function start(jali: Jali, data: DataLayer = createDataLayer()) {
  // Right-to-left mode (`?dir=rtl`): the page reads right to left, as an Arabic or Hebrew app does. Jali follows the page.
  if (new URLSearchParams(location.search).get("dir") === "rtl")
    document.documentElement.dir = "rtl";

  void data.api.ready();

  // Dev-only handle so e2e can drive activity states (the sample panes rarely report them): the engine's steps.
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
    (window as unknown as { __jali?: unknown }).__jali = { actions: storeOf(jali).actions };

  const root = document.getElementById("root");
  if (!root) throw new Error("The page has no #root to mount the app in");
  createRoot(root).render(<App jali={jali} data={data} />);
}
