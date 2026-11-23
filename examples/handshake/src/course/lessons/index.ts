/**
 * The course, in teaching order: layers first, because every later lesson reads headers; then the home network and
 * Wi-Fi you can scan today; then the transport and security lessons in the order a connection goes through them.
 */
import type { Lesson } from "../types";
import { bufferbloat } from "./bufferbloat";
import { dns } from "./dns";
import { encapsulation } from "./encapsulation";
import { homeNetwork } from "./home-network";
import { quic } from "./quic";
import { routing } from "./routing";
import { tcp } from "./tcp";
import { tls } from "./tls";
import { wifi } from "./wifi";

export const LESSONS: Lesson[] = [
  encapsulation,
  wifi,
  homeNetwork,
  dns,
  tcp,
  bufferbloat,
  tls,
  quic,
  routing,
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
