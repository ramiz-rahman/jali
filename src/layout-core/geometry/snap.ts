/** Return the snapped value. The caller tracks whether the returned value equals centre. */
export function snapToCentre(value: number, centre: number, wasSnapped: boolean): number {
  return Math.abs(value - centre) <= (wasSnapped ? 16 : 10) ? centre : value;
}
