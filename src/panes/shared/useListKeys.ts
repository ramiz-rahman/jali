import type { KeyboardEvent } from "react";

export function useListKeys(total: number, current: number, move: (index: number) => void) {
  return (event: KeyboardEvent): boolean => {
    let next: number;
    if (event.key === "j" || event.key === "ArrowDown") next = current + 1;
    else if (event.key === "k" || event.key === "ArrowUp") next = current < 0 ? 0 : current - 1;
    else return false;
    if (total) move(Math.max(0, Math.min(total - 1, next)));
    event.preventDefault();
    return true;
  };
}
