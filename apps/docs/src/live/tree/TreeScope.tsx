/**
 * Around a figure's tree panels: they render in the browser only, read the workspace beside them through its Jali,
 * and draw a divider drag as it happens.
 */
import type { ReactNode } from "react";
import type { JaliStore } from "jali/adapter";
import type { Rect } from "jali";
import { ClientOnly } from "../workspace/ClientOnly";
import { JaliProvider } from "../workspace/jali-gaps";
import { PreviewRects } from "./nodes";

export function TreeScope({
  store,
  preview,
  children,
}: {
  store: JaliStore;
  preview: Record<string, Rect> | null;
  children: ReactNode;
}) {
  return (
    <ClientOnly>
      <JaliProvider jali={store.jali}>
        <PreviewRects.Provider value={preview}>{children}</PreviewRects.Provider>
      </JaliProvider>
    </ClientOnly>
  );
}
