/**
 * Refs to the scan panes, built without importing the panes, so `scans` can open `wifi`, `devices` and `path`
 * while each of them can offer a way back to `scans`, with no import cycle.
 */
import type { ObjectRef } from "jali";
import type { ScanKind } from "./types";

export const scansRef: ObjectRef = { kind: "scans", params: {} };

export const scanRef = (kind: ScanKind, scan: string): ObjectRef => ({ kind, params: { scan } });
