"use client";

import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

/** Pointer-based 3D tilt wrapper (adapted from motion-primitives `Tilt`). */
export function Tilt({
  rotationFactor = 8,
  reverse = false,
  children,
  className = "",
}: {
  rotationFactor?: number;
  reverse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ transform: string }>({ transform: "perspective(800px) rotateX(0deg) rotateY(0deg)" });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const sign = reverse ? -1 : 1;
    const rx = -py * rotationFactor * sign;
    const ry = px * rotationFactor * sign;
    setStyle({ transform: `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` });
  };

  const onLeave = () =>
    setStyle({ transform: "perspective(800px) rotateX(0deg) rotateY(0deg)" });

  return (
    <div
      ref={ref}
      className={`core-tilt ${className}`}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}

export default Tilt;
