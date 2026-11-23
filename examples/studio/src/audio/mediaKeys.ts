/** The keyboard's and the system's media keys drive the transport, and the system shows what is playing. */
import { catalogueOf } from "../sessions/catalog";
import type { Engine } from "./engine";

/** Call once, at start-up. */
export function connectMediaKeys(engine: Engine) {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
  if (!ms) return;
  try {
    ms.setActionHandler("play", () => engine.play());
    ms.setActionHandler("pause", () => engine.pause());
    ms.setActionHandler("seekbackward", () => engine.skip(-5));
    ms.setActionHandler("seekforward", () => engine.skip(5));
  } catch {
    // a browser without these actions
  }
  engine.subscribe(() => {
    const s = engine.session();
    ms.playbackState = engine.get().playing ? "playing" : "paused";
    if (ms.metadata?.title !== s.title && typeof MediaMetadata !== "undefined")
      ms.metadata = new MediaMetadata({
        title: s.title,
        artist: catalogueOf(s).source,
        album: "Studio",
      });
  });
}
