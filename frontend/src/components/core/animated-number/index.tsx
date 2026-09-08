"use client";

import { useEffect, useRef, useState } from "react";

/** Eased count-up number (setInterval-based so tests can advance fake timers). */
export function AnimatedNumber({
  value,
  className = "",
  springOptions,
}: {
  value: number;
  className?: string;
  springOptions?: { bounce?: number; duration?: number };
}) {
  const duration = springOptions?.duration ?? 1200;
  const previous = useRef(0);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    if (from === to) {
      return;
    }
    const step = 16;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += step;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t >= 1) {
        previous.current = to;
        window.clearInterval(timer);
      }
    }, step);
    return () => window.clearInterval(timer);
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

export default AnimatedNumber;
