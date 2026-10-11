"use client";

/**
 * The width of a container, kept current with a ResizeObserver, so charts
 * draw at their real pixel size (readable text at 390 px) rather than
 * scaling a fixed viewBox down.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useWidth(
  initial = 640,
): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(initial);
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    obs.current?.disconnect();
    if (!el || typeof ResizeObserver === "undefined") return;
    setW(Math.max(260, Math.floor(el.getBoundingClientRect().width)));
    obs.current = new ResizeObserver((e) => {
      const cw = e[0]?.contentRect.width;
      if (cw) setW(Math.max(260, Math.floor(cw)));
    });
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [ref, w];
}
