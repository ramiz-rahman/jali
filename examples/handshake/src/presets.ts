/**
 * The layouts to start from, in the top bar and in ⌘K as "Layout: …". The course comes first: the app opens on a
 * lesson with the tools it drives beside it.
 *
 * In each layout one pane is the list the others follow (`linkedTo` its id, `follows: true`): the lesson in the
 * course, the packet list in the lab, the Scans pane at home. The lesson is itself a follower of the outline.
 */
import { column, pane, row, tabs, type PresetOptions } from "jali";
import { LESSONS } from "./course/lessons";
import { resolveTarget } from "./course/refs";
import { captureMark } from "./packets/captures";
import { bytes } from "./panes/bytes";
import { connection } from "./panes/connection";
import { devices } from "./panes/devices";
import { ladder } from "./panes/ladder";
import { layers } from "./panes/layers";
import { lesson } from "./panes/lesson";
import { lessons } from "./panes/lessons";
import { packet } from "./panes/packet";
import { packets } from "./panes/packets";
import { followPacket } from "./panes/parts/capture";
import { path } from "./panes/path";
import { probe } from "./panes/probe";
import { scans } from "./panes/scans";
import { wifi } from "./panes/wifi";
import { SAMPLE_IDS } from "./scans/store";

/** Where the packet lab opens: the first packet of the TCP connection. */
const LAB = { capture: "tcp-lifecycle", n: 1 };

/**
 * The course opens on its first lesson, and its tools on the packet that lesson's first step shows. A follower that
 * already shows something keeps it when the layout arrives (the layout's word wins), so the layout has to agree
 * with the lesson from the start.
 */
const firstLesson = LESSONS[0];
const firstShown = firstLesson?.steps[0]?.show;
const firstRef = firstShown ? resolveTarget(firstShown, captureMark) : undefined;
const start = (firstRef?.ok ? followPacket(firstRef.ref) : undefined) ?? LAB;

const toLesson = { linkedTo: "lesson", follows: true } as const;
const toPackets = { linkedTo: "packets", follows: true } as const;
const toScans = { linkedTo: "scans", follows: true } as const;

export const presets: PresetOptions[] = [
  {
    id: "course",
    label: "Course",
    layout: row(
      pane(lessons(), { id: "course", weight: 0.75 }),
      pane(lesson({ id: firstLesson?.id ?? "", step: 0 }), {
        id: "lesson",
        linkedTo: "course",
        follows: true,
        weight: 1.5,
      }),
      // The evidence: the packet the step is about, and under it the conversation or its bytes, one at a time.
      column(
        { weight: 1.3 },
        pane(packet(start), { id: "packet", ...toLesson, weight: 1.1 }),
        tabs(
          pane(ladder({ capture: start.capture }), { id: "ladder", ...toLesson }),
          pane(bytes(start), { id: "bytes", ...toLesson }),
        ),
      ),
    ),
  },
  {
    id: "lab",
    label: "Packet lab",
    // The list gets the width it needs for one line a packet, with the conversation under it; the packet's
    // dissection beside them, and its bytes or layers under that, one at a time.
    layout: row(
      column(
        { weight: 1.6 },
        pane(packets({ capture: LAB.capture }), { id: "packets", weight: 1.4 }),
        pane(ladder({ capture: LAB.capture }), { id: "ladder", ...toPackets }),
      ),
      column(
        pane(packet(LAB), { id: "packet", ...toPackets, weight: 1.2 }),
        tabs(
          pane(bytes(LAB), { id: "bytes", ...toPackets }),
          pane(layers(LAB), { id: "layers", ...toPackets }),
        ),
      ),
    ),
  },
  {
    id: "connection",
    label: "Connection",
    layout: row(
      pane(connection(), { id: "connection", weight: 1.2 }),
      pane(probe({ domain: "cloudflare.com" }), { id: "probe" }),
    ),
  },
  {
    id: "home",
    label: "Home network",
    layout: row(
      pane(scans(), { id: "scans", weight: 0.85 }),
      column(
        { weight: 1.4 },
        pane(wifi({ scan: SAMPLE_IDS.wifi }), { id: "wifi", ...toScans, weight: 1.3 }),
        pane(devices({ scan: SAMPLE_IDS.devices }), { id: "devices", ...toScans }),
      ),
      pane(path({ scan: SAMPLE_IDS.path }), { id: "path", ...toScans, weight: 0.9 }),
    ),
  },
];
