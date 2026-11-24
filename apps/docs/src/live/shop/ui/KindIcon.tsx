/**
 * A kind's icon in a small circle tinted with its pane's colour (`--live-id`, set on the pane, its tab, its shelf chip
 * and its map box), so the workspace and the map mark a pane the same way. Outside the live parts it falls back to
 * a neutral circle.
 */
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

export function KindIcon({
  icon: Icon,
  size: given = 16,
}: {
  icon: PhosphorIcon;
  size?: number | string;
}) {
  // Jali passes a number; a string such as "16" or "16px" is read as pixels.
  const size = typeof given === "number" ? given : parseFloat(given) || 16;
  return (
    <span className="live-kind" style={{ width: size + 8, height: size + 8 }} aria-hidden>
      <Icon size={size - 2} aria-hidden />
    </span>
  );
}

/** A kind's `icon`: Jali renders it with a size; this draws the kind's Phosphor icon circled at that size. */
export const kindIcon = (icon: PhosphorIcon) => {
  const Circled = ({ size }: { size?: number | string }) => <KindIcon icon={icon} size={size} />;
  Circled.displayName = `KindIcon(${icon.displayName ?? "icon"})`;
  return Circled;
};
