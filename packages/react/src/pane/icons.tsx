import { Square } from "lucide-react";
import { useEnv } from "../state/react";

/** The kind's icon (a square for an unknown kind), 1.5px stroke. */
export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const Icon = useEnv().kinds.get(kind)?.icon ?? Square;
  return <Icon size={size} strokeWidth={1.5} aria-hidden />;
}
