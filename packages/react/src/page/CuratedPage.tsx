import { useCallback } from "react";
import type { ItemId } from "@jali/core";
import { InstanceScope, useProfile, useStore, useUi } from "../state/react";
import { Panes } from "../workspace/Workspace";
import { Guard } from "../chrome/Guard";
import { PageTabs } from "./PageTabs";

/** The curated page: the queue at the left; the item's header, its tabs and the panes at the right. */
export function CuratedPage() {
  return (
    <InstanceScope>
      <CuratedPageOf />
    </InstanceScope>
  );
}

function CuratedPageOf() {
  const p = useProfile()!;
  const item = useUi((s) => s.page!.item);
  const store = useStore();
  const showItem = useCallback((item: ItemId) => void store.run("page.showItem", item), [store]);
  return (
    <div className="jali-page">
      {p.Rail && (
        <Guard>
          <p.Rail item={item} showItem={showItem} />
        </Guard>
      )}
      <div className="jali-page-main">
        <Guard>
          <p.Header item={item} />
        </Guard>
        <PageTabs />
        <Panes />
      </div>
    </div>
  );
}
