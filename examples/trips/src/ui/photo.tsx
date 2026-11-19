/**
 * A place's photo. The photos are files in public/photos (scripts/photos.mjs fetches them from Wikimedia Commons),
 * each in two widths, with its tone (the photo's average colour) shown until it loads, so a list of thumbnails
 * never flashes white. A photo of a made-up business is a stand-in, and says so in its credit.
 */
import { useId, useState, type CSSProperties } from "react";
import { InfoIcon, XIcon } from "@phosphor-icons/react";
import { photoOf, type PhotoInfo } from "../trip/photos";

// Vite's base ("./"), so the photos load from any path the built site is served at.
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "./";
const src = (p: PhotoInfo, size: "large" | "small") =>
  `${base}photos/${p.file}${size === "small" ? "-s" : ""}.webp`;
/** A place's photo's address, for code that draws outside React (the map's pins). */
export const photoSrc = (id: string, size: "large" | "small" = "small") => {
  const p = photoOf(id);
  return p ? src(p, size) : undefined;
};

export function Photo({
  id,
  size = "small",
  className,
  alt,
  credit = false,
  eager = false,
}: {
  /** A place's id, or a city cover ("cover-bkk"). */
  id: string;
  size?: "large" | "small";
  className?: string;
  /** Decorative by default (`""`): a thumbnail sits beside the place's name. A hero gives the photo's own. */
  alt?: string;
  /** Show the credit button on the photo. Every large photo with its credit visible somewhere should set this. */
  credit?: boolean;
  eager?: boolean;
}) {
  const p = photoOf(id);
  const [loaded, setLoaded] = useState(false);
  if (!p) return <span className={`photo photo-none ${className ?? ""}`} aria-hidden />;
  const style = { "--tone": p.tone, "--focus": p.focus ?? "50% 50%" } as CSSProperties;
  return (
    <span
      className={`photo ${className ?? ""}`}
      data-size={size}
      data-loaded={loaded || undefined}
      style={style}
    >
      <img
        src={src(p, size)}
        alt={alt ?? ""}
        width={p.w}
        height={p.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        // A cached image can finish before React attaches onLoad.
        ref={(img) => {
          if (img?.complete && img.naturalWidth) setLoaded(true);
        }}
      />
      {credit ? <Credit p={p} /> : null}
    </span>
  );
}

/** The ⓘ on a photo: who took it, its licence, and for a stand-in, what it shows instead. */
function Credit({ p }: { p: PhotoInfo }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="photo-credit-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Hide the photo's credit" : "Photo credit"}
        title="Photo credit"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {open ? (
          <XIcon size={14} weight="bold" aria-hidden />
        ) : (
          <InfoIcon size={16} weight="bold" aria-hidden />
        )}
      </button>
      <span id={id} className="photo-credit" hidden={!open}>
        {p.standIn ? <span className="photo-standin">{p.standIn}</span> : null}
        <span>
          Photo by {p.credit},{" "}
          <a href={p.licenseUrl ?? p.source} target="_blank" rel="noreferrer">
            {p.license}
          </a>
          , via{" "}
          <a href={p.source} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </span>
      </span>
    </>
  );
}
