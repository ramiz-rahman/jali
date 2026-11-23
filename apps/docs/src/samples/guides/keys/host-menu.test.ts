/** The commands guide's host menu renders on the server too: a store snapshot needs the server's as well. */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { createJali, memoryStorage } from "jali";
import { JaliRoot } from "jali/react";
import { HostCommandMenu } from "./host-menu";

it("renders on the server, listing Jali's commands", () => {
  const jali = createJali({
    panes: [{ kind: "note", title: "Note" }],
    layout: { kind: "note", params: {} },
    storage: memoryStorage(),
    moveFocus: false,
  });
  const html = renderToString(
    createElement(JaliRoot, { jali }, createElement(HostCommandMenu, { onClose() {} })),
  );
  expect(html).toContain("Maximise");
});
