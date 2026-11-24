/** The shop's recent activity: orders placed, paid, sent and refunded. */
import { PulseIcon } from "@phosphor-icons/react";
import { definePane } from "jali-layout/react";
import { activity } from "../data";
import { kindIcon } from "../ui/KindIcon";

function ActivityPane() {
  return (
    // Focusable, so a keyboard can scroll the feed when it runs longer than the pane.
    <ol className="live-k live-activity" tabIndex={0} aria-label="Activity">
      {activity.map((a, i) => (
        <li key={i} data-tone={a.tone}>
          <span className="live-activity-dot" aria-hidden />
          <span className="live-activity-text">
            <span>{a.text}</span>
            <time>{a.when}</time>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const activityKind = definePane("activity", {
  title: "Activity",
  icon: kindIcon(PulseIcon),
  width: { min: 170, comfortable: 220, max: 360 },
  height: { min: 140 },
  Component: ActivityPane,
});
