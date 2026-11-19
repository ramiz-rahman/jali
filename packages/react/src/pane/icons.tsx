import { SquareIcon } from "@phosphor-icons/react";
import { useEnv } from "../state/react";

/** The kind's icon (a square for an unknown kind), Phosphor's regular weight unless the host's IconContext says otherwise. */
export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const Icon = useEnv().kinds.get(kind)?.icon ?? SquareIcon;
  return <Icon size={size} aria-hidden />;
}
