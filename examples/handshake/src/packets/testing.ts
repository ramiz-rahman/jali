/** For tests: a bundled capture once it has been generated, read and dissected. */
import { captureState, captureStore, loadCapture } from "./captures";
import type { Capture } from "./types";

export function ready(id: string): Promise<Capture> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const s = captureState(captureStore.get(), id);
      if (s.status === "ready") resolve(s.capture);
      else if (s.status === "failed" || s.status === "missing")
        reject(new Error(`${id}: ${s.status}`));
    };
    captureStore.subscribe(check);
    loadCapture(id);
    check();
  });
}
