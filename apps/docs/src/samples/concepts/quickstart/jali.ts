import { createJali } from "jali-layout";
import { defaultFeatures } from "jali-layout/features";
import { note } from "./note";

export const jali = createJali({
  panes: [note],
  layout: note({ id: 1 }),
  features: defaultFeatures(),
});
