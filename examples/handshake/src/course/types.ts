/**
 * The shapes the course is written in. A lesson is typed data, and course.test.ts checks that every step points
 * at a capture, mark, term or scan that exists, so the panes need no parsing of their own.
 */

import type { ObjectRef } from "jali";

/** A packet of a bundled capture, named by its mark ("syn-ack"), so a regenerated capture keeps the lesson right. */
export interface PacketMark {
  capture: string;
  mark: string;
}

/** What a step puts in the lab beside the lesson: a packet by its mark, or any pane's ref, as Jali selects it. */
export type Target = PacketMark | ObjectRef;

export interface Step {
  title: string;
  /**
   * The prose, one entry per block: a paragraph, a list (every line starting "- "), or a code block (fenced with
   * three backticks). Inline: `code`, *emphasis*, **strong**, [[term]] and [[term|label]] (see markup.ts).
   */
  body: string[];
  /** What the lab shows while this step is open. Without it the lab stays where it was. */
  show?: Target;
  /** An invitation to do the same on the reader's own network, with the pane that makes it possible. */
  tryIt?: { text: string; open: Target };
}

export interface Question {
  q: string;
  /** The answer, shown on demand: blocks as in a step's body. */
  a: string[];
}

export interface Lesson {
  id: string;
  title: string;
  /** One line: what you can do after it. */
  promise: string;
  minutes: number;
  steps: Step[];
  /** Two to four questions, after the last step. */
  check: Question[];
}

export interface Term {
  /** The slug a [[link]] uses. */
  id: string;
  /** How it is written and shown. */
  term: string;
  /** One to three sentences, in the same inline markup as a step. */
  def: string;
  /** Ids of terms to read next. */
  related?: string[];
  /** The standard that defines it: "RFC 9293 §3.4", "IEEE 802.11-2020". */
  ref?: string;
}
