/** The centre snap, with hysteresis: pulled in within SNAP_IN px of the centre, let go beyond SNAP_OUT. */
export const SNAP_IN = 10;
export const SNAP_OUT = 16;

/** Return the snapped value. The caller tracks whether the returned value equals centre. */
export function snapToCentre(value: number, centre: number, wasSnapped: boolean): number {
  return Math.abs(value - centre) <= (wasSnapped ? SNAP_OUT : SNAP_IN) ? centre : value;
}
