import { useJaliIcons } from "../icons/context";
import { useEnv } from "../state/react";

/** The kind's icon, or the workspace's `defaultKind` icon (a square) for an unknown kind or one without an icon. */
export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const { defaultKind } = useJaliIcons();
  const Icon = useEnv().kinds.get(kind)?.icon ?? defaultKind;
  return <Icon size={size} aria-hidden />;
}
