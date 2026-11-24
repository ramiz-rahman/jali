/**
 * Images in pages (`![alt](/media/…)`), rendered at build time with their size, so nothing moves when they load,
 * and loaded lazily. An SVG diagram is placed inline instead, so it can draw with the site's tokens. A GIF with a
 * video beside it (`x.mp4`, and `x.webp` as its first frame) is shown as that video: about a sixth of the bytes,
 * nothing loaded until it plays, and a pause button (./media.client.ts plays it while it is on screen, unless the
 * reader prefers reduced motion). The GIF stays for the Markdown copies.
 * Make the video with `ffmpeg -i x.gif -movflags +faststart -pix_fmt yuv420p -c:v libx264 -crf 26 -an x.mp4`.
 */
import { readFileSync } from "node:fs";
import type { ComponentPropsWithoutRef } from "react";
import { publicFile } from "../../ui/lib/public-files";

/** Width and height from a GIF's, PNG's or SVG's own header. */
function sizeOf(file: string): { width: number; height: number } | undefined {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 3) === "GIF")
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.toString("ascii", 1, 4) === "PNG")
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (file.endsWith(".svg")) {
    const box = /viewBox="[\d.]+[\s,]+[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(b.toString("utf8"));
    if (box) return { width: Number(box[1]), height: Number(box[2]) };
  }
  return undefined;
}

export function MediaImage({ src = "", alt = "", ...rest }: ComponentPropsWithoutRef<"img">) {
  const file = publicFile(src);
  const size = file ? sizeOf(file) : undefined;
  const base = src.replace(/\.gif$/, "");
  if (file && src.endsWith(".gif") && publicFile(`${base}.mp4`))
    return (
      <video
        className="media-video"
        src={`${base}.mp4`}
        poster={publicFile(`${base}.webp`) ? `${base}.webp` : undefined}
        width={size?.width}
        height={size?.height}
        aria-label={alt}
        controls
        muted
        loop
        playsInline
        preload="none"
        data-autoplay=""
      >
        <a href={src}>{alt}</a>
      </video>
    );
  // A diagram is placed inline, so it draws with the site's tokens and follows light and dark. It is one image to
  // assistive technology: the wrapper is named by the alt text, and the drawing inside is hidden.
  if (file && src.endsWith(".svg")) {
    const svg = readFileSync(file, "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<title>[\s\S]*?<\/title>/, "")
      .replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
    return (
      <span
        className="media-svg"
        role="img"
        aria-label={alt}
        style={size ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size?.width}
      height={size?.height}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}
