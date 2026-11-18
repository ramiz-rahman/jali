import { installKeyboard } from "@jali/core";
import { store } from "./store";

// Two workspaces on one page: each takes only keys from inside its own root.
const stop = installKeyboard(store, { root: () => document.querySelector("#orders-workspace") });

// Later (a test, hot reload, the workspace closing):
stop();
