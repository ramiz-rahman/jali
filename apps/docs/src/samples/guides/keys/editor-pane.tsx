import { definePane } from "jali/react";

/**
 * An editor needs every key, so it marks itself: inside it, the workspace takes only F6 and Shift+F6, so focus can
 * always leave. Here ⌘K goes to the editor and does not open the palette.
 */
export const replyKind = definePane("reply", {
  params: { id: Number },
  title: ({ id }) => `Reply to ticket ${id}`,
  width: { min: 360 },
  height: { min: 220 },

  Component: ({ params }) => (
    <div data-pane-keys="content" className="reply-editor">
      <textarea aria-label={`Reply to ticket ${params.id}`} />
    </div>
  ),
});
