import { useJaliIcons } from "../icons/context";
import { useEnv } from "../state/react";
import { ICON } from "../icons/sized";
import { Guard } from "../chrome/Guard";

/**
 * The kind's icon, or the workspace's `defaultKind` icon (a square) for an unknown kind or one without an icon. By
 * default it is a pane title's icon, sized by `--jali-icon-header` + 2px; pass `size` and `className` to draw it
 * elsewhere.
 */
export function KindIcon({
  kind,
  size,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  const { defaultKind } = useJaliIcons();
  const Icon = useEnv().kinds.get(kind)?.icon ?? defaultKind;
  const at = size === undefined ? ICON.title : { size, className: undefined };
  // A kind's icon is the app's code: one that throws draws nothing, and the pane stays.
  return (
    <Guard>
      <Icon size={at.size} className={className ?? at.className} aria-hidden />
    </Guard>
  );
}
