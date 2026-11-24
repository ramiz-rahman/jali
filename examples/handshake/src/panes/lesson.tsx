/**
 * One lesson at one step. Reading a step moves the lab: the pane selects the step's target (a packet, a scan, a
 * probe), and the tool panes linked to it follow, so the explanation and the evidence stay side by side.
 *
 * The step is a pane param (`step`), so it is in the address and a link opens the lesson on the same step. The page
 * after the last step is the self-check. ←/→ move between pages while the lesson has focus; Jali's own keys all
 * carry ⌘ or Ctrl, so these bare arrows are the content's.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { GraduationCap } from "lucide-react";
import { definePane, useCommands, useJali, type PaneProps } from "jali-layout/react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { Collapsible } from "#src/vendor/cyberspec/components/ui/collapsible.tsx";
import { LESSONS, lessonById } from "#src/course/lessons/index.ts";
import { clampStep, isCheck, pagesOf } from "#src/course/pages.ts";
import { recordVisit } from "#src/course/progress.ts";
import { resolveTarget, type Resolved } from "#src/course/refs.ts";
import type { Lesson as LessonData, Step as StepData } from "#src/course/types.ts";
import { captureMark } from "#src/packets/captures.ts";
import { kindsOf, useLab, type Lab } from "./parts/lab";
import { InlineText, Prose } from "./parts/prose";
import { Empty, PaneBody } from "./parts/states";
import { glossary } from "./glossary";

const lessonParams = { id: String, step: Number };

function LessonView({
  params,
  node,
  select,
  openBeside,
  openHere,
  paused,
}: PaneProps<typeof lessonParams>) {
  const lab = useLab({ node, select, openBeside });
  const found = lessonById(params.id);
  if (!found) {
    return (
      <PaneBody>
        <Empty
          title={`There is no lesson called “${params.id}”`}
          action={
            <Button
              size="sm"
              onClick={() => openHere(lesson({ id: LESSONS[0]?.id ?? "", step: 0 }))}
            >
              Open the first lesson
            </Button>
          }
        >
          The course has {LESSONS.length} lessons: {LESSONS.map((l) => l.id).join(", ")}.
        </Empty>
      </PaneBody>
    );
  }
  return (
    <Step
      data={found}
      page={clampStep(params.step, pagesOf(found))}
      paused={paused}
      select={select}
      openHere={openHere}
      lab={lab}
    />
  );
}

interface StepProps {
  data: LessonData;
  page: number;
  paused: boolean;
  select: PaneProps["select"];
  openHere: PaneProps["openHere"];
  lab: Lab;
}

/** A step's target as a ref, or why it can't be shown. Steps are static data, so this is worked out once per step. */
const resolvedFor = (step: StepData | undefined): Resolved | undefined =>
  step?.show ? resolveTarget(step.show, captureMark) : undefined;

