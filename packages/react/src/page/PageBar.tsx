/** A curated page's bar: the view mode (Single or Split view), the investigation with its way back, and Reset. */
import { investigation } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import {
  bold,
  InstanceScope,
  Parts,
  useGeometry,
  useProfile,
  useStore,
  useUi,
} from "../state/react";

/**
 * A curated page's controls in the top bar: the mode (Single or Split view), the investigation (panes opened from
 * links) with its way back, and Reset for the split layout. Which views are on screen is the tabs' job.
 */
export function PageBar() {
  return (
    <InstanceScope>
      <PageBarOf />
    </InstanceScope>
  );
}

function PageBarOf() {
  const icon = useJaliIcons();
  const page = useUi((s) => s.page);
  const linkMode = useUi((s) => s.linkMode);
  const m = useGeometry();
  const store = useStore();
  const { messages } = store;
  const t = messages.page;
  const profile = useProfile();
  if (!profile || !page) return null;
  const opened = investigation(m.panes).length;
  const multi = page.mode === "split";
  const opens = linkMode === "open";
  return (
    <div className="jali-page-bar">
      {/* APG radio group: one tab stop (the checked mode), and the arrow keys move to the other and check it. Split
          view, when the page can't open one, stays focusable with its reason, and isn't checked. */}
      <div
        className="jali-seg jali-mode-switch"
        role="radiogroup"
        aria-label={t.viewMode}
        onKeyDown={(e) => {
          if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey)
            return;
          e.preventDefault();
          const other = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')].find(
            (r) => r !== e.target,
          );
          other?.focus();
          other?.click();
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!multi}
          tabIndex={multi ? -1 : 0}
          className="jali-seg-btn"
          onClick={() => store.run("page.setMode", "single")}
          title={t.singleTip}
        >
          <icon.singleView size={14} aria-hidden /> {t.single}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={multi}
          tabIndex={multi ? 0 : -1}
          className="jali-seg-btn"
          onClick={() => opens && store.run("page.setMode", "split")}
          aria-disabled={!opens || undefined}
          aria-description={opens ? undefined : t.splitTipLimited}
          title={opens ? t.splitTip : t.splitTipLimited}
        >
          <icon.splitView size={14} aria-hidden /> {t.split}
        </button>
      </div>
      {multi && opened ? (
        <div className="jali-inv" role="group" aria-label={t.openedLabel}>
          <span className="jali-inv-mark" aria-hidden />
          <span className="jali-inv-text">
            <Parts of={t.openedCount(opened, bold)} />
          </span>
          <button type="button" className="jali-inv-back" onClick={() => store.run("page.back")}>
            <icon.back size={13} aria-hidden /> {t.backTo(profile.name)}
          </button>
        </div>
      ) : null}
      {multi ? (
        <button
          type="button"
          className="jali-icon-btn jali-page-reset"
          onClick={() => store.run("page.reset")}
          aria-label={t.reset}
          title={t.resetTip}
        >
          <icon.reset size={15} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
