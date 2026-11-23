/** Phones have no rail: a "N waiting" button in the header opens the queue as a sheet. Hidden from 768px up. */
import { useRef, useState } from "react";
import { FunnelSimpleIcon, XIcon } from "@phosphor-icons/react";
import { IconButton, useJali } from "jali/react";
import { QueueRail } from "./rail";
import { useQueue } from "./use-queue";

export function QueueSheet({ item }: { item: number }) {
  const { page } = useJali();
  const { waiting } = useQueue();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  return (
    <>
      <button
        ref={btn}
        className="item-queue"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <FunnelSimpleIcon size={14} aria-hidden /> <span className="pk-mono">{waiting}</span>{" "}
        waiting
      </button>
      {open ? (
        <div
          className="queue-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Queue"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <IconButton className="queue-sheet-close" label="Close queue" onClick={close} autoFocus>
            <XIcon size={16} aria-hidden />
          </IconButton>
          <QueueRail
            sheet
            item={item}
            showItem={(i) => {
              page?.showItem(i);
              close();
            }}
          />
        </div>
      ) : null}
    </>
  );
}
