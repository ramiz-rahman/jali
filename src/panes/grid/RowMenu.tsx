import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuState } from "./Grid";
import { keyHint } from "@jali/core";

export function RowMenu({ menu, onClose, onOpen, onPeek, id }: { menu: MenuState; onClose(): void; onOpen?: () => void; onPeek?: () => void; id: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const items: { label: string; hint?: string; run(): void }[] = [];
  if (onOpen) items.push({ label: "Open beside", hint: keyHint("Alt+Enter"), run: onOpen });
  if (onPeek) items.push({ label: "Peek", hint: "Space", run: onPeek });
  if (id !== null) items.push({ label: "Copy ID", run: () => { void navigator.clipboard?.writeText(id).catch(() => undefined); } });
  const [active, setActive] = useState(0);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", away, true); window.addEventListener("blur", onClose);
    return () => { window.removeEventListener("pointerdown", away, true); window.removeEventListener("blur", onClose); };
  }, [onClose]);
  const left = Math.max(4, Math.min(menu.x, window.innerWidth - 196)), top = Math.max(4, Math.min(menu.y, window.innerHeight - items.length * 30 - 16));
  const choose = (k: number) => { onClose(); items[k]?.run(); };
  return createPortal(
    <div ref={ref} className="pk-menu" role="menu" aria-label="Row actions" tabIndex={-1} style={{ left, top }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); onClose(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a + items.length - 1) % items.length); }
        else if (e.key === "Home") { e.preventDefault(); setActive(0); }
        else if (e.key === "End") { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
        else if (e.key === "Tab") { e.preventDefault(); onClose(); }
      }}>
      {items.map((it, k) => (
        <div key={it.label} role="menuitem" className="pk-menu-item" data-active={k === active} onPointerMove={() => setActive(k)} onClick={() => choose(k)}>
          <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
        </div>
      ))}
    </div>, document.body);
}
