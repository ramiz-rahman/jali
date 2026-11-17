import { Square } from "lucide-react";
import { getPaneKind } from "../pane-kinds";

/** The kind's icon (a square for an unknown kind), 1.5px stroke. */
export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const Icon = getPaneKind(kind)?.icon ?? Square;
  return <Icon size={size} strokeWidth={1.5} aria-hidden />;
}