function Step({ data, page, paused, select, openHere, lab }: StepProps) {
  const root = useRef<HTMLDivElement>(null);
  const pages = pagesOf(data);
  const check = isCheck(data, page);
  const step = check ? undefined : data.steps[page];
  const resolved = useMemo(() => resolvedFor(step), [step]);

  // Reading a step is progress, and what the step shows is what the lab should show.
  useEffect(() => {
    if (paused) return;
    recordVisit(data.id, page);
    if (resolved?.ok) select(resolved.ref);
  }, [data.id, page, paused, resolved, select]);

  useEffect(() => {
    root.current?.scrollTo?.({ top: 0 });
  }, [data.id, page]);

  const go = (to: number) => {
    const next = Math.min(Math.max(0, to), pages - 1);
    if (next !== page) openHere(lesson({ id: data.id, step: next }));
  };

  const showTerm = (id: string) => lab.show(glossary({ term: id }));

  useCommands([
    {
      id: "next",
      title: "Next step",
      disabled: page >= pages - 1 ? "This is the last page" : false,
      run: () => go(page + 1),
    },
    {
      id: "previous",
      title: "Previous step",
      disabled: page <= 0 ? "This is the first step" : false,
      run: () => go(page - 1),
    },
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.key === "ArrowRight") go(page + 1);
    else if (e.key === "ArrowLeft") go(page - 1);
    else return; // not ours: let it bubble to Jali
    e.preventDefault();
  };

  const number = LESSONS.findIndex((l) => l.id === data.id) + 1;

  return (
    <div
      className="lesson"
      ref={root}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Lesson: ${data.title}`}
    >
      <header className="lesson-head">
        <p className="lesson-kicker">
          Lesson {number} · {data.minutes} min
        </p>
        <h2>{data.title}</h2>
        <p className="lesson-promise">{data.promise}</p>
        <ol className="lesson-dots" aria-label="Steps">
          {Array.from({ length: pages }, (_, i) => {
            const label = i === pages - 1 ? "Check yourself" : (data.steps[i]?.title ?? "");
            return (
              <li key={i}>
                <button
                  type="button"
                  className="lesson-dot"
                  aria-label={`${i === pages - 1 ? "" : `Step ${i + 1}: `}${label}`}
                  aria-current={i === page ? "step" : undefined}
                  data-seen={i < page ? "" : undefined}
                  onClick={() => go(i)}
                />
              </li>
            );
          })}
        </ol>
      </header>

      <article
        className="lesson-page"
        aria-labelledby="lesson-page-title"
        key={`${data.id}-${page}`}
      >
        <p className="lesson-count">
          {check ? "Self-check" : `Step ${page + 1} of ${data.steps.length}`}
        </p>
        <h3 id="lesson-page-title">{step ? step.title : "Check yourself"}</h3>
        {step ? (
          <>
            <Prose body={step.body} onTerm={showTerm} />
            {resolved ? <LabCard resolved={resolved} lab={lab} /> : null}
            {step.tryIt ? <TryIt tryIt={step.tryIt} lab={lab} onTerm={showTerm} /> : null}
          </>
        ) : (
          <Check lesson={data} onTerm={showTerm} />
        )}
      </article>

      {/* Two buttons and where you are. The ← and → keys are said on the buttons, not as a row of hints. */}
      <footer className="lesson-nav">
        <Button
          size="sm"
          tone="ghost"
          disabled={page === 0}
          onClick={() => go(page - 1)}
          aria-keyshortcuts="ArrowLeft"
          title="Previous (←)"
        >
          Previous
        </Button>
        <span className="lesson-where" aria-hidden>
          {page + 1} / {pages}
        </span>
        <Button
          size="sm"
          tone="primary"
          disabled={page === pages - 1}
          onClick={() => go(page + 1)}
          aria-keyshortcuts="ArrowRight"
          title="Next (→)"
        >
          {page === pages - 2 ? "Check yourself" : "Next"}
        </Button>
      </footer>
    </div>
  );
}

/** What the lab is showing for this step, and the way to put it there when nothing beside the lesson does. */
function LabCard({ resolved, lab }: { resolved: Resolved; lab: Lab }) {
  const jali = useJali();
  if (!resolved.ok) {
    return (
      <Alert tone="warning" title="This step’s evidence is not available">
        {resolved.why} The lesson still reads on its own.
      </Alert>
    );
  }
  return (
    <aside className="lesson-lab" aria-label="In the lab">
      <div>
        <Badge tone="signal">In the lab</Badge>
        <p>{kindsOf(jali).title(resolved.ref)}</p>
      </div>
      {lab.showing(resolved.ref) ? (
        <p className="lesson-lab-note">The panes beside this lesson are following it.</p>
      ) : (
        <Button size="sm" onClick={() => lab.show(resolved.ref)}>
          Show in the lab
        </Button>
      )}
    </aside>
  );
}

/** An invitation to do the same on the reader's own network, with the button that opens the pane for it. */
function TryIt({
  tryIt,
  lab,
  onTerm,
}: {
  tryIt: NonNullable<StepData["tryIt"]>;
  lab: Lab;
  onTerm: (id: string) => void;
}) {
  const jali = useJali();
  const resolved = resolveTarget(tryIt.open, captureMark);
  return (
    <aside className="lesson-try" aria-label="Try it on your network">
      <Badge tone="flag">Try it on your network</Badge>
      <p>
        <InlineText text={tryIt.text} onTerm={onTerm} />
      </p>
      {resolved.ok ? (
        <Button size="sm" tone="signal" onClick={() => lab.show(resolved.ref)}>
          Open {kindsOf(jali).title(resolved.ref)}
        </Button>
      ) : null}
    </aside>
  );
}

function Check({ lesson, onTerm }: { lesson: LessonData; onTerm: (id: string) => void }) {
  return (
    <ol className="lesson-check">
      {lesson.check.map((q, i) => (
        <li key={i}>
          <Prose body={[q.q]} onTerm={onTerm} />
          <Collapsible label="Show the answer">
            <Prose body={q.a} onTerm={onTerm} />
          </Collapsible>
        </li>
      ))}
    </ol>
  );
}

export const lesson = definePane("lesson", {
  params: lessonParams,
  title: ({ id }) => lessonById(id)?.title ?? "Lesson",
  icon: GraduationCap,
  width: { min: 340, comfortable: 560, max: 760 },
  height: { min: 260 },
  Component: LessonView,
});
