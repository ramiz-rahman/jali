import { presetById, roleOf, titleOf, viewerLabel } from "@jali/core";
import { store } from "./store";

const { env } = store;
presetById(env, "orders")?.label;          // "Orders"
presetById(env, "missing")?.label;         // "Orders": an unknown id falls back to the first preset
viewerLabel(env.profile, true);            // the profile's full viewer, else "investigator"

const node = store.model().pane("order");
if (node) titleOf(env, node);              // "Order 1041", or the role's label in a curated page
if (env.profile) roleOf(env.profile, "borrower")?.label;
