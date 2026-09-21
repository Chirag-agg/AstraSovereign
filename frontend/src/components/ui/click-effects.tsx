"use client";

import * as React from "react";

/**
 * Click Effects — the pointer layer.
 *
 * A surveying instrument rather than a sparkle: a thin crosshair tracks the
 * pointer, and every click drops a ranging ring, four ticks and a coordinate
 * readout that decays. It is the same visual grammar as the rest of the
 * product — hairlines, mono numerals, signal orange for live state.
 *
 * Built here because the Originkit CLI could not run in this environment; the
 * mount point (one component at the root of the tree) matches the original.
 *
 * Everything is a CSS animation on an absolutely-positioned element inside a
 * `contain: strict` layer, removed on animationend. No rAF loop, no canvas,
 * nothing retained. Disabled outright for coarse pointers and for anyone who
 * asked for reduced motion.
 */

interface Burst {
  id: number;
  x: number;
  y: number;
  label: string;
}

const RING_PX = 74;
const MAX_LIVE = 6;

export function ClickEffects({ enabled = true }: { enabled?: boolean }) {
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const [active, setActive] = React.useState(false);
  const crosshair = React.useRef<HTMLDivElement>(null);
  const seq = React.useRef(0);

  // Both hooks must run on every render — `&&` would short-circuit the second
  // one on the first pass (finePointer starts false) and change the hook order.
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const allowed = enabled && finePointer && !reducedMotion;

  React.useEffect(() => {
    if (!allowed) return;

    const move = (event: PointerEvent) => {
      const node = crosshair.current;
      if (!node) return;
      node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      if (!node.classList.contains("is-live")) node.classList.add("is-live");
    };

    const leave = () => crosshair.current?.classList.remove("is-live");

    const down = (event: PointerEvent) => {
      // Ignore synthetic clicks (keyboard activation reports 0,0).
      if (event.clientX === 0 && event.clientY === 0) return;
      const id = ++seq.current;
      const label = `${Math.round(event.clientX)}·${Math.round(event.clientY)}`;
      setBursts((current) => [...current.slice(-(MAX_LIVE - 1)), { id, x: event.clientX, y: event.clientY, label }]);
      window.setTimeout(() => {
        setBursts((current) => current.filter((b) => b.id !== id));
      }, 940);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerleave", leave);
    setActive(true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerleave", leave);
    };
  }, [allowed]);

  if (!allowed) return null;

  return (
    <>
      <div ref={crosshair} className="ok-crosshair" aria-hidden="true" />
      <div className="ok-cursor-layer" aria-hidden="true">
        {active &&
          bursts.map((burst) => (
            <React.Fragment key={burst.id}>
              <span
                className="ok-ring"
                style={{ left: burst.x, top: burst.y, width: RING_PX, height: RING_PX }}
              />
              <span
                className="ok-ring"
                style={{
                  left: burst.x,
                  top: burst.y,
                  width: RING_PX * 0.55,
                  height: RING_PX * 0.55,
                  animationDelay: "60ms",
                  borderColor: "var(--bone)",
                }}
              />
              {[0, 90, 180, 270].map((deg) => (
                <span
                  key={deg}
                  className="ok-tick"
                  style={
                    {
                      left: burst.x,
                      top: burst.y,
                      height: 16,
                      transform: `rotate(${deg}deg) translateY(10px)`,
                      "--ok-throw": "26px",
                    } as React.CSSProperties
                  }
                />
              ))}
              <span className="ok-readout" style={{ left: burst.x, top: burst.y }}>
                {burst.label}
              </span>
            </React.Fragment>
          ))}
      </div>
    </>
  );
}

function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(pointer: fine)");
    const sync = () => setFine(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return fine;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default ClickEffects;
