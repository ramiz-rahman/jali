import { splitterAria, type AdapterDividerProps, type DividerAdapter } from "./types";

/** Our own APG window splitter: one absolutely positioned element in the gap. No library, no ghost group. */
function OwnDivider(p: AdapterDividerProps) {
  return (
    <div
      className={p.className}
      data-divider={p.dividerKey}
      style={{ position: "absolute", left: p.rect.x, top: p.rect.y, width: p.rect.width, height: p.rect.height }}
      onPointerDown={p.onPointerDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        p.onReset();
      }}
      onKeyDown={p.onKeyDown}
      {...splitterAria(p)}
    >
      <span className="divider-line" aria-hidden />
    </div>
  );
}

export const ownAdapter: DividerAdapter = { id: "own", label: "Own APG separator (no library)", Divider: OwnDivider };
