"use client";

import * as React from "react";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Logo preloader.
 *
 * The mark fills bottom-to-top behind a counter, then the curtain splits and
 * lifts away. Built from the described pattern rather than copied: the
 * reference site could not be reached from this environment, so the geometry,
 * timing and the split are this product's own.
 *
 * The progress is tied to real readiness — webfonts resolved and the window
 * load event — with a floor so it cannot flash and a ceiling so a stalled
 * font request can never trap someone behind it. It runs once per session.
 */

const SESSION_KEY = "sovereign.preloaded";
const MIN_MS = 900;
const MAX_MS = 4000;

export function LogoPreloader() {
  const [mounted, setMounted] = React.useState(false);
  const [gone, setGone] = React.useState(true);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const counterRef = React.useRef<HTMLSpanElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // storage unavailable — treat as unseen
    }
    if (seen || prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    setGone(false);
    setMounted(true);
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const root = rootRef.current;
    const counter = counterRef.current;
    const fill = fillRef.current;
    if (!root || !counter || !fill) return;

    document.documentElement.style.overflow = "hidden";

    const started = performance.now();
    const progress = { value: 0 };
    let finished = false;

    const paint = () => {
      const pct = Math.round(progress.value);
      counter.textContent = String(pct).padStart(3, "0");
      // The mark fills from the floor up as the number climbs.
      fill.style.clipPath = `inset(${100 - pct}% 0 0 0)`;
    };

    // Climb to 90 on a curve while we wait, so the bar is never lying about
    // being nearly done; the last 10 belongs to the real ready signal.
    const creep = gsap.to(progress, {
      value: 90,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: paint,
    });

    const finish = () => {
      if (finished) return;
      finished = true;
      creep.kill();

      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_MS - elapsed);

      gsap
        .timeline({ delay: wait / 1000 })
        .to(progress, { value: 100, duration: 0.42, ease: "power2.inOut", onUpdate: paint })
        .to(root.querySelector("[data-preloader-content]"), { opacity: 0, duration: 0.26, ease: "power2.in" }, ">-0.05")
        // Split: the two halves part and leave.
        .to(root.querySelector("[data-curtain-top]"), { yPercent: -100, duration: 0.72, ease: "power4.inOut" }, "<")
        .to(root.querySelector("[data-curtain-bottom]"), { yPercent: 100, duration: 0.72, ease: "power4.inOut" }, "<")
        .add(() => {
          document.documentElement.style.overflow = "";
          setGone(true);
        });
    };

    // Real readiness, with a hard ceiling so a stalled request cannot trap
    // anyone behind the curtain.
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true })),
    ]);
    void ready.then(finish);
    const ceiling = window.setTimeout(finish, MAX_MS);

    return () => {
      window.clearTimeout(ceiling);
      creep.kill();
      document.documentElement.style.overflow = "";
    };
  }, [mounted]);

  if (!mounted || gone) return null;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[9999]" aria-hidden="true">
      <div data-curtain-top className="absolute inset-x-0 top-0" style={{ height: "50.5%", background: "var(--canvas)" }} />
      <div data-curtain-bottom className="absolute inset-x-0 bottom-0" style={{ height: "50.5%", background: "var(--canvas)" }} />

      <div
        data-preloader-content
        className="absolute inset-0 flex flex-col items-center justify-center gap-7"
        style={{ zIndex: 1 }}
      >
        <div style={{ position: "relative", width: 132, height: 132 }}>
          {/* Resting outline, then the filled mark clipped to the progress. */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.18 }}>
            <AstraMark size={132} handles={false} />
          </div>
          <div ref={fillRef} style={{ position: "absolute", inset: 0, clipPath: "inset(100% 0 0 0)" }}>
            <AstraMark size={132} handles={false} />
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span
            ref={counterRef}
            className="font-mono tnum"
            style={{ fontSize: 13, letterSpacing: "0.1em", color: "var(--signal)" }}
          >
            000
          </span>
          <span className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--graphite)" }}>
            AstraSovereign
          </span>
        </div>
      </div>
    </div>
  );
}

export default LogoPreloader;
