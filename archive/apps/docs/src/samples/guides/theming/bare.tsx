import type { Jali } from "@jali/core";
// The bare entry never imports Phosphor, so it stays out of your bundle.
import { JaliRoot } from "@jali/react/bare";
import { myIcons } from "./my-icons";

export function App({ jali }: { jali: Jali }) {
  return <JaliRoot jali={jali} icons={myIcons} />;
}
