"use client";

import * as React from "react";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Logo preloader.
 *
 * The mark fills bottom-to-top behind a counter. When the page is genuinely
 * ready the counter lands on 100 and the plate *holds* — it does not time
 * itself out. The curtain splits when the person says so, and not before.
 *
 * That makes this a gate rather than a delay, which changes two things:
 *
 *   - It cannot be aria-hidden. A decorative overlay that disappears on its
 *     own can be hidden from assistive tech; one that has to be dismissed
 *     cannot, or a screen reader lands on a page it has no way past. It is a
 *     labelled button, focusable, and Enter/Space/Escape work like the click.
 *   - Readiness only arms it. A stalled webfont can no longer trap anyone,
 *     because nothing is waiting on that signal to let them through — the
 *     counter arms on a ceiling too, and the click always works regardless.
 *
 * It runs once per session, so moving around the site does not re-gate it.
 */

const SESSION_KEY = "sovereign.preloaded";
/** How long the counter may take to reach 100 before arming anyway. */
const ARM_CEILING_MS = 5000;
/**
 * The counter should be seen to climb. On a local server readiness resolves
 * in a few hundred milliseconds, which made the fill leap from a third to
 * full in half a second. This paces the fill; it does not gate the person,
 * who can click through at any point before it.
 */
const ARM_FLOOR_MS = 1700;

export function LogoPreloader() {
  const [mounted, setMounted] = React.useState(false);
  const [gone, setGone] = React.useState(true);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const counterRef = React.useRef<HTMLSpanElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const dismissRef = React.useRef<(() => void) | null>(null);

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
    root.focus({ preventScroll: true });

    const startedAt = performance.now();
    const progress = { value: 0 };
    let armed = false;
    let leaving = false;
    let armTimer = 0;

    const paint = () => {
      const pct = Math.round(progress.value);
      counter.textContent = String(pct).padStart(3, "0");
      // The mark fills from the floor up as the number climbs.
      fill.style.clipPath = `inset(${100 - pct}% 0 0 0)`;
    };

    const markFill = fill;
    const loading = root.querySelector("[data-state-loading]");
    const prompt = root.querySelector("[data-state-ready]");

    // Climb to 90 on a curve while we wait, so the counter is never lying
    // about being nearly done; the last 10 belongs to the real ready signal.
    const creep = gsap.to(progress, {
      value: 90,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: paint,
    });

    /** Page is ready: land on 100 and invite the click. */
    const arm = () => {
      if (armed || leaving) return;

      // Let the fill finish being watchable before landing it.
      const early = ARM_FLOOR_MS - (performance.now() - startedAt);
      if (early > 0) {
        if (!armTimer) armTimer = window.setTimeout(arm, early);
        return;
      }

      armed = true;
      creep.kill();

      gsap
        .timeline()
        .to(progress, { value: 100, duration: 0.5, ease: "power1.inOut", onUpdate: paint })
        .to(loading, { opacity: 0, duration: 0.24, ease: "power2.in" }, ">-0.1")
        .set(loading, { display: "none" })
        .set(prompt, { display: "block" })
        .fromTo(prompt, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" })
        .add(() => {
          // A slow breath on the filled mark, so a plate that now waits
          // indefinitely never reads as a frozen screenshot.
          gsap.to(markFill, {
            opacity: 0.62,
            duration: 1.9,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
        });
    };

    /** The person is done looking: split the curtain and go. */
    const dismiss = () => {
      if (leaving) return;
      leaving = true;
      creep.kill();
      gsap.killTweensOf(markFill);

      gsap
        .timeline()
        // Clicking before it armed snaps the counter home rather than
        // abandoning it mid-number.
        .to(progress, { value: 100, duration: armed ? 0 : 0.22, ease: "power2.out", onUpdate: paint })
        .to(root.querySelector("[data-preloader-content]"), { opacity: 0, duration: 0.26, ease: "power2.in" })
        // Split: the two halves part and leave.
        .to(root.querySelector("[data-curtain-top]"), { yPercent: -100, duration: 0.72, ease: "power4.inOut" }, "<")
        .to(root.querySelector("[data-curtain-bottom]"), { yPercent: 100, duration: 0.72, ease: "power4.inOut" }, "<")
        .add(() => {
          document.documentElement.style.overflow = "";
          setGone(true);
        });
    };

    dismissRef.current = dismiss;

    // Real readiness arms the plate. The ceiling arms it anyway, so a stalled
    // font request costs a few seconds of a spinning counter, not a lockout.
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true })),
    ]);
    void ready.then(arm);
    const ceiling = window.setTimeout(arm, ARM_CEILING_MS);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(ceiling);
      if (armTimer) window.clearTimeout(armTimer);
      window.removeEventListener("keydown", onKey);
      dismissRef.current = null;
      creep.kill();
      gsap.killTweensOf(markFill);
      document.documentElement.style.overflow = "";
    };
  }, [mounted]);

  if (!mounted || gone) return null;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Enter AstraSovereign"
      className="fixed inset-0 z-[9999]"
      onClick={() => dismissRef.current?.()}
      style={{ cursor: "pointer", outline: "none" }}
    >
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

        {/* Two states in one slot: what it is doing, then what to do next. */}
        <div style={{ height: 16, position: "relative" }}>
          <span
            data-state-loading
            className="font-mono uppercase"
            style={{ fontSize: 9.5, letterSpacing: "0.22em", color: "var(--graphite)" }}
          >
            Preparing the workbench
          </span>
          <span
            data-state-ready
            className="font-mono uppercase"
            style={{
              display: "none",
              opacity: 0,
              fontSize: 10,
              letterSpacing: "0.24em",
              color: "var(--bone)",
            }}
          >
            Click anywhere to enter
          </span>
        </div>
      </div>
    </div>
  );
}

export default LogoPreloader;
