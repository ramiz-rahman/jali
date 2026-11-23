/**
 * The course outline: the lessons in order, with how far the person has read. Moving down the list (J/K or the
 * arrows) selects a lesson, and a lesson pane beside it follows, opening on the step the person was last on.
 */
import { useEffect, type KeyboardEvent } from "react";
import { GraduationCap } from "lucide-react";
import { definePane, useJaliState, type PaneProps } from "jali/react";
import { ItemList } from "#src/vendor/cyberspec/components/ui/item-list.tsx";
import { Progress } from "#src/vendor/cyberspec/components/ui/progress.tsx";
import { LESSONS, lessonById } from "#src/course/lessons/index.ts";
import { coursePercent, firstOpen, pagesOf, pagesRead, resume } from "#src/course/pages.ts";
import { progressStore, type Progress as Read } from "#src/course/progress.ts";
import type { Lesson } from "#src/course/types.ts";
import { listMove } from "./parts/list-keys";
import { PaneBody } from "./parts/states";
import { useStore } from "./parts/use-store";
import { lesson } from "./lesson";

/** The lesson pane for `l`, on the page the person was last on. */
const resumed = (progress: Read, l: Lesson) => lesson({ id: l.id, step: resume(progress, l) });

function Lessons({ node, select, openBeside }: PaneProps) {
  const progress = useStore(progressStore);
  // The cursor is on the lesson Jali has selected: it starts here on what a following lesson shows (`selects`).
  const selected = useJaliState((s) => s.selection[node.id]?.ref);
  const current = selected?.kind === "lesson" ? lessonById(String(selected.params.id)) : undefined;

  // Nothing selected and nothing following to start from: begin where the person left off. Only the first render
  // decides; later progress must not move the cursor, so progress is read here, not depended on.
  useEffect(() => {
    if (current) return;
    const start = firstOpen(progressStore.get());
    if (start) select(resumed(progressStore.get(), start));
  }, [current, select]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && e.altKey && current) {
      openBeside(resumed(progress, current));
      e.preventDefault();
      return;
    }
    const to = listMove(
      e,
      LESSONS.findIndex((l) => l === current),
      LESSONS.length,
    );
    const next = to === null ? undefined : LESSONS[to];
    if (!next) return; // not ours: let it bubble to Jali
    select(resumed(progress, next));
    e.preventDefault();
  };

  return (
    <PaneBody className="lessons">
      <div
        className="lessons-body"
        onKeyDown={onKeyDown}
        title="J and K move through the lessons; ⌥↵ opens one beside"
      >
        <Progress label="Your progress" variant="thin" value={coursePercent(progress)} />
        <ItemList
          label="Lessons"
          activation="automatic"
          value={current?.id ?? null}
          onValueChange={(v) => {
            const next = lessonById(String(v));
            if (next && next !== current) select(resumed(progress, next));
          }}
          items={LESSONS.map((l) => {
            const read = pagesRead(progress, l);
            return {
              value: l.id,
              label: l.title,
              meta: `${l.minutes} min · ${l.steps.length} steps${read ? ` · ${read}/${pagesOf(l)} read` : ""}`,
            };
          })}
        />
      </div>
    </PaneBody>
  );
}

export const lessons = definePane("lessons", {
  title: "Course",
  icon: GraduationCap,
  selects: "lesson",
  width: { min: 280, comfortable: 380 },
  height: { min: 260 },
  Component: Lessons,
});
