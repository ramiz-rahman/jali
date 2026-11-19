import type { Jali } from "@jali/core";
import { JaliRoot } from "@jali/react";
import { sprite } from "./my-icons";

// Three of Jali's icons, yours; the rest stay Phosphor's.
const icons = {
  close: sprite("x"),
  maximise: sprite("expand"),
  restore: sprite("collapse"),
};

export function App({ jali }: { jali: Jali }) {
  return <JaliRoot jali={jali} icons={icons} />;
}
