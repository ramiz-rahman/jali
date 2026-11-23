import * as React from "react"
import { Tabs as SdkTabs, TabsIndicator, TabsList, TabsPanel, TabsTab, TabsTabIcon } from "@ui-sdk/react/tabs"
import "#src/vendor/cyberspec/components/ui/cyber/side-tabs.css"

type SideTabSpec = {
  value: string
  /** The key's name: its aria-label always, and printed beside its icon when there's room. */
  label: string
  icon: React.ReactNode
  disabled?: boolean
  content: React.ReactNode
}

const two = (n: number) => String(n).padStart(2, "0")

// The sections of a database, as icon keys stacked down the leading edge
// with the open section's record beside them. Up and Down move between keys.
//
// A key is named by its `label` whether or not the label shows: in a narrow
// column the keys are icons only, and from about 420px wide each prints its
// name too. The record repeats the name as its heading either way, so the
// open section is never told by an icon alone.
function SideTabs({
  label,
  tabs,
  code = "ARCHIVE",
  ...props
}: Omit<React.ComponentProps<typeof SdkTabs>, "children" | "orientation"> & {
  label: string
  tabs: SideTabSpec[]
  /** The word that leads the line of micro-print over each record. */
  code?: string
}) {
  return (
    <SdkTabs data-kit="side-tabs" orientation="vertical" {...props}>
      <TabsList data-kit="side-tabs-list" aria-label={label}>
        {tabs.map((tab) => (
          <TabsTab
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            aria-label={tab.label}
            data-kit="side-tabs-tab"
            data-frame="tl br"
            data-press-flash=""
          >
            <TabsTabIcon data-kit="side-tabs-icon">{tab.icon}</TabsTabIcon>
            <span data-kit="side-tabs-name">{tab.label}</span>
          </TabsTab>
        ))}
        <TabsIndicator data-kit="side-tabs-indicator" />
      </TabsList>
      <div data-kit="side-tabs-body" data-frame="br">
        {tabs.map((tab, index) => (
          <TabsPanel key={tab.value} value={tab.value} data-kit="side-tabs-panel">
            <span data-micro aria-hidden>
              {code} // REC {two(index + 1)}/{two(tabs.length)}
            </span>
            {/* The panel is already named by its tab, so this copy of the
                name is for the eye only. */}
            <div data-kit="side-tabs-title" aria-hidden>
              {tab.label}
            </div>
            <div data-kit="side-tabs-content">{tab.content}</div>
          </TabsPanel>
        ))}
      </div>
    </SdkTabs>
  )
}

export { SideTabs }
export type { SideTabSpec }
