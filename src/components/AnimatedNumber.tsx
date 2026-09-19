"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Formats the tweened value for display. */
  format: (value: number) => string;
  className?: string;
  durationMs?: number;
}

/**
 * Smoothly tweens between numeric values (e.g. the balance). Uses rAF and
 * respects prefers-reduced-motion by snapping straight to the new value.
 */
export default function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 500,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setDisplay(t === 1 ? value : Math.round(current));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return (
    <span className={`tabular ${className ?? ""}`}>{format(display)}</span>
  );
}
