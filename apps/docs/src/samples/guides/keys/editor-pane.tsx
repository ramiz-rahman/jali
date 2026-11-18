import { definePaneKind, type PaneComponentProps } from "@jali/react";

/**
 * An editor needs every key, so it marks itself: inside it, the workspace takes only F6 and Shift+F6, so focus can
 * always leave. Here ⌘K goes to the editor and does not open the palette.
 */
function ReplyEditor({ ref }: PaneComponentProps) {
  return (
    <div data-pane-keys="content" className="reply-editor">
      <textarea aria-label={`Reply to ticket ${ref.params.id}`} />
    </div>
  );
}

export const replyKind = definePaneKind({
  kind: "reply",
  title: (ref) => `Reply to ticket ${ref.params.id}`,
  ref: (params) => ({ kind: "reply", params }),
  minWidth: 360,
  minHeight: 220,
  Component: ReplyEditor,
});
