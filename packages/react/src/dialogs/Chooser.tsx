import { useMemo } from "react";
import { useJaliIcons } from "../icons/context";
import { mergeTargets, type MergeTarget } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { bold, Parts, useModel, useStore, useUi } from "../state/react";
import type { ChooseOptions, ChooserState } from "@jali/core/adapter";
import { ListDialog } from "./ListDialog";

/**
 * Jali's chooser. ⌘K "Add to tabs of…" (⌘K ⌘G): pick a visible pane or stack by title; the focused pane joins it as a
 * tab. And `jali.actions.choose`: pick one of the app's items for a command that asks for one ("Open chart for…").
 */
export function Chooser() {
  const chooser = useUi((s) => s.chooser);
  if (!chooser) return null;
  return chooser.kind === "merge" ? (
    <MergeDialog chooser={chooser} />
  ) : (
    <ChooseDialog request={chooser.request} />
  );
}

/** One of the app's items, with its words read once when the chooser opens. */
interface Choice {
  item: unknown;
  index: number;
  label: string;
  hint: string;
}

function ChooseDialog({ request }: { request: ChooseOptions<unknown> }) {
  const store = useStore();
  const all = useMemo(
    (): Choice[] =>
      request.items.map((item, index) => ({
        item,
        index,
        label: request.label(item),
        hint: request.hint?.(item) ?? "",
      })),
    [request],
  );
  const close = () => store.set({ chooser: null });
  const t = store.messages.chooser;
  return (
    <ListDialog<Choice>
      className="jali-chooser"
      dialog="chooser"
      label={request.title}
      head={<div className="jali-chooser-head">{request.title}</div>}
      placeholder={request.placeholder ?? t.choosePlaceholder}
      inputLabel={request.title}
      idPrefix={`${store.dom.id}-choose-`}
      listId={`${store.dom.id}-choose-list`}
      listLabel={t.chooseListLabel}
      items={all}
      keyOf={(c) => String(c.index)}
      matches={(c, q) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)}
      rank={(c, q) => (c.label.toLowerCase().startsWith(q) ? 0 : 1)}
      itemClass="jali-palette-item"
      render={(c) => (
        <>
          <span className="palette-title jali-palette-name">{c.label}</span>
          <span className="jali-palette-id jali-palette-hint">{c.hint}</span>
        </>
      )}
      onChoose={(c) => {
        close();
        // After the dialog unmounts and focus is back where it was, as a command run from ⌘K.
        setTimeout(() => request.onChoose(c.item), 0);
      }}
      onClose={close}
      empty={t.chooseEmpty}
    />
  );
}

function MergeDialog({ chooser }: { chooser: Extract<ChooserState, { kind: "merge" }> }) {
  const icon = useJaliIcons();
  const store = useStore();
  const m = useModel();
  // The targets as they were when the chooser opened.
  const all = useMemo(
    () => mergeTargets(store.snapshot(), chooser.source),
    [store, chooser.source],
  );
  const close = () => store.set({ chooser: null });
  const title = m.title(chooser.source);
  const t = store.messages.chooser;
  return (
    <ListDialog<MergeTarget>
      className="jali-chooser"
      dialog="chooser"
      label={t.label(title)}
      head={
        <div className="jali-chooser-head">
          <Parts of={t.heading(title, bold)} />
        </div>
      }
      placeholder={t.placeholder}
      inputLabel={t.inputLabel}
      idPrefix={`${store.dom.id}-merge-`}
      listId={`${store.dom.id}-chooser-list`}
      listLabel={t.listLabel}
      items={all}
      keyOf={(t) => t.id}
      matches={(t, q) => t.label.toLowerCase().includes(q)}
      itemClass="jali-palette-item jali-chooser-item"
      render={(t) => (
        <>
          <span className="jali-chooser-icon" aria-hidden>
            {m.stackOf(t.id) ? (
              <icon.addToTabs size={14} />
            ) : (
              <KindIcon kind={m.pane(t.id)?.ref.kind ?? ""} size={14} />
            )}
          </span>
          <span className="palette-title jali-palette-name">{t.label}</span>
          <span className="jali-palette-id jali-palette-hint">{t.hint}</span>
        </>
      )}
      onChoose={(t) => {
        close();
        // After the dialog unmounts and focus is back in the source pane.
        setTimeout(() => store.actions.mergeInto(chooser.source, t.id), 0);
      }}
      onClose={close}
      empty={t.empty}
    />
  );
}
