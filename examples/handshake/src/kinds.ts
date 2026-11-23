/**
 * Every pane kind, in the one list the workspace registers, by area: the course, the packet lab, the live
 * measurements, and the scans the person brings.
 */
import { bytes } from "./panes/bytes";
import { compare } from "./panes/compare";
import { connection } from "./panes/connection";
import { devices } from "./panes/devices";
import { glossary } from "./panes/glossary";
import { ladder } from "./panes/ladder";
import { layers } from "./panes/layers";
import { lesson } from "./panes/lesson";
import { lessons } from "./panes/lessons";
import { packet } from "./panes/packet";
import { packets } from "./panes/packets";
import { path } from "./panes/path";
import { probe } from "./panes/probe";
import { scans } from "./panes/scans";
import { wifi } from "./panes/wifi";

export const kinds = [
  lessons,
  lesson,
  glossary,
  packets,
  packet,
  bytes,
  layers,
  ladder,
  compare,
  connection,
  probe,
  scans,
  wifi,
  devices,
  path,
];
