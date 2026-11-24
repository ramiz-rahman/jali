/** A numbered path: <Steps><Step title="Install">…</Step></Steps>. Each step's title is a heading in "On this page". */
import type { ReactNode } from "react";
import { heading } from "./Heading";

export function Steps({ children }: { children?: ReactNode }) {
  return <ol className="steps">{children}</ol>;
}

const StepHeading = heading(3);

export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="step">
      <StepHeading className="heading step-title">{title}</StepHeading>
      <div className="step-body">{children}</div>
    </li>
  );
}
