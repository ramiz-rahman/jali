import { useEffect, useRef } from "react";

export function useFocusWhen<T extends HTMLElement>(focused: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (focused && !ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
  }, [focused]);
  return ref;
}
