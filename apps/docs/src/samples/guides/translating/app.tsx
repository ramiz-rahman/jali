import { createJali } from "jali-layout";
import { JaliRoot } from "jali-layout/react";
import { orderKind, ordersKind } from "../../reference/kinds";
import { fr } from "./french";

// Pick the words when the instance is made: they are part of it, like its keys.
const jali = createJali({
  panes: [ordersKind, orderKind],
  layout: ordersKind(),
  messages: navigator.language.startsWith("fr") ? fr : undefined,
});

export const App = () => <JaliRoot jali={jali} />;
