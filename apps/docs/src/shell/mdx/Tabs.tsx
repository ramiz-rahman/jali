/**
 * Tabs: a tab strip and one panel per tab, the first shown. A choice group (./choice.client.ts) switches them in the
 * browser (click, arrows, Home, End) and, for a named `group`, remembers the choice across the site.
 */
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { usePlainId } from "./text";

/**
 * A tab strip and its panels, in one element that is the choice group. Each tab is an option of the group and each
 * panel shows for its tab's label; `group` names a choice the site remembers ("pm", "framework").
 */
export function TabSet({
  label,
  tabs,
  group = "",
  className,
  panelClass,
}: {
  label: string;
  tabs: { label: string; panel: ReactNode }[];
  group?: string;
  className: string;
  panelClass?: string;
}) {
  const idBase = usePlainId();
  return (
    <div className={className} data-choice-group={group}>
      <div className="tab-strip" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            id={`${idBase}-tab-${i}`}
            aria-selected={i === 0}
            aria-controls={`${idBase}-panel-${i}`}
            tabIndex={i === 0 ? 0 : -1}
            className="tab"
            data-choice-option={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`${idBase}-panel-${i}`}
          aria-labelledby={`${idBase}-tab-${i}`}
          hidden={i !== 0}
          className={panelClass}
          data-choice-panel={t.label}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}

/** Tabs. `group` remembers the choice across the site ("pm" for package managers, "framework"). */
export function Tabs({ group, children }: { group?: string; children?: ReactNode }) {
  const tabs = Children.toArray(children)
    .filter(
      (c): c is ReactElement<{ label: string; children?: ReactNode }> =>
        isValidElement<{ label?: string }>(c) && typeof c.props.label === "string",
    )
    .map((t) => ({ label: t.props.label, panel: t.props.children }));
  return (
    <TabSet
      label={group === "pm" ? "Package manager" : "Choose one"}
      tabs={tabs}
      group={group}
      className="tabs"
      panelClass="tab-panel"
    />
  );
}

/** One tab of <Tabs>: its label, and what its panel holds. */
export function Tab({ children }: { label: string; children?: ReactNode }) {
  return <>{children}</>;
}
