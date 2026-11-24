/**
 * Videos in pages (./media.tsx: `video[data-autoplay]`, a GIF shown as its video) play while on screen, unless the
 * reader prefers less motion; their controls can pause them, and a video the reader paused stays paused.
 */
import { all } from "../../client/dom";

export function initVideos() {
  const videos = all<HTMLVideoElement>("video[data-autoplay]");
  if (!videos.length || !("IntersectionObserver" in window)) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paused = new WeakSet<HTMLVideoElement>();
  for (const v of videos) {
    v.addEventListener("pause", () => {
      if (v.isConnected && !document.hidden && v.dataset.auto !== "pausing") paused.add(v);
      delete v.dataset.auto;
    });
    v.addEventListener("play", () => paused.delete(v));
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !still.matches && !paused.has(v)) void v.play().catch(() => {});
        else if (!e.isIntersecting && !v.paused) {
          v.dataset.auto = "pausing";
          v.pause();
        }
      }
    },
    { threshold: 0.5 },
  );
  for (const v of videos) io.observe(v);
}
