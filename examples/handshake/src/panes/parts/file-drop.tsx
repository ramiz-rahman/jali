/**
 * Opening files from the person's machine, by a button's file picker or by dropping them on a pane. The packet list
 * opens captures with it and the Scans pane opens scan output; the files are read in this tab and go nowhere.
 */
import { useRef, useState, type DragEvent, type ReactNode } from "react";

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

export interface FileDrop {
  /** Opens the file picker. */
  pick: () => void;
  /** The hidden input the picker needs: render it once, anywhere in the pane. */
  input: ReactNode;
  /** Spread on the element files are dropped on. `data-dragging` is set while files are over it. */
  dropProps: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    "data-dragging": "" | undefined;
  };
}

export function useFileDrop({
  accept,
  multiple = false,
  label,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  /** What the hidden input is called, for assistive technology that finds it anyway. */
  label: string;
  onFiles: (files: File[]) => void;
}): FileDrop {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return {
    pick: () => ref.current?.click(),
    input: (
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          take(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    ),
    dropProps: {
      onDragOver: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      },
      // Leaving a child of the drop target is not leaving the target.
      onDragLeave: (e) => {
        if (e.currentTarget === e.target) setDragging(false);
      },
      onDrop: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      },
      "data-dragging": dragging ? "" : undefined,
    },
  };
}
