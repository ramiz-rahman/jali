import { createJali } from "jali";
import { JaliRoot } from "jali/react";
import { orderKind, ordersKind } from "../../reference/kinds";
import { fr } from "./french";

// Pick the words when the workspace is made: they are part of it, like its keys.
const jali = createJali({
  panes: [ordersKind, orderKind],
  layout: ordersKind(),
  messages: navigator.language.startsWith("fr") ? fr : undefined,
});

export const App = () => <JaliRoot jali={jali} />;
