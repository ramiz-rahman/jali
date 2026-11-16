import type { AdapterDividerProps } from "./types";

/** Keyboard-focus affordance: an accent capsule and a floating size label. Both are CSS-gated on :focus-visible. */
export function DividerHandle(p: Pick<AdapterDividerProps, "sizeA" | "total" | "labelA" | "labelB">) {
  return (
    <>
      <span className="divider-line" aria-hidden />
      <span className="divider-handle" aria-hidden />
      <span className="divider-tip" aria-hidden>
        {p.labelA} · {Math.round(p.sizeA)}px<i> | </i>{p.labelB} · {Math.round(p.total - p.sizeA)}px
      </span>
    </>
  );
}
