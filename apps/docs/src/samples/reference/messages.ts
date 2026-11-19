import { createJali, en, type MessageOverrides } from "@jali/core";
import { orderKind } from "./kinds";

const words: MessageOverrides = {
  commands: { close: "Close tab" },
  tabs: { close: (pane) => `Close ${pane} tab` },
};
const jali = createJali({ panes: [orderKind], layout: orderKind({ id: 1 }), messages: words });

jali.messages.commands.close; // "Close tab"
jali.messages.commands.zoom; // "Maximise or restore pane", from `en`
en.announcements.closed("Order 1041"); // "Order 1041 closed · Undo available"
