import type { Jali } from "@jali/core";
import { JaliRoot } from "@jali/react";
import { sprite } from "./my-icons";

// Replace a few of Jali's icons; the rest stay Phosphor's.
export function App({ jali }: { jali: Jali }) {
  return (
    <JaliRoot
      jali={jali}
      icons={{ close: sprite("x"), maximise: sprite("expand"), restore: sprite("collapse") }}
    />
  );
}
