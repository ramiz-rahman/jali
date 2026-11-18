import { useMemo } from "react";
import { Layers } from "lucide-react";
import { mergeTargets, type MergeTarget } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { useModel, useStore, useUi } from "../state/react";
import type { ChooserState } from "@jali/core/adapter";
import { ListDialog } from "./ListDialog";

/** ⌘K "Add to tabs of…" (⌘K ⌘G): pick a visible pane or stack by title; the focused pane joins it as a tab. */
export function Chooser() {
  const chooser = useUi((s) => s.chooser);
  return chooser ? <ChooserDialog chooser={chooser} /> : null;
}

function ChooserDialog({ chooser }: { chooser: ChooserState }) {
  const store = useStore();
  const m = useModel();
  // The targets as they were when the chooser opened.
  const all = useMemo(() => mergeTargets(store.snapshot(), chooser.source), [store, chooser.source]);
  const close = () => store.set({ chooser: null });
  const title = m.title(chooser.source);
  return (
    <ListDialog<MergeTarget>
      className="jali-chooser"
      label={`Add ${title} to tabs of`}
      head={<div className="jali-chooser-head">Add <b>{title}</b> to the tabs of…</div>}
      placeholder="Pane or stack"
      inputLabel="Pane or stack"
      idPrefix="merge-"
      listId="chooser-list"
      listLabel="Panes and stacks"
      items={all}
      keyOf={(t) => t.id}
      matches={(t, q) => t.label.toLowerCase().includes(q)}
      itemClass="jali-palette-item jali-chooser-item"
      render={(t) => (
        <>
          <span className="jali-chooser-icon" aria-hidden>
            {m.stackOf(t.id) ? <Layers size={14} strokeWidth={1.5} /> : <KindIcon kind={m.pane(t.id)?.ref.kind ?? ""} size={14} />}
          </span>
          <span className="palette-title">{t.label}</span>
          <span className="jali-palette-id">{t.hint}</span>
        </>
      )}
      onChoose={(t) => {
        close();
        // After the dialog unmounts and focus is back in the source pane.
        setTimeout(() => store.actions.mergeInto(chooser.source, t.id), 0);
      }}
      onClose={close}
      empty={(q) => <>No pane or stack matches “{q}”.</>}
    />
  );
}
