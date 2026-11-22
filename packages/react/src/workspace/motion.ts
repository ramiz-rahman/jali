import { useEffect, useRef, useState } from "react";

/** True from the commit that carries a reshape until its slide has played (layout stability, state/apply.ts). The class
 *  lands in the same commit as the new rects, so panes slide from where they were. */
export function useReshapeMotion(reshapes: number): boolean {
  const seen = useRef(reshapes);
  const [playing, setPlaying] = useState(false);
  const fresh = reshapes !== seen.current;
  // Keyed on the reshape alone: the render after it (no longer fresh) must not clear the timer that ends it.
  useEffect(() => {
    if (reshapes === seen.current) return;
    seen.current = reshapes;
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), 220);
    return () => clearTimeout(t);
  }, [reshapes]);
  return fresh || playing;
}
